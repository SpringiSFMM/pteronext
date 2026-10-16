package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// DiscordRole represents a role from Discord's REST API.
type DiscordRole struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Color       int    `json:"color"`
	Position    int    `json:"position"`
	Permissions string `json:"permissions"`
}

// DiscordRoleMapping represents an admin-defined mapping between a Discord role and Panel permissions.
type DiscordRoleMapping struct {
	RoleID      string `json:"role_id"`
	RoleName    string `json:"role_name"`
	PowerAccess bool   `json:"power_access"` // can start / stop / restart
	AllServers  bool   `json:"all_servers"`  // true = all servers, false = only assigned/owned
}

// BotIdentity holds basic Discord Bot identity.
type BotIdentity struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	Discriminator string `json:"discriminator"`
	Avatar        string `json:"avatar"`
	BotTag        string `json:"bot_tag"`
}

type DiscordBotService struct {
	db          *gorm.DB
	wingsClient *WingsClient
	mu          sync.Mutex
	cancelFunc  context.CancelFunc
	running     bool
	botUser     *BotIdentity
}

func NewDiscordBotService(db *gorm.DB, wingsClient *WingsClient) *DiscordBotService {
	return &DiscordBotService{
		db:          db,
		wingsClient: wingsClient,
	}
}

// Start launches the Discord Gateway connection if enabled in settings.
func (s *DiscordBotService) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return
	}

	var enabledSetting, tokenSetting models.SystemSetting
	s.db.Where("key = 'discord_enabled'").First(&enabledSetting)
	s.db.Where("key = 'discord_bot_token'").First(&tokenSetting)

	if enabledSetting.Value != "true" || strings.TrimSpace(tokenSetting.Value) == "" {
		log.Printf("[DISCORD-BOT] Discord Bot is disabled or bot token is empty.")
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.cancelFunc = cancel
	s.running = true

	go s.runGatewayLoop(ctx)
}

// Stop cleanly closes the Gateway connection.
func (s *DiscordBotService) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return
	}

	if s.cancelFunc != nil {
		s.cancelFunc()
		s.cancelFunc = nil
	}
	s.running = false
	log.Printf("[DISCORD-BOT] Gateway bot service stopped.")
}

// Reload restarts the gateway connection with updated database configuration.
func (s *DiscordBotService) Reload() {
	s.Stop()
	time.Sleep(300 * time.Millisecond)
	s.Start()
}

// IsRunning reports whether the gateway runner is currently active.
func (s *DiscordBotService) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

// GetBotIdentity returns the cached identity of the connected bot.
func (s *DiscordBotService) GetBotIdentity() *BotIdentity {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.botUser
}

// TestConnection validates the token and queries Discord API for the bot user.
func (s *DiscordBotService) TestConnection(token string) (*BotIdentity, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fmt.Errorf("bot token is empty")
	}

	req, err := http.NewRequest("GET", "https://discord.com/api/v10/users/@me", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bot "+token)
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("discord API unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("discord API error (%d): %s", resp.StatusCode, string(body))
	}

	var data struct {
		ID            string `json:"id"`
		Username      string `json:"username"`
		Discriminator string `json:"discriminator"`
		Avatar        string `json:"avatar"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	tag := data.Username
	if data.Discriminator != "" && data.Discriminator != "0" {
		tag = fmt.Sprintf("%s#%s", data.Username, data.Discriminator)
	}

	ident := &BotIdentity{
		ID:            data.ID,
		Username:      data.Username,
		Discriminator: data.Discriminator,
		Avatar:        data.Avatar,
		BotTag:        tag,
	}

	s.mu.Lock()
	s.botUser = ident
	s.mu.Unlock()

	return ident, nil
}

// GetGuildRoles queries Discord for all roles defined in the target guild.
func (s *DiscordBotService) GetGuildRoles(guildID, token string) ([]DiscordRole, error) {
	guildID = strings.TrimSpace(guildID)
	token = strings.TrimSpace(token)
	if guildID == "" || token == "" {
		return nil, fmt.Errorf("guild ID and bot token are required")
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("https://discord.com/api/v10/guilds/%s/roles", guildID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bot "+token)
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed fetching guild roles (%d): %s", resp.StatusCode, string(body))
	}

	var roles []DiscordRole
	if err := json.NewDecoder(resp.Body).Decode(&roles); err != nil {
		return nil, err
	}

	return roles, nil
}

// RegisterSlashCommands registers the panel management slash commands on the guild.
func (s *DiscordBotService) RegisterSlashCommands(clientID, guildID, token string) error {
	clientID = strings.TrimSpace(clientID)
	guildID = strings.TrimSpace(guildID)
	token = strings.TrimSpace(token)

	if clientID == "" || guildID == "" || token == "" {
		return fmt.Errorf("client ID, guild ID, and bot token are required")
	}

	commands := []map[string]interface{}{
		{
			"name":        "server",
			"description": "PteroNext Server-Management Befehle",
			"options": []map[string]interface{}{
				{
					"name":        "list",
					"description": "Listet alle verfügbaren Game- & App-Server auf",
					"type":        1, // SUB_COMMAND
				},
				{
					"name":        "status",
					"description": "Ruft Live-Status, CPU, RAM und Port eines Servers ab",
					"type":        1,
					"options": []map[string]interface{}{
						{
							"name":        "server",
							"description": "Name oder UUID des Servers",
							"type":        3, // STRING
							"required":    true,
						},
					},
				},
				{
					"name":        "start",
					"description": "Fährt den angegebenen Server hoch",
					"type":        1,
					"options": []map[string]interface{}{
						{
							"name":        "server",
							"description": "Name oder UUID des Servers",
							"type":        3,
							"required":    true,
						},
					},
				},
				{
					"name":        "stop",
					"description": "Stoppt den angegebenen Server sicher",
					"type":        1,
					"options": []map[string]interface{}{
						{
							"name":        "server",
							"description": "Name oder UUID des Servers",
							"type":        3,
							"required":    true,
						},
					},
				},
				{
					"name":        "restart",
					"description": "Startet den angegebenen Server neu",
					"type":        1,
					"options": []map[string]interface{}{
						{
							"name":        "server",
							"description": "Name oder UUID des Servers",
							"type":        3,
							"required":    true,
						},
					},
				},
			},
		},
		{
			"name":        "link",
			"description": "Verknüpft deinen Discord-Account mit dem PteroNext Panel",
			"options": []map[string]interface{}{
				{
					"name":        "code",
					"description": "Der 6-stellige Code aus dem PteroNext Dashboard",
					"type":        3,
					"required":    true,
				},
			},
		},
		{
			"name":        "panel",
			"description": "Zeigt den Systemstatus und Link zum PteroNext Panel",
		},
	}

	body, err := json.Marshal(commands)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://discord.com/api/v10/applications/%s/guilds/%s/commands", clientID, guildID)
	req, err := http.NewRequest("PUT", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bot "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed registering commands (%d): %s", resp.StatusCode, string(respBody))
	}

	log.Printf("[DISCORD-BOT] Successfully registered guild slash commands on guild %s", guildID)
	return nil
}

// runGatewayLoop manages the WebSocket connection with automatic backoff reconnection.
func (s *DiscordBotService) runGatewayLoop(ctx context.Context) {
	backoff := 2 * time.Second

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// Retrieve latest token
		var tokenSetting models.SystemSetting
		s.db.Where("key = 'discord_bot_token'").First(&tokenSetting)
		token := strings.TrimSpace(tokenSetting.Value)
		if token == "" {
			time.Sleep(5 * time.Second)
			continue
		}

		err := s.connectAndListen(ctx, token)
		if err != nil && ctx.Err() == nil {
			log.Printf("[DISCORD-BOT] Gateway connection closed: %v. Reconnecting in %v...", err, backoff)
			select {
			case <-time.After(backoff):
				if backoff < 60*time.Second {
					backoff *= 2
				}
			case <-ctx.Done():
				return
			}
		} else {
			backoff = 2 * time.Second
		}
	}
}

// connectAndListen maintains the active WebSocket session and responds to events.
func (s *DiscordBotService) connectAndListen(ctx context.Context, token string) error {
	dialer := websocket.DefaultDialer
	conn, _, err := dialer.DialContext(ctx, "wss://gateway.discord.gg/?v=10&encoding=json", nil)
	if err != nil {
		return err
	}
	defer conn.Close()

	log.Printf("[DISCORD-BOT] Gateway WebSocket connection established.")

	var heartbeatInterval time.Duration
	var lastSeq *int64
	heartbeatDone := make(chan struct{})
	defer close(heartbeatDone)

	for {
		select {
		case <-ctx.Done():
			_ = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "shutting down"))
			return nil
		default:
		}

		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			return err
		}

		var payload struct {
			Op int             `json:"op"`
			D  json.RawMessage `json:"d"`
			S  *int64          `json:"s"`
			T  string          `json:"t"`
		}

		if err := json.Unmarshal(msgBytes, &payload); err != nil {
			continue
		}

		if payload.S != nil {
			lastSeq = payload.S
		}

		switch payload.Op {
		case 10: // HELLO
			var helloData struct {
				HeartbeatInterval int `json:"heartbeat_interval"`
			}
			if err := json.Unmarshal(payload.D, &helloData); err == nil {
				heartbeatInterval = time.Duration(helloData.HeartbeatInterval) * time.Millisecond

				// Start heartbeat goroutine
				go func(interval time.Duration) {
					ticker := time.NewTicker(interval)
					defer ticker.Stop()

					for {
						select {
						case <-ticker.C:
							hb := map[string]interface{}{"op": 1, "d": lastSeq}
							if err := conn.WriteJSON(hb); err != nil {
								return
							}
						case <-heartbeatDone:
							return
						case <-ctx.Done():
							return
						}
					}
				}(heartbeatInterval)

				// Send IDENTIFY (Opcode 2)
				identify := map[string]interface{}{
					"op": 2,
					"d": map[string]interface{}{
						"token":   token,
						"intents": 1, // Guilds intent
						"properties": map[string]interface{}{
							"os":      "linux",
							"browser": "pteronext-core",
							"device":  "pteronext-core",
						},
					},
				}
				if err := conn.WriteJSON(identify); err != nil {
					return err
				}
			}

		case 11: // Heartbeat ACK
			// Heartbeat acknowledged

		case 0: // DISPATCH
			switch payload.T {
			case "READY":
				var readyData struct {
					User struct {
						ID            string `json:"id"`
						Username      string `json:"username"`
						Discriminator string `json:"discriminator"`
						Avatar        string `json:"avatar"`
					} `json:"user"`
				}
				if err := json.Unmarshal(payload.D, &readyData); err == nil {
					s.mu.Lock()
					s.botUser = &BotIdentity{
						ID:            readyData.User.ID,
						Username:      readyData.User.Username,
						Discriminator: readyData.User.Discriminator,
						Avatar:        readyData.User.Avatar,
						BotTag:        readyData.User.Username,
					}
					s.mu.Unlock()
					log.Printf("[DISCORD-BOT] Bot logged in as %s (ID: %s)", readyData.User.Username, readyData.User.ID)
				}

			case "INTERACTION_CREATE":
				go s.handleInteraction(payload.D, token)
			}
		}
	}
}

// Interaction payload representations
type InteractionMember struct {
	User struct {
		ID       string `json:"id"`
		Username string `json:"username"`
	} `json:"user"`
	Roles []string `json:"roles"`
}

type InteractionOption struct {
	Name    string              `json:"name"`
	Type    int                 `json:"type"`
	Value   interface{}         `json:"value"`
	Options []InteractionOption `json:"options"`
}

type InteractionData struct {
	Name    string              `json:"name"`
	Options []InteractionOption `json:"options"`
}

type FullInteraction struct {
	ID      string             `json:"id"`
	Token   string             `json:"token"`
	Data    InteractionData    `json:"data"`
	Member  *InteractionMember `json:"member"`
	User    *struct {
		ID       string `json:"id"`
		Username string `json:"username"`
	} `json:"user"`
}

// handleInteraction processes incoming slash command requests.
func (s *DiscordBotService) handleInteraction(raw json.RawMessage, botToken string) {
	var interaction FullInteraction
	if err := json.Unmarshal(raw, &interaction); err != nil {
		return
	}

	discordUserID := ""
	discordUsername := ""
	var userRoles []string

	if interaction.Member != nil {
		discordUserID = interaction.Member.User.ID
		discordUsername = interaction.Member.User.Username
		userRoles = interaction.Member.Roles
	} else if interaction.User != nil {
		discordUserID = interaction.User.ID
		discordUsername = interaction.User.Username
	}

	cmdName := interaction.Data.Name

	switch cmdName {
	case "panel":
		var serverCount int64
		s.db.Model(&models.Server{}).Count(&serverCount)
		respMsg := fmt.Sprintf("⚡ **PteroNext Panel Core v2.9.0**\n🟢 System Status: Online & Operational\n🖥️ Aktive Serverinstanzen: **%d**\n🔗 Web-Zugang: [PteroNext Dashboard](https://pteronext.com)", serverCount)
		s.sendInteractionResponse(interaction.ID, interaction.Token, respMsg, false)

	case "link":
		var code string
		for _, opt := range interaction.Data.Options {
			if opt.Name == "code" {
				if str, ok := opt.Value.(string); ok {
					code = strings.TrimSpace(str)
				}
			}
		}

		if code == "" {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Bitte gib den 6-stelligen Verifizierungs-Code an: `/link code:123456`", true)
			return
		}

		var verification models.DiscordLinkVerification
		if err := s.db.Where("code = ? AND expires_at > ?", code, time.Now()).First(&verification).Error; err != nil {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Ungültiger oder abgelaufener Verifizierungs-Code. Bitte fordere im Dashboard unter Account einen neuen Code an.", true)
			return
		}

		now := time.Now()
		s.db.Model(&models.User{}).Where("id = ?", verification.UserID).Updates(map[string]interface{}{
			"discord_id":        discordUserID,
			"discord_username":  discordUsername,
			"discord_linked_at": &now,
		})

		s.db.Where("code = ?", code).Delete(&models.DiscordLinkVerification{})

		var panelUser models.User
		s.db.First(&panelUser, verification.UserID)

		s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("✅ **Erfolgreich verknüpft!**\nDein Discord-Konto wurde mit PteroNext-Benutzer **%s** verknüpft.", panelUser.Username), false)

	case "server":
		s.handleServerCommand(interaction, discordUserID, userRoles)
	}
}

// handleServerCommand handles subcommands: list, status, start, stop, restart.
func (s *DiscordBotService) handleServerCommand(interaction FullInteraction, discordUserID string, discordRoles []string) {
	// Look up linked PteroNext user
	var user models.User
	if err := s.db.Where("discord_id = ?", discordUserID).First(&user).Error; err != nil || user.ID == 0 {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "🔒 **Discord-Konto nicht verknüpft!**\nBitte verknüpfe zuerst deinen Discord-Account im PteroNext Panel unter Account-Einstellungen oder per `/link <code>`.", true)
		return
	}

	subCmd := ""
	serverQuery := ""

	if len(interaction.Data.Options) > 0 {
		subCmd = interaction.Data.Options[0].Name
		for _, opt := range interaction.Data.Options[0].Options {
			if opt.Name == "server" {
				if str, ok := opt.Value.(string); ok {
					serverQuery = strings.TrimSpace(str)
				}
			}
		}
	}

	isRootAdmin := user.RootAdmin

	// Load admin role mappings
	var mappingSetting models.SystemSetting
	s.db.Where("key = 'discord_role_mappings'").First(&mappingSetting)
	var mappings []DiscordRoleMapping
	if mappingSetting.Value != "" {
		_ = json.Unmarshal([]byte(mappingSetting.Value), &mappings)
	}

	hasRolePowerAccess := false
	hasRoleAllServers := false
	for _, rID := range discordRoles {
		for _, m := range mappings {
			if m.RoleID == rID {
				if m.PowerAccess {
					hasRolePowerAccess = true
				}
				if m.AllServers {
					hasRoleAllServers = true
				}
			}
		}
	}

	switch subCmd {
	case "list":
		var servers []models.Server
		if isRootAdmin || hasRoleAllServers {
			s.db.Find(&servers)
		} else {
			s.db.Where("owner_id = ?", user.ID).Find(&servers)
		}

		if len(servers) == 0 {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "ℹ️ Keine Server zugewiesen oder gefunden.", true)
			return
		}

		var sb strings.Builder
		sb.WriteString("🖥️ **Deine verfügbaren PteroNext Server:**\n\n")
		for _, srv := range servers {
			st := "offline"
			if srv.Status != nil && *srv.Status != "" {
				st = *srv.Status
			} else if srv.Suspended {
				st = "suspended"
			}
			statusIcon := "🟢"
			if st == "stopped" || st == "offline" || st == "suspended" {
				statusIcon = "🔴"
			} else if st == "starting" || st == "stopping" {
				statusIcon = "🟡"
			}
			sb.WriteString(fmt.Sprintf("%s **%s** (`%s`) — *%s*\n", statusIcon, srv.Name, srv.Identifier, strings.ToUpper(st)))
		}

		s.sendInteractionResponse(interaction.ID, interaction.Token, sb.String(), false)

	case "status":
		if serverQuery == "" {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Bitte Servername oder Identifier angeben: `/server status server:MeinServer`", true)
			return
		}

		var srv models.Server
		if err := s.db.Preload("Node").Where("uuid = ? OR identifier = ? OR LOWER(name) = LOWER(?)", serverQuery, serverQuery, serverQuery).First(&srv).Error; err != nil {
			s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Server '%s' nicht gefunden.", serverQuery), true)
			return
		}

		// Permission check
		if !isRootAdmin && !hasRoleAllServers && srv.OwnerID != user.ID {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "⛔ Du hast keine Berechtigung, den Status dieses Servers einzusehen.", true)
			return
		}

		st := "offline"
		if srv.Status != nil && *srv.Status != "" {
			st = *srv.Status
		} else if srv.Suspended {
			st = "suspended"
		}
		statusIcon := "🟢"
		if st == "stopped" || st == "offline" || st == "suspended" {
			statusIcon = "🔴"
		} else if st == "starting" || st == "stopping" {
			statusIcon = "🟡"
		}

		nodeName := "Standard Node"
		if srv.Node != nil {
			nodeName = srv.Node.Name
		}

		msg := fmt.Sprintf("📊 **Server Status: %s**\n\n%s Zustand: **%s**\n🆔 Identifier: `%s`\n💾 RAM-Limit: %d MB\n⚙️ CPU-Limit: %d%%\n🌐 Node: %s",
			srv.Name, statusIcon, strings.ToUpper(st), srv.Identifier, srv.MemoryMB, srv.CPU, nodeName)

		s.sendInteractionResponse(interaction.ID, interaction.Token, msg, false)

	case "start", "stop", "restart":
		if serverQuery == "" {
			s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Bitte Servername angeben: `/server %s server:MeinServer`", subCmd), true)
			return
		}

		var srv models.Server
		if err := s.db.Preload("Node").Where("uuid = ? OR identifier = ? OR LOWER(name) = LOWER(?)", serverQuery, serverQuery, serverQuery).First(&srv).Error; err != nil {
			s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Server '%s' nicht gefunden.", serverQuery), true)
			return
		}

		// Permission check for power actions
		canExecute := isRootAdmin || (hasRolePowerAccess && hasRoleAllServers) || (hasRolePowerAccess && srv.OwnerID == user.ID) || (srv.OwnerID == user.ID)
		if !canExecute {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "⛔ Unzureichende Berechtigungen für diesen Server-Power-Befehl.", true)
			return
		}

		// Acknowledge interaction immediately to prevent Discord 3s timeout
		s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("⏳ Sende Befehl **%s** an Server **%s**...", strings.ToUpper(subCmd), srv.Name), false)

		// Execute power action
		go func(node *models.Node, srvUUID, act, srvName string) {
			err := s.wingsClient.SendPowerAction(node, srvUUID, act)
			if err != nil {
				log.Printf("[DISCORD-BOT] Power action %s failed on server %s: %v", act, srvUUID, err)
			} else {
				log.Printf("[DISCORD-BOT] Power action %s succeeded on server %s", act, srvName)
			}
		}(srv.Node, srv.UUID, subCmd, srv.Name)

	default:
		s.sendInteractionResponse(interaction.ID, interaction.Token, "Unbekannter Server-Befehl. Verfügbar: `/server list`, `/server status`, `/server start`, `/server stop`, `/server restart`.", true)
	}
}

// sendInteractionResponse sends an immediate response to Discord Interaction webhook.
func (s *DiscordBotService) sendInteractionResponse(interactionID, interactionToken, content string, ephemeral bool) {
	flags := 0
	if ephemeral {
		flags = 64 // EPHEMERAL
	}

	payload := map[string]interface{}{
		"type": 4, // CHANNEL_MESSAGE_WITH_SOURCE
		"data": map[string]interface{}{
			"content": content,
			"flags":   flags,
		},
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://discord.com/api/v10/interactions/%s/%s/callback", interactionID, interactionToken)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 5 * time.Second}
	_, _ = client.Do(req)
}
