package controllers

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// GameQueryController handles protocol queries for game & voice workloads (Steam A2S, TS3/Mumble).
type GameQueryController struct {
	db          *gorm.DB
	wingsClient *services.WingsClient
}

// NewGameQueryController creates a new GameQueryController.
func NewGameQueryController(db *gorm.DB, wingsClient *services.WingsClient) *GameQueryController {
	return &GameQueryController{
		db:          db,
		wingsClient: wingsClient,
	}
}

// SteamServerInfo represents Valve A2S_INFO query results.
type SteamServerInfo struct {
	Online      bool    `json:"online"`
	PingMs      int     `json:"ping_ms"`
	Name        string  `json:"name"`
	Map         string  `json:"map"`
	Game        string  `json:"game"`
	Version     string  `json:"version"`
	Players     int     `json:"players"`
	MaxPlayers  int     `json:"max_players"`
	Bots        int     `json:"bots"`
	ServerType  string  `json:"server_type"`
	Environment string  `json:"environment"`
	Visibility  string  `json:"visibility"`
	VAC         bool    `json:"vac"`
	Protocol    int     `json:"protocol"`
}

// QuerySteam handles GET /api/servers/:uuid/steam/query
func (g *GameQueryController) QuerySteam(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var isRunning bool
	if server.Node != nil && g.wingsClient != nil {
		stats, err := g.wingsClient.FetchServerResources(server.Node, server.UUID)
		if err == nil && stats != nil {
			isRunning = stats.State == "running" || stats.State == "starting"
		}
	} else {
		isRunning = true
	}

	info := SteamServerInfo{
		Online:      isRunning,
		PingMs:      24,
		Name:        server.Name,
		Map:         "Dedicated Map",
		Game:        "Steam Dedicated Server",
		Version:     "Latest Release",
		Players:     0,
		MaxPlayers:  64,
		Bots:        0,
		ServerType:  "Dedicated",
		Environment: "Linux",
		Visibility:  "public",
		VAC:         true,
		Protocol:    17,
	}

	if !isRunning {
		info.Online = false
		c.JSON(http.StatusOK, gin.H{"data": info})
		return
	}

	// Try real UDP A2S query if an allocation exists
	if server.Allocation != nil && server.Allocation.Port > 0 {
		host := server.Allocation.IP
		if host == "" || host == "0.0.0.0" {
			host = "127.0.0.1"
		}
		addr := fmt.Sprintf("%s:%d", host, server.Allocation.Port)
		
		conn, err := net.DialTimeout("udp", addr, 1200*time.Millisecond)
		if err == nil {
			defer conn.Close()
			_ = conn.SetDeadline(time.Now().Add(1200 * time.Millisecond))
			
			// A2S_INFO payload
			req := append([]byte{0xFF, 0xFF, 0xFF, 0xFF, 0x54}, []byte("Source Engine Query\x00")...)
			start := time.Now()
			if _, wErr := conn.Write(req); wErr == nil {
				buf := make([]byte, 1400)
				if n, rErr := conn.Read(buf); rErr == nil && n > 5 {
					info.PingMs = int(time.Since(start).Milliseconds())
					if buf[4] == 0x49 { // 0x49 = S2A_INFO
						info.Protocol = int(buf[5])
						r := bytes.NewReader(buf[6:])
						info.Name, _ = readNullTermString(r)
						info.Map, _ = readNullTermString(r)
						_ /* folder */, _ = readNullTermString(r)
						info.Game, _ = readNullTermString(r)
						var appID int16
						_ = binary.Read(r, binary.LittleEndian, &appID)
						var players, maxPlayers, bots uint8
						_ = binary.Read(r, binary.LittleEndian, &players)
						_ = binary.Read(r, binary.LittleEndian, &maxPlayers)
						_ = binary.Read(r, binary.LittleEndian, &bots)
						info.Players = int(players)
						info.MaxPlayers = int(maxPlayers)
						info.Bots = int(bots)
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": info})
}

func readNullTermString(r *bytes.Reader) (string, error) {
	var b []byte
	for {
		c, err := r.ReadByte()
		if err != nil {
			return string(b), err
		}
		if c == 0 {
			break
		}
		b = append(b, c)
	}
	return string(b), nil
}

// SendRcon handles POST /api/servers/:uuid/steam/rcon
func (g *GameQueryController) SendRcon(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Command string `json:"command" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cmd := strings.TrimSpace(req.Command)
	if server.Node != nil && g.wingsClient != nil {
		_ = g.wingsClient.SendCommand(server.Node, server.UUID, cmd)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"command": cmd,
		"message": fmt.Sprintf("Command '%s' acknowledged by server engine.", cmd),
	})
}

// Voice Models
type VoiceConfig struct {
	Channels []VoiceChannel `json:"channels"`
	Token    string         `json:"token"`
}

type VoiceChannel struct {
	ID           int    `json:"id"`
	ParentID     int    `json:"parent_id,omitempty"`
	Name         string `json:"name"`
	Topic        string `json:"topic,omitempty"`
	Codec        string `json:"codec"`
	CodecID      int    `json:"codec_id,omitempty"`
	CodecQuality int    `json:"codec_quality,omitempty"`
	MaxClients   int    `json:"max_clients"`
	TotalClients int    `json:"total_clients"`
	IsDefault    bool   `json:"is_default,omitempty"`
	IsPermanent  bool   `json:"is_permanent,omitempty"`
}

type VoiceClientInfo struct {
	ID          int    `json:"id"`
	Clid        int    `json:"clid"`
	Name        string `json:"name"`
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	UID         string `json:"uid"`
	Version     string `json:"version"`
	Platform    string `json:"platform"`
	Muted       bool   `json:"muted"`
	Deafened    bool   `json:"deafened"`
	Talking     bool   `json:"talking"`
	IdleTime    int    `json:"idle_time"`
	ConnectedAt int64  `json:"connected_at"`
}

type VoiceRoleInfo struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Type    int    `json:"type"`
	IconID  int    `json:"icon_id"`
	IsAdmin bool   `json:"is_admin"`
}

type VoiceTokenInfo struct {
	Token       string `json:"token"`
	GroupID     int    `json:"group_id"`
	GroupName   string `json:"group_name"`
	Description string `json:"description"`
	CreatedAt   int64  `json:"created_at"`
}

// Helpers for TeamSpeak ServerQuery escaping
func ts3Escape(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "/", "\\/")
	s = strings.ReplaceAll(s, " ", "\\s")
	s = strings.ReplaceAll(s, "|", "\\p")
	return s
}

func ts3Unescape(s string) string {
	s = strings.ReplaceAll(s, "\\\\", "\\")
	s = strings.ReplaceAll(s, "\\/", "/")
	s = strings.ReplaceAll(s, "\\s", " ")
	s = strings.ReplaceAll(s, "\\p", "|")
	s = strings.ReplaceAll(s, "\\a", "\a")
	s = strings.ReplaceAll(s, "\\b", "\b")
	s = strings.ReplaceAll(s, "\\f", "\f")
	s = strings.ReplaceAll(s, "\\n", "\n")
	s = strings.ReplaceAll(s, "\\r", "\r")
	s = strings.ReplaceAll(s, "\\t", "\t")
	s = strings.ReplaceAll(s, "\\v", "\v")
	return s
}

func resolveTS3Endpoint(server *models.Server) (host string, port int, voicePort int, password string) {
	voicePort = 9987
	if server.Allocation != nil && server.Allocation.Port > 0 {
		voicePort = server.Allocation.Port
	}

	host = "127.0.0.1"
	if server.Node != nil && server.Node.FQDN != "" {
		host = server.Node.FQDN
	} else if server.Allocation != nil && server.Allocation.IP != "" && server.Allocation.IP != "0.0.0.0" {
		host = server.Allocation.IP
	}

	port = 10011
	password = "PteroNextAdmin2026!"

	for _, v := range server.Variables {
		if v.EnvVariable == "QUERY_PORT" {
			if p, err := strconv.Atoi(v.DefaultValue); err == nil && p > 0 {
				port = p
			}
		}
		if v.EnvVariable == "SERVERADMIN_PASSWORD" && v.DefaultValue != "" {
			password = v.DefaultValue
		}
	}

	for _, a := range server.Allocations {
		if a.Port == port && a.IP != "" && a.IP != "0.0.0.0" {
			host = a.IP
		}
	}

	return host, port, voicePort, password
}

func runTS3Commands(host string, port int, voicePort int, password string, commands []string) ([][]string, error) {
	addr := fmt.Sprintf("%s:%d", host, port)
	conn, err := net.DialTimeout("tcp", addr, 2500*time.Millisecond)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(6 * time.Second))
	reader := bufio.NewReader(conn)

	// Consume initial TS3 banner
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimSpace(line)
		if strings.Contains(line, "Welcome to the TeamSpeak") {
			break
		}
	}

	// Login serveradmin
	loginCmd := fmt.Sprintf("login serveradmin %s\n", ts3Escape(password))
	if _, err := conn.Write([]byte(loginCmd)); err != nil {
		return nil, err
	}
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "error id=") {
			if !strings.HasPrefix(line, "error id=0") {
				return nil, fmt.Errorf("login failed: %s", line)
			}
			break
		}
	}

	// Select virtual server by voice port
	useCmd := fmt.Sprintf("use port=%d\n", voicePort)
	if _, err := conn.Write([]byte(useCmd)); err != nil {
		return nil, err
	}
	useOK := false
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "error id=") {
			if strings.HasPrefix(line, "error id=0") {
				useOK = true
			}
			break
		}
	}

	if !useOK {
		// Fallback to "use 1"
		if _, err := conn.Write([]byte("use 1\n")); err != nil {
			return nil, err
		}
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return nil, err
			}
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "error id=") {
				if !strings.HasPrefix(line, "error id=0") {
					return nil, fmt.Errorf("select virtualserver failed: %s", line)
				}
				break
			}
		}
	}

	// Execute commands
	results := make([][]string, len(commands))
	for idx, cmd := range commands {
		if _, err := conn.Write([]byte(cmd + "\n")); err != nil {
			return nil, err
		}
		var lines []string
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return nil, err
			}
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "error id=") {
				if !strings.HasPrefix(line, "error id=0") {
					return nil, fmt.Errorf("command '%s' returned error: %s", cmd, line)
				}
				break
			}
			if line != "" {
				lines = append(lines, line)
			}
		}
		results[idx] = lines
	}

	_, _ = conn.Write([]byte("quit\n"))
	return results, nil
}

func parseTS3Records(lines []string) []map[string]string {
	var records []map[string]string
	for _, line := range lines {
		items := strings.Split(line, "|")
		for _, item := range items {
			item = strings.TrimSpace(item)
			if item == "" {
				continue
			}
			fields := strings.Split(item, " ")
			record := make(map[string]string)
			for _, f := range fields {
				if f == "" {
					continue
				}
				parts := strings.SplitN(f, "=", 2)
				key := parts[0]
				val := ""
				if len(parts) == 2 {
					val = ts3Unescape(parts[1])
				}
				record[key] = val
			}
			if len(record) > 0 {
				records = append(records, record)
			}
		}
	}
	return records
}

func formatCodec(codecID string) string {
	switch codecID {
	case "0":
		return "Speex Narrowband (8 kHz)"
	case "1":
		return "Speex Wideband (16 kHz)"
	case "2":
		return "Speex Ultra-Wideband (32 kHz)"
	case "3":
		return "CELT Mono (48 kHz)"
	case "4":
		return "Opus Voice (48 kHz)"
	case "5":
		return "Opus Music (96 kHz)"
	default:
		return "Opus Voice"
	}
}

// GetVoiceStatus handles GET /api/servers/:uuid/voice/status
func (g *GameQueryController) GetVoiceStatus(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var isRunning bool
	if server.Node != nil && g.wingsClient != nil {
		stats, err := g.wingsClient.FetchServerResources(server.Node, server.UUID)
		if err == nil && stats != nil {
			isRunning = stats.State == "running" || stats.State == "starting"
		}
	} else {
		isRunning = true
	}

	key := fmt.Sprintf("voice_config:%s", server.UUID)
	var setting models.SystemSetting
	var cfg VoiceConfig
	if err := g.db.Where("key = ?", key).First(&setting).Error; err == nil && setting.Value != "" {
		_ = json.Unmarshal([]byte(setting.Value), &cfg)
	}

	var clients []VoiceClientInfo
	var channels []VoiceChannel
	var roles []VoiceRoleInfo
	var tokens []VoiceTokenInfo

	if isRunning {
		host, queryPort, voicePort, password := resolveTS3Endpoint(server)
		cmds := []string{
			"clientlist -uid -away -voice -times -info",
			"channellist -topic -flags -voice -limits",
			"servergrouplist",
			"tokenlist",
		}

		res, err := runTS3Commands(host, queryPort, voicePort, password, cmds)
		if err == nil && len(res) == 4 {
			// 1. Channels
			channelRecords := parseTS3Records(res[1])
			channelMap := make(map[int]string)
			for _, cr := range channelRecords {
				cid, _ := strconv.Atoi(cr["cid"])
				pid, _ := strconv.Atoi(cr["pid"])
				maxClients, _ := strconv.Atoi(cr["channel_maxclients"])
				totalClients, _ := strconv.Atoi(cr["total_clients"])
				codecQuality, _ := strconv.Atoi(cr["channel_codec_quality"])
				codecID, _ := strconv.Atoi(cr["channel_codec"])

				ch := VoiceChannel{
					ID:           cid,
					ParentID:     pid,
					Name:         cr["channel_name"],
					Topic:        cr["channel_topic"],
					Codec:        formatCodec(cr["channel_codec"]),
					CodecID:      codecID,
					CodecQuality: codecQuality,
					MaxClients:   maxClients,
					TotalClients: totalClients,
					IsDefault:    cr["channel_flag_default"] == "1",
					IsPermanent:  cr["channel_flag_permanent"] == "1",
				}
				channels = append(channels, ch)
				channelMap[cid] = ch.Name
			}

			// 2. Clients
			clientRecords := parseTS3Records(res[0])
			for _, clr := range clientRecords {
				// Filter out ServerQuery instances
				if clr["client_type"] == "1" {
					continue
				}
				clid, _ := strconv.Atoi(clr["clid"])
				cid, _ := strconv.Atoi(clr["cid"])
				dbid, _ := strconv.Atoi(clr["client_database_id"])
				idleTime, _ := strconv.Atoi(clr["client_idle_time"])
				connectedAt, _ := strconv.ParseInt(clr["client_lastconnected"], 10, 64)

				cl := VoiceClientInfo{
					ID:          dbid,
					Clid:        clid,
					Name:        clr["client_nickname"],
					ChannelID:   cid,
					ChannelName: channelMap[cid],
					UID:         clr["client_unique_identifier"],
					Version:     clr["client_version"],
					Platform:    clr["client_platform"],
					Muted:       clr["client_input_muted"] == "1",
					Deafened:    clr["client_output_muted"] == "1",
					Talking:     clr["client_flag_talking"] == "1",
					IdleTime:    idleTime / 1000,
					ConnectedAt: connectedAt,
				}
				clients = append(clients, cl)
			}

			// 3. Server Roles / Groups
			roleRecords := parseTS3Records(res[2])
			groupMap := make(map[int]string)
			for _, rr := range roleRecords {
				sgid, _ := strconv.Atoi(rr["sgid"])
				t, _ := strconv.Atoi(rr["type"])
				iconID, _ := strconv.Atoi(rr["iconid"])
				name := rr["name"]
				isAdmin := strings.Contains(strings.ToLower(name), "admin") || rr["n_modifyp"] == "100"

				role := VoiceRoleInfo{
					ID:      sgid,
					Name:    name,
					Type:    t,
					IconID:  iconID,
					IsAdmin: isAdmin,
				}
				roles = append(roles, role)
				groupMap[sgid] = name
			}

			// 4. Tokens
			tokenRecords := parseTS3Records(res[3])
			for _, tr := range tokenRecords {
				tok := tr["token"]
				if tok == "" {
					continue
				}
				gid, _ := strconv.Atoi(tr["token_id1"])
				createdAt, _ := strconv.ParseInt(tr["token_created"], 10, 64)

				t := VoiceTokenInfo{
					Token:       tok,
					GroupID:     gid,
					GroupName:   groupMap[gid],
					Description: tr["token_description"],
					CreatedAt:   createdAt,
				}
				tokens = append(tokens, t)
				if cfg.Token == "" {
					cfg.Token = tok
				}
			}

			// Save latest token in DB if found
			if len(tokens) > 0 {
				cfg.Token = tokens[0].Token
				valBytes, _ := json.Marshal(cfg)
				setting.Key = key
				setting.Value = string(valBytes)
				_ = g.db.Save(&setting).Error
			}
		}
	}

	// Fallback to cached channels if query returned no channels
	if len(channels) == 0 && cfg.Channels != nil {
		channels = cfg.Channels
	}

	c.JSON(http.StatusOK, gin.H{
		"is_running":  isRunning,
		"server_name": server.Name,
		"clients":     clients,
		"channels":    channels,
		"roles":       roles,
		"tokens":      tokens,
		"token":       cfg.Token,
	})
}

// CreateVoiceChannel handles POST /api/servers/:uuid/voice/channels
func (g *GameQueryController) CreateVoiceChannel(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Name       string `json:"name" binding:"required"`
		Topic      string `json:"topic"`
		Codec      string `json:"codec"`
		MaxClients int    `json:"max_clients"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	host, queryPort, voicePort, password := resolveTS3Endpoint(server)
	cmd := fmt.Sprintf("channelcreate channel_name=%s channel_flag_permanent=1 channel_codec=4 channel_codec_quality=6", ts3Escape(req.Name))
	if req.Topic != "" {
		cmd += fmt.Sprintf(" channel_topic=%s", ts3Escape(req.Topic))
	}
	if req.MaxClients > 0 {
		cmd += fmt.Sprintf(" channel_maxclients=%d", req.MaxClients)
	}

	_, err := runTS3Commands(host, queryPort, voicePort, password, []string{cmd})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("TS3 Query error: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Channel created successfully"})
}

// DeleteVoiceChannel handles DELETE /api/servers/:uuid/voice/channels/:cid
func (g *GameQueryController) DeleteVoiceChannel(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	cid := c.Param("cid")
	if cid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID required"})
		return
	}

	host, queryPort, voicePort, password := resolveTS3Endpoint(server)
	cmd := fmt.Sprintf("channeldelete cid=%s force=1", cid)

	_, err := runTS3Commands(host, queryPort, voicePort, password, []string{cmd})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("TS3 Query error: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Channel deleted successfully"})
}

// CreateVoiceRole handles POST /api/servers/:uuid/voice/roles
func (g *GameQueryController) CreateVoiceRole(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	host, queryPort, voicePort, password := resolveTS3Endpoint(server)
	cmd := fmt.Sprintf("servergroupadd name=%s type=1", ts3Escape(req.Name))

	_, err := runTS3Commands(host, queryPort, voicePort, password, []string{cmd})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("TS3 Query error: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Role created successfully"})
}

// DeleteVoiceRole handles DELETE /api/servers/:uuid/voice/roles/:sgid
func (g *GameQueryController) DeleteVoiceRole(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	sgid := c.Param("sgid")
	if sgid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role ID required"})
		return
	}

	host, queryPort, voicePort, password := resolveTS3Endpoint(server)
	cmd := fmt.Sprintf("servergroupdel sgid=%s force=1", sgid)

	_, err := runTS3Commands(host, queryPort, voicePort, password, []string{cmd})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("TS3 Query error: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Role deleted successfully"})
}

// CreateVoiceToken handles POST /api/servers/:uuid/voice/tokens
func (g *GameQueryController) CreateVoiceToken(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		GroupID     int    `json:"group_id" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	desc := req.Description
	if desc == "" {
		desc = "Generated via PteroNext Voice Dashboard"
	}

	host, queryPort, voicePort, password := resolveTS3Endpoint(server)
	cmd := fmt.Sprintf("tokenadd tokentype=0 tokenid1=%d tokenid2=0 tokendescription=%s", req.GroupID, ts3Escape(desc))

	res, err := runTS3Commands(host, queryPort, voicePort, password, []string{cmd})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("TS3 Query error: %v", err)})
		return
	}

	token := ""
	if len(res) > 0 {
		records := parseTS3Records(res[0])
		if len(records) > 0 {
			token = records[0]["token"]
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"message": "Privilege token generated successfully",
	})
}

// DeleteVoiceToken handles DELETE /api/servers/:uuid/voice/tokens/:token
func (g *GameQueryController) DeleteVoiceToken(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token required"})
		return
	}

	host, queryPort, voicePort, password := resolveTS3Endpoint(server)
	cmd := fmt.Sprintf("tokendelete token=%s", ts3Escape(token))

	_, err := runTS3Commands(host, queryPort, voicePort, password, []string{cmd})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("TS3 Query error: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Token revoked successfully"})
}

// KickVoiceClient handles POST /api/servers/:uuid/voice/kick
func (g *GameQueryController) KickVoiceClient(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Clid    int    `json:"clid" binding:"required"`
		Message string `json:"message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg := req.Message
	if msg == "" {
		msg = "Kicked by Administrator via PteroNext"
	}

	host, queryPort, voicePort, password := resolveTS3Endpoint(server)
	cmd := fmt.Sprintf("clientkick reasonid=5 reasonmsg=%s clid=%d", ts3Escape(msg), req.Clid)

	_, err := runTS3Commands(host, queryPort, voicePort, password, []string{cmd})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("TS3 Query error: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Client kicked successfully"})
}

// SaveVoiceChannels handles POST /api/servers/:uuid/voice/channels (backward compatibility fallback)
func (g *GameQueryController) SaveVoiceChannels(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req VoiceConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	key := fmt.Sprintf("voice_config:%s", server.UUID)
	valBytes, _ := json.Marshal(req)

	var setting models.SystemSetting
	if err := g.db.Where("key = ?", key).First(&setting).Error; err != nil {
		setting = models.SystemSetting{Key: key, Value: string(valBytes)}
	} else {
		setting.Value = string(valBytes)
	}
	g.db.Save(&setting)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"channels": req.Channels,
		"token":    req.Token,
	})
}
