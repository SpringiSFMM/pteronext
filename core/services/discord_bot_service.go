package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"strconv"
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

// RegisterSlashCommands registers the full suite of slash commands on the guild.
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
			"description": "PteroNext server management commands",
			"options": []map[string]interface{}{
				{
					"name":        "list",
					"description": "List all available server instances",
					"type":        1, // SUB_COMMAND
				},
				{
					"name":        "status",
					"description": "Check live metrics, CPU, RAM and node",
					"type":        1,
					"options": []map[string]interface{}{
						{
							"name":        "server",
							"description": "Server identifier or name",
							"type":        3, // STRING
							"required":    true,
						},
					},
				},
				{
					"name":        "start",
					"description": "Power on the specified server",
					"type":        1,
					"options": []map[string]interface{}{
						{
							"name":        "server",
							"description": "Server identifier or name",
							"type":        3,
							"required":    true,
						},
					},
				},
				{
					"name":        "stop",
					"description": "Gracefully stop the specified server",
					"type":        1,
					"options": []map[string]interface{}{
						{
							"name":        "server",
							"description": "Server identifier or name",
							"type":        3,
							"required":    true,
						},
					},
				},
				{
					"name":        "restart",
					"description": "Reboot the specified server",
					"type":        1,
					"options": []map[string]interface{}{
						{
							"name":        "server",
							"description": "Server identifier or name",
							"type":        3,
							"required":    true,
						},
					},
				},
			},
		},
		{
			"name":        "link",
			"description": "Link your Discord account to PteroNext Panel",
			"options": []map[string]interface{}{
				{
					"name":        "code",
					"description": "6-digit verification code from PteroNext dashboard",
					"type":        3,
					"required":    true,
				},
			},
		},
		{
			"name":        "panel",
			"description": "Display PteroNext panel overview and status",
		},
		{
			"name":        "purge",
			"description": "Bulk delete messages from this channel",
			"options": []map[string]interface{}{
				{
					"name":        "amount",
					"description": "Number of messages to delete (1-100)",
					"type":        4, // INTEGER
					"required":    true,
				},
			},
		},
		{
			"name":        "giveaway",
			"description": "Create and manage community giveaways",
			"options": []map[string]interface{}{
				{
					"name":        "prize",
					"description": "Prize to give away",
					"type":        3,
					"required":    true,
				},
				{
					"name":        "duration",
					"description": "Giveaway duration (e.g. 10m, 1h, 24h, 3d)",
					"type":        3,
					"required":    true,
				},
				{
					"name":        "winners",
					"description": "Number of winners (default: 1)",
					"type":        4,
					"required":    false,
				},
			},
		},
		{
			"name":        "poll",
			"description": "Create an interactive community poll with real-time voting",
			"options": []map[string]interface{}{
				{
					"name":        "question",
					"description": "The poll question",
					"type":        3,
					"required":    true,
				},
				{
					"name":        "option1",
					"description": "Option 1",
					"type":        3,
					"required":    true,
				},
				{
					"name":        "option2",
					"description": "Option 2",
					"type":        3,
					"required":    true,
				},
				{
					"name":        "option3",
					"description": "Option 3 (optional)",
					"type":        3,
					"required":    false,
				},
				{
					"name":        "option4",
					"description": "Option 4 (optional)",
					"type":        3,
					"required":    false,
				},
			},
		},
		{
			"name":        "umfrage",
			"description": "Create an interactive community poll with real-time voting",
			"options": []map[string]interface{}{
				{
					"name":        "question",
					"description": "The poll question",
					"type":        3,
					"required":    true,
				},
				{
					"name":        "option1",
					"description": "Option 1",
					"type":        3,
					"required":    true,
				},
				{
					"name":        "option2",
					"description": "Option 2",
					"type":        3,
					"required":    true,
				},
				{
					"name":        "option3",
					"description": "Option 3 (optional)",
					"type":        3,
					"required":    false,
				},
				{
					"name":        "option4",
					"description": "Option 4 (optional)",
					"type":        3,
					"required":    false,
				},
			},
		},
		{
			"name":        "userinfo",
			"description": "Display detailed profile, roles and activity stats for a member",
			"options": []map[string]interface{}{
				{
					"name":        "user",
					"description": "The user to inspect",
					"type":        6, // USER
					"required":    false,
				},
			},
		},
		{
			"name":        "serverinfo",
			"description": "Display detailed server overview, member counts and boost stats",
		},
		{
			"name":        "rank",
			"description": "Display activity rank, current level and XP progression",
			"options": []map[string]interface{}{
				{
					"name":        "user",
					"description": "User to display level and rank for",
					"type":        6, // USER
					"required":    false,
				},
			},
		},
		{
			"name":        "leaderboard",
			"description": "Display top 10 most active members by XP",
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

// runGatewayLoop manages the WebSocket connection with automatic backoff reconnection and giveaway scheduler.
func (s *DiscordBotService) runGatewayLoop(ctx context.Context) {
	// Start background giveaway ticker
	go s.runGiveawayTicker(ctx)

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

// runGiveawayTicker continuously checks for expired giveaways and resolves winners.
func (s *DiscordBotService) runGiveawayTicker(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.checkExpiredGiveaways()
		case <-ctx.Done():
			return
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

				// Send IDENTIFY (Opcode 2) with GUILDS (1) + GUILD_MESSAGES (512) = 513
				identify := map[string]interface{}{
					"op": 2,
					"d": map[string]interface{}{
						"token":   token,
						"intents": 513,
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

					// Auto-register slash commands if enabled in settings
					var slashSetting, clientSetting, guildSetting models.SystemSetting
					s.db.Where("key = 'discord_slash_commands_enabled'").First(&slashSetting)
					s.db.Where("key = 'discord_client_id'").First(&clientSetting)
					s.db.Where("key = 'discord_guild_id'").First(&guildSetting)
					clientID := strings.TrimSpace(clientSetting.Value)
					if clientID == "" {
						clientID = readyData.User.ID
					}
					guildID := strings.TrimSpace(guildSetting.Value)
					if slashSetting.Value == "true" && clientID != "" && guildID != "" {
						go func(cID, gID, tok string) {
							if err := s.RegisterSlashCommands(cID, gID, tok); err != nil {
								log.Printf("[DISCORD-BOT] Auto-register slash commands on ready error: %v", err)
							}
						}(clientID, guildID, token)
					}
				}

			case "INTERACTION_CREATE":
				go s.handleInteraction(payload.D, token)

			case "MESSAGE_CREATE":
				go s.handleMessageCreate(payload.D, token)
			}
		}
	}
}

// Interaction payload representations
type InteractionMember struct {
	User struct {
		ID            string `json:"id"`
		Username      string `json:"username"`
		Discriminator string `json:"discriminator"`
		Avatar        string `json:"avatar"`
	} `json:"user"`
	Nick        string   `json:"nick"`
	Roles       []string `json:"roles"`
	JoinedAt    string   `json:"joined_at"`
	Permissions string   `json:"permissions"`
}

type InteractionOption struct {
	Name    string              `json:"name"`
	Type    int                 `json:"type"`
	Value   interface{}         `json:"value"`
	Options []InteractionOption `json:"options"`
}

type InteractionData struct {
	ID            string              `json:"id"`
	Name          string              `json:"name"`
	Type          int                 `json:"type"`
	CustomID      string              `json:"custom_id"`
	ComponentType int                 `json:"component_type"`
	Values        []string            `json:"values"`
	Options       []InteractionOption `json:"options"`
}

type FullInteraction struct {
	ID        string             `json:"id"`
	Type      int                `json:"type"` // 2 = APPLICATION_COMMAND, 3 = MESSAGE_COMPONENT
	GuildID   string             `json:"guild_id"`
	ChannelID string             `json:"channel_id"`
	Token     string             `json:"token"`
	Data      InteractionData    `json:"data"`
	Member    *InteractionMember `json:"member"`
	User      *struct {
		ID            string `json:"id"`
		Username      string `json:"username"`
		Discriminator string `json:"discriminator"`
		Avatar        string `json:"avatar"`
	} `json:"user"`
}

// handleInteraction processes incoming slash command requests (Type 2) and button clicks (Type 3).
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

	// Handle Message Component Interactions (Type 3: Buttons)
	if interaction.Type == 3 {
		customID := interaction.Data.CustomID
		if strings.HasPrefix(customID, "giveaway_enter:") {
			s.handleGiveawayButton(interaction, discordUserID, botToken)
			return
		} else if strings.HasPrefix(customID, "poll_vote:") {
			s.handlePollButton(interaction, discordUserID, botToken)
			return
		}
		return
	}

	cmdName := interaction.Data.Name

	switch cmdName {
	case "panel":
		var serverCount int64
		s.db.Model(&models.Server{}).Count(&serverCount)
		respMsg := fmt.Sprintf("⚡ **PteroNext Panel Core v2.9.0**\n🟢 System Status: Online & Operational\n🖥️ Active Server Instances: **%d**\n🔗 Web Access: [PteroNext Dashboard](https://pteronext.com)", serverCount)
		s.sendInteractionResponse(interaction.ID, interaction.Token, respMsg, false)

	case "link":
		code := getOptionString(interaction.Data.Options, "code")
		if code == "" {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Please provide the 6-digit verification code: `/link code:123456`", true)
			return
		}

		var verification models.DiscordLinkVerification
		if err := s.db.Where("code = ? AND expires_at > ?", code, time.Now()).First(&verification).Error; err != nil {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Invalid or expired verification code. Please request a new code under Account settings in your dashboard.", true)
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

		s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("✅ **Successfully linked!**\nYour Discord account has been linked to PteroNext user **%s**.", panelUser.Username), false)

	case "server":
		s.handleServerCommand(interaction, discordUserID, userRoles)

	case "purge":
		s.handlePurgeCommand(interaction, discordUserID, botToken)

	case "giveaway":
		s.handleGiveawayCommand(interaction, discordUserID, discordUsername, botToken)

	case "poll", "umfrage":
		s.handlePollCommand(interaction, discordUserID, discordUsername, botToken)

	case "userinfo":
		s.handleUserInfoCommand(interaction, discordUserID, botToken)

	case "serverinfo":
		s.handleServerInfoCommand(interaction, botToken)

	case "rank":
		s.handleRankCommand(interaction, discordUserID, botToken)

	case "leaderboard":
		s.handleLeaderboardCommand(interaction, botToken)
	}
}

// handleServerCommand handles subcommands: list, status, start, stop, restart.
func (s *DiscordBotService) handleServerCommand(interaction FullInteraction, discordUserID string, discordRoles []string) {
	// Look up linked PteroNext user
	var user models.User
	if err := s.db.Where("discord_id = ?", discordUserID).First(&user).Error; err != nil || user.ID == 0 {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "🔒 **Discord account not linked!**\nPlease link your Discord account in the PteroNext Panel under Account Settings or via `/link <code>`.", true)
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
			s.sendInteractionResponse(interaction.ID, interaction.Token, "ℹ️ No servers assigned or found.", true)
			return
		}

		var sb strings.Builder
		sb.WriteString("🖥️ **Your available PteroNext Servers:**\n\n")
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
			s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Please provide a server name or identifier: `/server status server:MyServer`", true)
			return
		}

		var srv models.Server
		if err := s.db.Preload("Node").Where("uuid = ? OR identifier = ? OR LOWER(name) = LOWER(?)", serverQuery, serverQuery, serverQuery).First(&srv).Error; err != nil {
			s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Server '%s' not found.", serverQuery), true)
			return
		}

		// Permission check
		if !isRootAdmin && !hasRoleAllServers && srv.OwnerID != user.ID {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "⛔ You do not have permission to view the status of this server.", true)
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

		msg := fmt.Sprintf("📊 **Server Status: %s**\n\n%s State: **%s**\n🆔 Identifier: `%s`\n💾 RAM Limit: %d MB\n⚙️ CPU Limit: %d%%\n🌐 Node: %s",
			srv.Name, statusIcon, strings.ToUpper(st), srv.Identifier, srv.MemoryMB, srv.CPU, nodeName)

		s.sendInteractionResponse(interaction.ID, interaction.Token, msg, false)

	case "start", "stop", "restart":
		if serverQuery == "" {
			s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Please provide a server name: `/server %s server:MyServer`", subCmd), true)
			return
		}

		var srv models.Server
		if err := s.db.Preload("Node").Where("uuid = ? OR identifier = ? OR LOWER(name) = LOWER(?)", serverQuery, serverQuery, serverQuery).First(&srv).Error; err != nil {
			s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Server '%s' not found.", serverQuery), true)
			return
		}

		// Permission check for power actions
		canExecute := isRootAdmin || (hasRolePowerAccess && hasRoleAllServers) || (hasRolePowerAccess && srv.OwnerID == user.ID) || (srv.OwnerID == user.ID)
		if !canExecute {
			s.sendInteractionResponse(interaction.ID, interaction.Token, "⛔ Insufficient permissions for this server power command.", true)
			return
		}

		// Acknowledge interaction immediately to prevent Discord 3s timeout
		s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("⏳ Sending command **%s** to server **%s**...", strings.ToUpper(subCmd), srv.Name), false)

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
		s.sendInteractionResponse(interaction.ID, interaction.Token, "Unknown server command. Available: `/server list`, `/server status`, `/server start`, `/server stop`, `/server restart`.", true)
	}
}

// handlePurgeCommand handles bulk message deletion with permissions check.
func (s *DiscordBotService) handlePurgeCommand(interaction FullInteraction, discordUserID, botToken string) {
	// Permission check
	var user models.User
	isRootAdmin := false
	if err := s.db.Where("discord_id = ?", discordUserID).First(&user).Error; err == nil {
		isRootAdmin = user.RootAdmin
	}

	hasManageMessages := false
	if interaction.Member != nil {
		hasManageMessages = memberHasPermission(interaction.Member.Permissions, 0x2000)
	}

	if !isRootAdmin && !hasManageMessages {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "⛔ You need the 'Manage Messages' permission to execute this command.", true)
		return
	}

	amount := getOptionInt(interaction.Data.Options, "amount", 10)
	if amount <= 0 {
		amount = 1
	}
	if amount > 100 {
		amount = 100
	}

	channelID := interaction.ChannelID
	if channelID == "" {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Error: Channel ID could not be determined.", true)
		return
	}

	// Fetch recent messages
	url := fmt.Sprintf("https://discord.com/api/v10/channels/%s/messages?limit=%d", channelID, amount)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Failed to fetch messages.", true)
		return
	}
	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Discord API is currently unreachable.", true)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Failed to fetch channel messages.", true)
		return
	}

	var msgs []struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&msgs); err != nil || len(msgs) == 0 {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "ℹ️ No messages found to delete in this channel.", true)
		return
	}

	now := time.Now()
	var deletableIDs []string
	for _, m := range msgs {
		msgTime := getSnowflakeTime(m.ID)
		if !msgTime.IsZero() && now.Sub(msgTime) < 14*24*time.Hour {
			deletableIDs = append(deletableIDs, m.ID)
		}
	}

	if len(deletableIDs) == 0 {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "ℹ️ No deletable messages found (messages older than 14 days cannot be bulk deleted by Discord).", true)
		return
	}

	if len(deletableIDs) == 1 {
		if err := s.deleteSingleMessage(channelID, deletableIDs[0], botToken); err != nil {
			s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Error deleting message: %v", err), true)
			return
		}
		s.sendInteractionResponse(interaction.ID, interaction.Token, "🧹 **1** message successfully deleted.", true)
		return
	}

	if err := s.bulkDeleteMessages(channelID, botToken, deletableIDs); err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Bulk delete failed: %v", err), true)
		return
	}

	s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("🧹 Successfully deleted **%d** messages.", len(deletableIDs)), true)
}

// handleGiveawayCommand launches an interactive giveaway.
func (s *DiscordBotService) handleGiveawayCommand(interaction FullInteraction, discordUserID, discordUsername, botToken string) {
	prize := getOptionString(interaction.Data.Options, "prize")
	if prize == "" {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Please provide a prize: `/giveaway prize:Nitro duration:1h`", true)
		return
	}

	durationStr := getOptionString(interaction.Data.Options, "duration")
	if durationStr == "" {
		durationStr = "10m"
	}
	duration := parseDurationString(durationStr)
	if duration < 10*time.Second {
		duration = 10 * time.Second
	}
	if duration > 30*24*time.Hour {
		duration = 30 * 24 * time.Hour
	}

	winnersCount := getOptionInt(interaction.Data.Options, "winners", 1)
	if winnersCount < 1 {
		winnersCount = 1
	}
	if winnersCount > 20 {
		winnersCount = 20
	}

	endsAt := time.Now().Add(duration)

	giveaway := models.DiscordGiveaway{
		GuildID:      interaction.GuildID,
		ChannelID:    interaction.ChannelID,
		Prize:        prize,
		WinnersCount: winnersCount,
		HostID:       discordUserID,
		HostUsername: discordUsername,
		EndsAt:       endsAt,
		Ended:        false,
		Entries:      "[]",
		Winners:      "[]",
	}

	if err := s.db.Create(&giveaway).Error; err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Failed to save giveaway in database.", true)
		return
	}

	embed := map[string]interface{}{
		"title":       "🎉 GIVEAWAY: " + prize,
		"description": fmt.Sprintf("Click the button below to enter!\n\n🎁 **Prize:** %s\n👑 **Host:** <@%s>\n🏆 **Winners:** %d\n👥 **Entries:** 0\n⏰ **Ends:** <t:%d:R> (<t:%d:F>)", prize, discordUserID, winnersCount, endsAt.Unix(), endsAt.Unix()),
		"color":       0x5865F2,
		"footer": map[string]interface{}{
			"text": fmt.Sprintf("PteroNext Giveaway • ID: %d", giveaway.ID),
		},
		"timestamp": endsAt.Format(time.RFC3339),
	}

	components := []map[string]interface{}{
		{
			"type": 1, // ActionRow
			"components": []map[string]interface{}{
				{
					"type":      2, // Button
					"style":     3, // Success / Green
					"label":     "🎉 Enter (0)",
					"custom_id": fmt.Sprintf("giveaway_enter:%d", giveaway.ID),
				},
			},
		},
	}

	msgID, err := s.postChannelMessage(interaction.ChannelID, botToken, "", embed, components)
	if err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Failed to send giveaway message: %v", err), true)
		return
	}

	giveaway.MessageID = msgID
	s.db.Save(&giveaway)

	s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("🎉 Giveaway for **%s** successfully started!", prize), true)
}

// handleGiveawayButton handles user clicks on the giveaway entry button.
func (s *DiscordBotService) handleGiveawayButton(interaction FullInteraction, discordUserID, botToken string) {
	customID := interaction.Data.CustomID
	parts := strings.Split(customID, ":")
	if len(parts) < 2 {
		return
	}
	giveawayID, err := strconv.Atoi(parts[1])
	if err != nil {
		return
	}

	var giveaway models.DiscordGiveaway
	if err := s.db.First(&giveaway, giveawayID).Error; err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Giveaway not found.", true)
		return
	}

	if giveaway.Ended || time.Now().After(giveaway.EndsAt) {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ This giveaway has already ended.", true)
		return
	}

	var entries []string
	if giveaway.Entries != "" {
		_ = json.Unmarshal([]byte(giveaway.Entries), &entries)
	}

	for _, id := range entries {
		if id == discordUserID {
			s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("ℹ️ You have already entered the giveaway for **%s**! 🍀", giveaway.Prize), true)
			return
		}
	}

	entries = append(entries, discordUserID)
	updatedJSON, _ := json.Marshal(entries)
	giveaway.Entries = string(updatedJSON)
	s.db.Save(&giveaway)

	s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("🎉 You have entered the giveaway for **%s**! Good luck! 🍀", giveaway.Prize), true)

	// Update the giveaway message with new participant count
	go func(gw models.DiscordGiveaway, count int) {
		embed := map[string]interface{}{
			"title":       "🎉 GIVEAWAY: " + gw.Prize,
			"description": fmt.Sprintf("Click the button below to enter!\n\n🎁 **Prize:** %s\n👑 **Host:** <@%s>\n🏆 **Winners:** %d\n👥 **Entries:** %d\n⏰ **Ends:** <t:%d:R> (<t:%d:F>)", gw.Prize, gw.HostID, gw.WinnersCount, count, gw.EndsAt.Unix(), gw.EndsAt.Unix()),
			"color":       0x5865F2,
			"footer": map[string]interface{}{
				"text": fmt.Sprintf("PteroNext Giveaway • ID: %d", gw.ID),
			},
			"timestamp": gw.EndsAt.Format(time.RFC3339),
		}

		components := []map[string]interface{}{
			{
				"type": 1,
				"components": []map[string]interface{}{
					{
						"type":      2,
						"style":     3,
						"label":     fmt.Sprintf("🎉 Enter (%d)", count),
						"custom_id": fmt.Sprintf("giveaway_enter:%d", gw.ID),
					},
				},
			},
		}
		_ = s.editChannelMessage(gw.ChannelID, gw.MessageID, botToken, "", embed, components)
	}(giveaway, len(entries))
}

// checkExpiredGiveaways reviews all active giveaways and draws winners for those that have elapsed.
func (s *DiscordBotService) checkExpiredGiveaways() {
	var expired []models.DiscordGiveaway
	if err := s.db.Where("ended = ? AND ends_at <= ?", false, time.Now()).Find(&expired).Error; err != nil || len(expired) == 0 {
		return
	}

	var tokenSetting models.SystemSetting
	s.db.Where("key = 'discord_bot_token'").First(&tokenSetting)
	botToken := strings.TrimSpace(tokenSetting.Value)
	if botToken == "" {
		return
	}

	for _, gw := range expired {
		gw.Ended = true

		var entries []string
		if gw.Entries != "" {
			_ = json.Unmarshal([]byte(gw.Entries), &entries)
		}

		if len(entries) == 0 {
			gw.Winners = "[]"
			s.db.Save(&gw)

			embed := map[string]interface{}{
				"title":       "🎉 [ENDED] " + gw.Prize,
				"description": fmt.Sprintf("🎁 **Prize:** %s\n👑 **Host:** <@%s>\n\n❌ **No Winners:** There were no participants!", gw.Prize, gw.HostID),
				"color":       0x95A5A6, // Grey
				"footer": map[string]interface{}{
					"text": fmt.Sprintf("PteroNext Giveaway • ID: %d • Ended", gw.ID),
				},
			}
			components := []map[string]interface{}{
				{
					"type": 1,
					"components": []map[string]interface{}{
						{
							"type":      2,
							"style":     2, // Secondary / Grey
							"label":     "Ended (0 Entries)",
							"custom_id": fmt.Sprintf("giveaway_ended:%d", gw.ID),
							"disabled":  true,
						},
					},
				},
			}
			_ = s.editChannelMessage(gw.ChannelID, gw.MessageID, botToken, "", embed, components)
			announcement := fmt.Sprintf("📢 **Giveaway ended for '%s'**: There were unfortunately no participants! 😢", gw.Prize)
			_, _ = s.postChannelMessage(gw.ChannelID, botToken, announcement, nil, nil)
			continue
		}

		// Pick winners
		shuffled := make([]string, len(entries))
		copy(shuffled, entries)
		rand.Shuffle(len(shuffled), func(i, j int) {
			shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
		})

		winCount := gw.WinnersCount
		if winCount > len(shuffled) {
			winCount = len(shuffled)
		}
		winners := shuffled[:winCount]
		wJSON, _ := json.Marshal(winners)
		gw.Winners = string(wJSON)
		s.db.Save(&gw)

		var winnerMentions []string
		for _, w := range winners {
			winnerMentions = append(winnerMentions, fmt.Sprintf("<@%s>", w))
		}
		winnerStr := strings.Join(winnerMentions, ", ")

		embed := map[string]interface{}{
			"title":       "🎉 [ENDED] " + gw.Prize,
			"description": fmt.Sprintf("🎁 **Prize:** %s\n👑 **Host:** <@%s>\n👥 **Entries:** %d\n\n🏆 **Winner(s):** %s", gw.Prize, gw.HostID, len(entries), winnerStr),
			"color":       0xF1C40F, // Gold
			"footer": map[string]interface{}{
				"text": fmt.Sprintf("PteroNext Giveaway • ID: %d • Ended", gw.ID),
			},
		}
		components := []map[string]interface{}{
			{
				"type": 1,
				"components": []map[string]interface{}{
					{
						"type":      2,
						"style":     2,
						"label":     fmt.Sprintf("Ended (%d Entries)", len(entries)),
						"custom_id": fmt.Sprintf("giveaway_ended:%d", gw.ID),
						"disabled":  true,
					},
				},
			},
		}
		_ = s.editChannelMessage(gw.ChannelID, gw.MessageID, botToken, "", embed, components)

		announcement := fmt.Sprintf("🎉 **CONGRATULATIONS!** 🎉\n\nThe giveaway for **%s** has ended!\n🏆 **Winner(s):** %s\nPlease contact <@%s> to claim your prize! 🎁", gw.Prize, winnerStr, gw.HostID)
		_, _ = s.postChannelMessage(gw.ChannelID, botToken, announcement, nil, nil)
	}
}

// handlePollCommand creates an interactive poll with vote buttons.
func (s *DiscordBotService) handlePollCommand(interaction FullInteraction, discordUserID, discordUsername, botToken string) {
	question := getOptionString(interaction.Data.Options, "question")
	opt1 := getOptionString(interaction.Data.Options, "option1")
	opt2 := getOptionString(interaction.Data.Options, "option2")
	opt3 := getOptionString(interaction.Data.Options, "option3")
	opt4 := getOptionString(interaction.Data.Options, "option4")

	if question == "" || opt1 == "" || opt2 == "" {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ A poll requires a question and at least two options.", true)
		return
	}

	var options []string
	options = append(options, opt1, opt2)
	if opt3 != "" {
		options = append(options, opt3)
	}
	if opt4 != "" {
		options = append(options, opt4)
	}

	optionsJSON, _ := json.Marshal(options)

	poll := models.DiscordPoll{
		GuildID:         interaction.GuildID,
		ChannelID:       interaction.ChannelID,
		Question:        question,
		Options:         string(optionsJSON),
		Votes:           "{}",
		CreatorID:       discordUserID,
		CreatorUsername: discordUsername,
	}

	if err := s.db.Create(&poll).Error; err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Failed to create poll in database.", true)
		return
	}

	embed, components := BuildPollEmbedAndComponents(poll)
	msgID, err := s.postChannelMessage(interaction.ChannelID, botToken, "", embed, components)
	if err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, fmt.Sprintf("❌ Failed to send poll: %v", err), true)
		return
	}

	poll.MessageID = msgID
	s.db.Save(&poll)

	s.sendInteractionResponse(interaction.ID, interaction.Token, "📊 Poll successfully started in channel!", true)
}

// handlePollButton records or updates a user's vote and re-renders the live poll message atomically.
func (s *DiscordBotService) handlePollButton(interaction FullInteraction, discordUserID, botToken string) {
	if discordUserID == "" {
		if interaction.Member != nil && interaction.Member.User.ID != "" {
			discordUserID = interaction.Member.User.ID
		} else if interaction.User != nil && interaction.User.ID != "" {
			discordUserID = interaction.User.ID
		}
	}

	customID := interaction.Data.CustomID
	log.Printf("[DISCORD-BOT] Poll vote button clicked: user=%s, customID=%s", discordUserID, customID)

	parts := strings.Split(customID, ":")
	if len(parts) < 3 {
		return
	}

	pollID, err1 := strconv.Atoi(parts[1])
	optIdx, err2 := strconv.Atoi(parts[2])
	if err1 != nil || err2 != nil {
		return
	}

	var poll models.DiscordPoll
	if err := s.db.First(&poll, pollID).Error; err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Poll not found.", true)
		return
	}

	var options []string
	if err := json.Unmarshal([]byte(poll.Options), &options); err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Failed to read poll options.", true)
		return
	}

	if optIdx < 0 || optIdx >= len(options) {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Invalid option.", true)
		return
	}

	votes := make(map[string]int)
	if poll.Votes != "" {
		_ = json.Unmarshal([]byte(poll.Votes), &votes)
	}

	currentVote, hasVoted := votes[discordUserID]
	if hasVoted && currentVote == optIdx {
		// Vote toggling: Remove vote
		delete(votes, discordUserID)
	} else {
		// Set or change vote
		votes[discordUserID] = optIdx
	}

	votesJSON, _ := json.Marshal(votes)
	poll.Votes = string(votesJSON)
	s.db.Save(&poll)

	emb, comp := BuildPollEmbedAndComponents(poll)
	if err := s.sendInteractionUpdate(interaction.ID, interaction.Token, emb, comp); err != nil {
		log.Printf("[DISCORD-BOT] Failed to update poll via interaction callback: %v, falling back to message edit", err)
		_ = s.editChannelMessage(poll.ChannelID, poll.MessageID, botToken, "", emb, comp)
	}
}

// BuildPollEmbedAndComponents renders live vote counts, percentage bars, and voting buttons.
func BuildPollEmbedAndComponents(poll models.DiscordPoll) (map[string]interface{}, []map[string]interface{}) {
	var options []string
	_ = json.Unmarshal([]byte(poll.Options), &options)

	votes := make(map[string]int)
	if poll.Votes != "" {
		_ = json.Unmarshal([]byte(poll.Votes), &votes)
	}

	counts := make([]int, len(options))
	for _, chosen := range votes {
		if chosen >= 0 && chosen < len(counts) {
			counts[chosen]++
		}
	}

	totalVotes := len(votes)

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("**%s**\n\n", poll.Question))

	emojis := []string{"1️⃣", "2️⃣", "3️⃣", "4️⃣"}

	for i, opt := range options {
		cnt := counts[i]
		pct := 0
		if totalVotes > 0 {
			pct = (cnt * 100) / totalVotes
		}
		bar := renderProgressBar(pct, 10)
		sb.WriteString(fmt.Sprintf("%s **%s**\n`[%s]` **%d%%** (%d votes)\n\n", emojis[i%len(emojis)], opt, bar, pct, cnt))
	}

	sb.WriteString(fmt.Sprintf("👥 **Total Votes:** %d • Created by <@%s>", totalVotes, poll.CreatorID))

	embed := map[string]interface{}{
		"title":       "📊 Community Poll",
		"description": sb.String(),
		"color":       0x3498DB, // Blue
		"footer": map[string]interface{}{
			"text": fmt.Sprintf("PteroNext Community Poll • ID: %d", poll.ID),
		},
		"timestamp": poll.CreatedAt.Format(time.RFC3339),
	}

	var buttonComponents []map[string]interface{}
	for i, opt := range options {
		label := fmt.Sprintf("%s %s", emojis[i%len(emojis)], opt)
		if len(label) > 80 {
			label = label[:77] + "..."
		}
		buttonComponents = append(buttonComponents, map[string]interface{}{
			"type":      2, // Button
			"style":     1, // Primary (Blurple)
			"label":     label,
			"custom_id": fmt.Sprintf("poll_vote:%d:%d", poll.ID, i),
		})
	}

	components := []map[string]interface{}{
		{
			"type":       1, // ActionRow
			"components": buttonComponents,
		},
	}

	return embed, components
}

// handleUserInfoCommand responds with a detailed Discord member and linked panel inspection embed.
func (s *DiscordBotService) handleUserInfoCommand(interaction FullInteraction, discordUserID, botToken string) {
	targetID := getOptionString(interaction.Data.Options, "user")
	if targetID == "" {
		targetID = discordUserID
	}

	// Fetch guild member from Discord API
	url := fmt.Sprintf("https://discord.com/api/v10/guilds/%s/members/%s", interaction.GuildID, targetID)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)

	type memberResp struct {
		User struct {
			ID            string `json:"id"`
			Username      string `json:"username"`
			Discriminator string `json:"discriminator"`
			Avatar        string `json:"avatar"`
			Bot           bool   `json:"bot"`
		} `json:"user"`
		Nick     string   `json:"nick"`
		Roles    []string `json:"roles"`
		JoinedAt string   `json:"joined_at"`
	}

	var member memberResp
	if err == nil && resp.StatusCode == http.StatusOK {
		_ = json.NewDecoder(resp.Body).Decode(&member)
		resp.Body.Close()
	} else {
		// Fallback to fetch generic user
		userURL := fmt.Sprintf("https://discord.com/api/v10/users/%s", targetID)
		uReq, _ := http.NewRequest("GET", userURL, nil)
		uReq.Header.Set("Authorization", "Bot "+botToken)
		uReq.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")
		if uResp, uErr := client.Do(uReq); uErr == nil && uResp.StatusCode == http.StatusOK {
			_ = json.NewDecoder(uResp.Body).Decode(&member.User)
			uResp.Body.Close()
		}
	}

	username := member.User.Username
	if username == "" {
		username = targetID
	}
	avatarURL := getAvatarURL(targetID, member.User.Avatar)

	createdTime := getSnowflakeTime(targetID)
	createdStr := "Unknown"
	if !createdTime.IsZero() {
		createdStr = fmt.Sprintf("<t:%d:R> (<t:%d:F>)", createdTime.Unix(), createdTime.Unix())
	}

	joinedStr := "Not in server or unknown"
	if member.JoinedAt != "" {
		if t, parseErr := time.Parse(time.RFC3339, member.JoinedAt); parseErr == nil {
			joinedStr = fmt.Sprintf("<t:%d:R> (<t:%d:F>)", t.Unix(), t.Unix())
		}
	}

	var rolesStr string
	if len(member.Roles) > 0 {
		var roleTags []string
		for i, r := range member.Roles {
			if i >= 10 {
				roleTags = append(roleTags, fmt.Sprintf("+%d more", len(member.Roles)-10))
				break
			}
			roleTags = append(roleTags, fmt.Sprintf("<@&%s>", r))
		}
		rolesStr = strings.Join(roleTags, " ")
	} else {
		rolesStr = "No roles"
	}

	// PteroNext panel link status
	var panelUser models.User
	panelStatus := "❌ Not linked (use `/link`)"
	if err := s.db.Where("discord_id = ?", targetID).First(&panelUser).Error; err == nil && panelUser.ID > 0 {
		var srvCount int64
		s.db.Model(&models.Server{}).Where("owner_id = ?", panelUser.ID).Count(&srvCount)
		adminStr := "No"
		if panelUser.RootAdmin {
			adminStr = "Yes (Root Admin)"
		}
		panelStatus = fmt.Sprintf("✅ Linked to **%s**\n👑 Administrator: %s\n🖥️ Owned Servers: %d", panelUser.Username, adminStr, srvCount)
	}

	// XP & Level info
	var userXP models.DiscordUserXP
	xpInfo := "Level 0 • 0 XP (No activity yet)"
	if err := s.db.Where("guild_id = ? AND user_id = ?", interaction.GuildID, targetID).First(&userXP).Error; err == nil && userXP.ID > 0 {
		var rankPosition int64
		s.db.Model(&models.DiscordUserXP{}).Where("guild_id = ? AND xp > ?", interaction.GuildID, userXP.XP).Count(&rankPosition)
		xpInfo = fmt.Sprintf("⭐ Level: **%d** (Rank #%d)\n✨ XP: **%d**\n💬 Messages: **%d**", userXP.Level, rankPosition+1, userXP.XP, userXP.MessagesCount)
	}

	embed := map[string]interface{}{
		"title": fmt.Sprintf("👤 User Profile: %s", username),
		"color": 0x5865F2,
		"thumbnail": map[string]interface{}{
			"url": avatarURL,
		},
		"fields": []map[string]interface{}{
			{
				"name":   "🆔 IDs",
				"value":  fmt.Sprintf("User: `<@%s>` (`%s`)", targetID, targetID),
				"inline": false,
			},
			{
				"name":   "📅 Account Created",
				"value":  createdStr,
				"inline": true,
			},
			{
				"name":   "📥 Joined Server",
				"value":  joinedStr,
				"inline": true,
			},
			{
				"name":   fmt.Sprintf("🛡️ Roles (%d)", len(member.Roles)),
				"value":  rolesStr,
				"inline": false,
			},
			{
				"name":   "🏆 Level & Activity",
				"value":  xpInfo,
				"inline": true,
			},
			{
				"name":   "🎮 PteroNext Panel",
				"value":  panelStatus,
				"inline": true,
			},
		},
		"footer": map[string]interface{}{
			"text": "PteroNext Discord Bot Telemetry",
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}

	s.sendInteractionResponseWithEmbed(interaction.ID, interaction.Token, embed, false)
}

// handleServerInfoCommand responds with detailed Discord guild stats and panel status.
func (s *DiscordBotService) handleServerInfoCommand(interaction FullInteraction, botToken string) {
	url := fmt.Sprintf("https://discord.com/api/v10/guilds/%s?with_counts=true", interaction.GuildID)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Failed to fetch server information.", true)
		return
	}
	defer resp.Body.Close()

	var guild struct {
		ID                       string        `json:"id"`
		Name                     string        `json:"name"`
		Icon                     string        `json:"icon"`
		OwnerID                  string        `json:"owner_id"`
		ApproximateMemberCount   int           `json:"approximate_member_count"`
		ApproximatePresenceCount int           `json:"approximate_presence_count"`
		PremiumTier              int           `json:"premium_tier"`
		PremiumSubscriptionCount int           `json:"premium_subscription_count"`
		Roles                    []DiscordRole `json:"roles"`
		Description              string        `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&guild); err != nil {
		s.sendInteractionResponse(interaction.ID, interaction.Token, "❌ Failed to process server data.", true)
		return
	}

	createdTime := getSnowflakeTime(guild.ID)
	createdStr := "Unknown"
	if !createdTime.IsZero() {
		createdStr = fmt.Sprintf("<t:%d:R> (<t:%d:F>)", createdTime.Unix(), createdTime.Unix())
	}

	var iconURL string
	if guild.Icon != "" {
		iconURL = fmt.Sprintf("https://cdn.discordapp.com/icons/%s/%s.png", guild.ID, guild.Icon)
	}

	var panelServerCount int64
	s.db.Model(&models.Server{}).Count(&panelServerCount)

	var linkedMembersCount int64
	s.db.Model(&models.User{}).Where("discord_id != ''").Count(&linkedMembersCount)

	embed := map[string]interface{}{
		"title":       fmt.Sprintf("🌐 Server Information: %s", guild.Name),
		"color":       0x5865F2,
		"description": guild.Description,
		"thumbnail": map[string]interface{}{
			"url": iconURL,
		},
		"fields": []map[string]interface{}{
			{
				"name":   "🆔 Server ID",
				"value":  fmt.Sprintf("`%s`", guild.ID),
				"inline": true,
			},
			{
				"name":   "👑 Owner",
				"value":  fmt.Sprintf("<@%s>", guild.OwnerID),
				"inline": true,
			},
			{
				"name":   "📅 Created On",
				"value":  createdStr,
				"inline": false,
			},
			{
				"name":   "👥 Members",
				"value":  fmt.Sprintf("Total: **%d** • 🟢 Online: **%d**", guild.ApproximateMemberCount, guild.ApproximatePresenceCount),
				"inline": true,
			},
			{
				"name":   "🚀 Server Boosts",
				"value":  fmt.Sprintf("Tier **%d** (%d Boosts)", guild.PremiumTier, guild.PremiumSubscriptionCount),
				"inline": true,
			},
			{
				"name":   "🛡️ Roles",
				"value":  fmt.Sprintf("**%d** roles configured", len(guild.Roles)),
				"inline": true,
			},
			{
				"name":   "⚡ PteroNext Panel",
				"value":  fmt.Sprintf("🖥️ **%d** game servers active\n🔗 **%d** linked Discord accounts", panelServerCount, linkedMembersCount),
				"inline": false,
			},
		},
		"footer": map[string]interface{}{
			"text": "PteroNext Guild Diagnostics",
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}

	s.sendInteractionResponseWithEmbed(interaction.ID, interaction.Token, embed, false)
}

// handleRankCommand renders a visual XP card for the user or target member.
func (s *DiscordBotService) handleRankCommand(interaction FullInteraction, discordUserID, botToken string) {
	targetID := getOptionString(interaction.Data.Options, "user")
	if targetID == "" {
		targetID = discordUserID
	}

	var userXP models.DiscordUserXP
	err := s.db.Where("guild_id = ? AND user_id = ?", interaction.GuildID, targetID).First(&userXP).Error
	if err != nil {
		userXP = models.DiscordUserXP{
			GuildID:  interaction.GuildID,
			UserID:   targetID,
			Username: "Member",
			XP:       0,
			Level:    0,
		}
	}

	var higherCount int64
	s.db.Model(&models.DiscordUserXP{}).Where("guild_id = ? AND xp > ?", interaction.GuildID, userXP.XP).Count(&higherCount)
	userRank := higherCount + 1

	currBase := RequiredXPForLevel(userXP.Level)
	nextBase := RequiredXPForLevel(userXP.Level + 1)
	pct := 0
	if nextBase > currBase {
		pct = int(((userXP.XP - currBase) * 100) / (nextBase - currBase))
	}
	if pct < 0 {
		pct = 0
	}
	if pct > 100 {
		pct = 100
	}

	bar := renderProgressBar(pct, 14)
	avatarURL := getAvatarURL(targetID, userXP.Avatar)

	embed := map[string]interface{}{
		"title": fmt.Sprintf("🎖️ Rank Card: %s", userXP.Username),
		"color": 0x5865F2,
		"thumbnail": map[string]interface{}{
			"url": avatarURL,
		},
		"fields": []map[string]interface{}{
			{
				"name":   "📊 Rank",
				"value":  fmt.Sprintf("#**%d**", userRank),
				"inline": true,
			},
			{
				"name":   "⭐ Level",
				"value":  fmt.Sprintf("**%d**", userXP.Level),
				"inline": true,
			},
			{
				"name":   "💬 Messages",
				"value":  fmt.Sprintf("**%d**", userXP.MessagesCount),
				"inline": true,
			},
			{
				"name":   "✨ XP Progress",
				"value":  fmt.Sprintf("%d / %d XP (Total: **%d** XP)", userXP.XP, nextBase, userXP.XP),
				"inline": false,
			},
			{
				"name":   fmt.Sprintf("Progress to Level %d (%d%%)", userXP.Level+1, pct),
				"value":  fmt.Sprintf("`[%s]`", bar),
				"inline": false,
			},
		},
		"footer": map[string]interface{}{
			"text": "PteroNext Level & Chat XP",
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}

	s.sendInteractionResponseWithEmbed(interaction.ID, interaction.Token, embed, false)
}

// handleLeaderboardCommand shows the Top 10 most active members on the Discord server.
func (s *DiscordBotService) handleLeaderboardCommand(interaction FullInteraction, botToken string) {
	var topUsers []models.DiscordUserXP
	s.db.Where("guild_id = ?", interaction.GuildID).Order("xp DESC").Limit(10).Find(&topUsers)

	var sb strings.Builder
	sb.WriteString("🏆 **Top 10 Most Active Chat Members**\n\n")

	if len(topUsers) == 0 {
		sb.WriteString("ℹ️ No chat XP has been earned on this server yet.\nBe the first and send a message!")
	} else {
		for i, u := range topUsers {
			medal := fmt.Sprintf("`#%d`", i+1)
			if i == 0 {
				medal = "🥇"
			} else if i == 1 {
				medal = "🥈"
			} else if i == 2 {
				medal = "🥉"
			}
			name := u.Username
			if name == "" {
				name = fmt.Sprintf("User %s", u.UserID)
			}
			sb.WriteString(fmt.Sprintf("%s **<@%s>** (`%s`)\n   ⭐ Level **%d** • ✨ **%d** XP (%d messages)\n\n",
				medal, u.UserID, name, u.Level, u.XP, u.MessagesCount))
		}
	}

	embed := map[string]interface{}{
		"title":       "📊 Discord XP Leaderboard",
		"description": sb.String(),
		"color":       0xF1C40F, // Gold
		"footer": map[string]interface{}{
			"text": "PteroNext Level System • 60s Chat Cooldown",
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}

	s.sendInteractionResponseWithEmbed(interaction.ID, interaction.Token, embed, false)
}

// handleMessageCreate awards chat XP, enforces 60s cooldown, checks level milestones, and auto-provisions roles.
func (s *DiscordBotService) handleMessageCreate(raw json.RawMessage, botToken string) {
	var msg struct {
		ID        string `json:"id"`
		ChannelID string `json:"channel_id"`
		GuildID   string `json:"guild_id"`
		Content   string `json:"content"`
		Author    struct {
			ID            string `json:"id"`
			Username      string `json:"username"`
			Discriminator string `json:"discriminator"`
			Avatar        string `json:"avatar"`
			Bot           bool   `json:"bot"`
		} `json:"author"`
	}

	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	// Ignore bots or messages without GuildID (DMs)
	if msg.Author.Bot || strings.TrimSpace(msg.GuildID) == "" || strings.TrimSpace(msg.Author.ID) == "" {
		return
	}

	guildID := msg.GuildID
	userID := msg.Author.ID
	username := msg.Author.Username
	avatar := msg.Author.Avatar

	var userXP models.DiscordUserXP
	err := s.db.Where("guild_id = ? AND user_id = ?", guildID, userID).First(&userXP).Error
	if err != nil {
		userXP = models.DiscordUserXP{
			GuildID:       guildID,
			UserID:        userID,
			Username:      username,
			Avatar:        avatar,
			XP:            0,
			Level:         0,
			MessagesCount: 0,
		}
	}

	// 60-second cooldown check
	if !userXP.LastXPAT.IsZero() && time.Since(userXP.LastXPAT) < 60*time.Second {
		// In cooldown: increment message count only
		s.db.Model(&userXP).Update("messages_count", gorm.Expr("messages_count + 1"))
		return
	}

	// Award random XP between 15 and 25
	awardedXP := int64(15 + rand.Intn(11))
	oldLevel := userXP.Level
	newXP := userXP.XP + awardedXP
	newLevel := CalculateLevel(newXP)

	userXP.XP = newXP
	userXP.Level = newLevel
	userXP.MessagesCount++
	userXP.LastXPAT = time.Now()
	userXP.Username = username
	userXP.Avatar = avatar

	if userXP.ID == 0 {
		s.db.Create(&userXP)
	} else {
		s.db.Save(&userXP)
	}

	// Check for Level Up!
	if newLevel > oldLevel {
		log.Printf("[DISCORD-BOT] User %s (%s) leveled up from Level %d to %d in guild %s", username, userID, oldLevel, newLevel, guildID)

		// Check milestone level roles (Level 5, Level 10, Level 20, Level 30, Level 50)
		milestones := []int{5, 10, 20, 30, 50}
		var assignedRoles []string

		for _, m := range milestones {
			if oldLevel < m && newLevel >= m {
				roleName, err := s.ensureAndAssignLevelRole(guildID, userID, m, botToken)
				if err == nil && roleName != "" {
					assignedRoles = append(assignedRoles, roleName)
				}
			}
		}

		// Send level up announcement in the channel where user was chatting
		var announcement string
		if len(assignedRoles) > 0 {
			var roleTags []string
			for _, r := range assignedRoles {
				roleTags = append(roleTags, fmt.Sprintf("**%s**", r))
			}
			announcement = fmt.Sprintf("🎉 **CONGRATULATIONS!** <@%s> leveled up to **Level %d**! 🚀\n🎖️ **New Discord role(s) unlocked:** %s", userID, newLevel, strings.Join(roleTags, ", "))
		} else {
			announcement = fmt.Sprintf("🎉 **CONGRATULATIONS!** <@%s> leveled up to **Level %d**! 🚀", userID, newLevel)
		}

		embed := map[string]interface{}{
			"title":       "✨ Level Up!",
			"description": announcement,
			"color":       0x00FF88, // Emerald green
			"thumbnail": map[string]interface{}{
				"url": getAvatarURL(userID, avatar),
			},
			"footer": map[string]interface{}{
				"text": fmt.Sprintf("PteroNext XP System • %d total XP", newXP),
			},
		}

		_, _ = s.postChannelMessage(msg.ChannelID, botToken, "", embed, nil)
	}
}

// ensureAndAssignLevelRole checks if the level role exists on the Discord server;
// if it does NOT exist, creates the role via Discord API (POST /guilds/{guild_id}/roles)
// and assigns it to the user (PUT /guilds/{guild_id}/members/{user_id}/roles/{role_id}).
func (s *DiscordBotService) ensureAndAssignLevelRole(guildID, userID string, milestone int, botToken string) (string, error) {
	roleName := fmt.Sprintf("Level %d", milestone)
	color := 0x3498DB
	switch milestone {
	case 5:
		color = 0x3498DB // Blue
	case 10:
		color = 0x2ECC71 // Green
	case 20:
		color = 0xF1C40F // Gold
	case 30:
		color = 0xE67E22 // Orange
	case 50:
		color = 0x9B59B6 // Purple
	}

	// 1. Fetch guild roles from Discord API
	roles, err := s.GetGuildRoles(guildID, botToken)
	if err != nil {
		log.Printf("[DISCORD-BOT] Error fetching guild roles for guild %s: %v", guildID, err)
		return "", err
	}

	var targetRoleID string
	for _, r := range roles {
		if strings.EqualFold(strings.TrimSpace(r.Name), roleName) {
			targetRoleID = r.ID
			break
		}
	}

	// 2. If role does NOT exist on Discord server, create it via Discord API!
	if targetRoleID == "" {
		log.Printf("[DISCORD-BOT] Level role '%s' not found on guild %s. Automatically creating role via Discord API...", roleName, guildID)
		createdRole, err := s.createGuildRole(guildID, botToken, roleName, color)
		if err != nil {
			log.Printf("[DISCORD-BOT] Failed to automatically create role '%s' on guild %s: %v", roleName, guildID, err)
			return "", err
		}
		targetRoleID = createdRole.ID
		log.Printf("[DISCORD-BOT] Successfully created role '%s' on guild %s with ID %s", roleName, guildID, targetRoleID)
	}

	// 3. Save or update mapping in DiscordLevelRole DB table
	var dbLvlRole models.DiscordLevelRole
	if err := s.db.Where("guild_id = ? AND level = ?", guildID, milestone).First(&dbLvlRole).Error; err != nil {
		s.db.Create(&models.DiscordLevelRole{
			GuildID:  guildID,
			Level:    milestone,
			RoleID:   targetRoleID,
			RoleName: roleName,
			Color:    color,
		})
	} else {
		s.db.Model(&dbLvlRole).Updates(map[string]interface{}{
			"role_id":   targetRoleID,
			"role_name": roleName,
			"color":     color,
		})
	}

	// 4. Assign role to user via Discord API PUT /guilds/{guild_id}/members/{user_id}/roles/{role_id}
	if err := s.assignGuildRole(guildID, userID, targetRoleID, botToken); err != nil {
		log.Printf("[DISCORD-BOT] Failed to assign level role '%s' (ID %s) to user %s: %v", roleName, targetRoleID, userID, err)
		return roleName, err
	}

	log.Printf("[DISCORD-BOT] Successfully assigned level role '%s' (ID %s) to user %s in guild %s", roleName, targetRoleID, userID, guildID)
	return roleName, nil
}

// createGuildRole creates a new role on the target Discord server.
func (s *DiscordBotService) createGuildRole(guildID, botToken, name string, color int) (*DiscordRole, error) {
	url := fmt.Sprintf("https://discord.com/api/v10/guilds/%s/roles", guildID)
	payload := map[string]interface{}{
		"name":        name,
		"color":       color,
		"hoist":       false,
		"mentionable": false,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("discord API error creating role (%d): %s", resp.StatusCode, string(respBody))
	}

	var created DiscordRole
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		return nil, err
	}
	return &created, nil
}

// assignGuildRole assigns a role to a member on the target Discord server.
func (s *DiscordBotService) assignGuildRole(guildID, userID, roleID, botToken string) error {
	url := fmt.Sprintf("https://discord.com/api/v10/guilds/%s/members/%s/roles/%s", guildID, userID, roleID)
	req, err := http.NewRequest("PUT", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("discord API error assigning role (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// postChannelMessage sends a new message to a channel with optional embeds and components.
func (s *DiscordBotService) postChannelMessage(channelID, botToken, content string, embed map[string]interface{}, components []map[string]interface{}) (string, error) {
	url := fmt.Sprintf("https://discord.com/api/v10/channels/%s/messages", channelID)
	payload := make(map[string]interface{})
	if content != "" {
		payload["content"] = content
	}
	if embed != nil {
		payload["embeds"] = []map[string]interface{}{embed}
	}
	if len(components) > 0 {
		payload["components"] = components
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to post channel message (%d): %s", resp.StatusCode, string(respBody))
	}

	var res struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&res)
	return res.ID, nil
}

// editChannelMessage edits an existing channel message.
func (s *DiscordBotService) editChannelMessage(channelID, messageID, botToken, content string, embed map[string]interface{}, components []map[string]interface{}) error {
	url := fmt.Sprintf("https://discord.com/api/v10/channels/%s/messages/%s", channelID, messageID)
	payload := make(map[string]interface{})
	if content != "" {
		payload["content"] = content
	}
	if embed != nil {
		payload["embeds"] = []map[string]interface{}{embed}
	}
	if components != nil {
		payload["components"] = components
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to edit channel message (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// deleteSingleMessage deletes an individual message.
func (s *DiscordBotService) deleteSingleMessage(channelID, messageID, botToken string) error {
	url := fmt.Sprintf("https://discord.com/api/v10/channels/%s/messages/%s", channelID, messageID)
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete message (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// bulkDeleteMessages deletes multiple messages (up to 100) within 14 days.
func (s *DiscordBotService) bulkDeleteMessages(channelID, botToken string, messageIDs []string) error {
	url := fmt.Sprintf("https://discord.com/api/v10/channels/%s/messages/bulk-delete", channelID)
	payload := map[string]interface{}{
		"messages": messageIDs,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to bulk delete messages (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// sendInteractionResponse sends an immediate textual response to a Discord Interaction webhook.
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

// sendInteractionResponseWithEmbed sends an immediate Embed response to a Discord Interaction.
func (s *DiscordBotService) sendInteractionResponseWithEmbed(interactionID, interactionToken string, embed map[string]interface{}, ephemeral bool) {
	flags := 0
	if ephemeral {
		flags = 64 // EPHEMERAL
	}

	payload := map[string]interface{}{
		"type": 4, // CHANNEL_MESSAGE_WITH_SOURCE
		"data": map[string]interface{}{
			"flags":  flags,
			"embeds": []map[string]interface{}{embed},
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

// sendInteractionUpdate sends a callback payload with Type 7 (UPDATE_MESSAGE) to atomically update a message on button click.
func (s *DiscordBotService) sendInteractionUpdate(interactionID, interactionToken string, embed map[string]interface{}, components []map[string]interface{}) error {
	payload := map[string]interface{}{
		"type": 7, // UPDATE_MESSAGE
		"data": map[string]interface{}{
			"embeds":     []map[string]interface{}{embed},
			"components": components,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[DISCORD-BOT] Error marshaling interaction update payload: %v", err)
		return err
	}
	url := fmt.Sprintf("https://discord.com/api/v10/interactions/%s/%s/callback", interactionID, interactionToken)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("[DISCORD-BOT] Error creating interaction update request: %v", err)
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PteroNext-Panel (v2.9.0)")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[DISCORD-BOT] Failed to send interaction update: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("[DISCORD-BOT] Discord interaction update HTTP error %d: %s", resp.StatusCode, string(respBody))
		return fmt.Errorf("discord API error: status %d", resp.StatusCode)
	}

	return nil
}

// --- Helper Functions ---

// RequiredXPForLevel returns total accumulated XP required to reach a specific level.
func RequiredXPForLevel(level int) int64 {
	if level <= 0 {
		return 0
	}
	return int64(50*level*level + 50*level)
}

// CalculateLevel computes the current level from total accumulated XP.
func CalculateLevel(totalXP int64) int {
	if totalXP <= 0 {
		return 0
	}
	level := 0
	for {
		nextXP := RequiredXPForLevel(level + 1)
		if totalXP >= nextXP {
			level++
		} else {
			break
		}
	}
	return level
}

// renderProgressBar draws a Unicode progress bar.
func renderProgressBar(percent int, totalBlocks int) string {
	if totalBlocks <= 0 {
		totalBlocks = 10
	}
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}
	filled := (percent * totalBlocks) / 100
	if filled > totalBlocks {
		filled = totalBlocks
	}
	unfilled := totalBlocks - filled
	return strings.Repeat("█", filled) + strings.Repeat("░", unfilled)
}

// parseDurationString parses durations like "30s", "10m", "2h", "1d", "3d".
func parseDurationString(input string) time.Duration {
	input = strings.TrimSpace(strings.ToLower(input))
	if strings.HasSuffix(input, "d") {
		daysStr := strings.TrimSuffix(input, "d")
		if days, err := strconv.Atoi(daysStr); err == nil && days > 0 {
			return time.Duration(days) * 24 * time.Hour
		}
	}
	if d, err := time.ParseDuration(input); err == nil && d > 0 {
		return d
	}
	if mins, err := strconv.Atoi(input); err == nil && mins > 0 {
		return time.Duration(mins) * time.Minute
	}
	return 10 * time.Minute
}

// getSnowflakeTime calculates the creation time from a Discord snowflake ID.
func getSnowflakeTime(snowflake string) time.Time {
	id, err := strconv.ParseUint(strings.TrimSpace(snowflake), 10, 64)
	if err != nil {
		return time.Time{}
	}
	ms := (id >> 22) + 1420070400000
	return time.UnixMilli(int64(ms))
}

// getAvatarURL returns the user avatar URL or default fallback.
func getAvatarURL(userID, avatar string) string {
	if avatar != "" {
		return fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", userID, avatar)
	}
	var id uint64
	if u, err := strconv.ParseUint(userID, 10, 64); err == nil {
		id = u
	}
	index := (id >> 22) % 6
	return fmt.Sprintf("https://cdn.discordapp.com/embed/avatars/%d.png", index)
}

// getOption finds an option by name.
func getOption(options []InteractionOption, name string) *InteractionOption {
	for i := range options {
		if options[i].Name == name {
			return &options[i]
		}
	}
	return nil
}

// getOptionString returns the string value of an option.
func getOptionString(options []InteractionOption, name string) string {
	if opt := getOption(options, name); opt != nil {
		if str, ok := opt.Value.(string); ok {
			return strings.TrimSpace(str)
		}
	}
	return ""
}

// getOptionInt returns the integer value of an option.
func getOptionInt(options []InteractionOption, name string, defaultVal int) int {
	if opt := getOption(options, name); opt != nil {
		switch v := opt.Value.(type) {
		case float64:
			return int(v)
		case int:
			return v
		case int64:
			return int(v)
		case json.Number:
			if n, err := v.Int64(); err == nil {
				return int(n)
			}
		}
	}
	return defaultVal
}

// memberHasPermission checks a Discord permission bitfield string.
func memberHasPermission(permsStr string, permBit uint64) bool {
	if permsStr == "" {
		return false
	}
	val, err := strconv.ParseUint(permsStr, 10, 64)
	if err != nil {
		return false
	}
	// Administrator (0x8) overrides everything
	if val&0x8 != 0 {
		return true
	}
	return val&permBit != 0
}
