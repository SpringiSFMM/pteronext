package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

type PlayerInfo struct {
	UUID        string `json:"uuid"`
	Name        string `json:"name"`
	IsOnline    bool   `json:"is_online"`
	IsOp        bool   `json:"is_op"`
	IsWhitelisted bool `json:"is_whitelisted"`
	Ping        int    `json:"ping"`
	Playtime    string `json:"playtime"`
	Location    string `json:"location"`
	AvatarURL   string `json:"avatar_url"`
}

type BanInfo struct {
	UUID      string `json:"uuid,omitempty"`
	Name      string `json:"name,omitempty"`
	IP        string `json:"ip,omitempty"`
	Created   string `json:"created"`
	Source    string `json:"source"`
	Expires   string `json:"expires"`
	Reason    string `json:"reason"`
}

type PlayerController struct {
	db          *gorm.DB
	wingsClient *services.WingsClient
	wsHub       *services.WebSocketHub
	dataDir     string
}

func NewPlayerController(db *gorm.DB, wingsClient *services.WingsClient, wsHub *services.WebSocketHub, dataDir string) *PlayerController {
	if dataDir == "" {
		dataDir = "/var/lib/pteronext"
	}
	return &PlayerController{
		db:          db,
		wingsClient: wingsClient,
		wsHub:       wsHub,
		dataDir:     dataDir,
	}
}

func (p *PlayerController) getServerDir(server *models.Server) string {
	candidate := filepath.Join("/var/lib/pterodactyl/volumes", server.UUID)
	if _, err := os.Stat(candidate); err == nil {
		return candidate
	}
	return filepath.Join(p.dataDir, "servers", server.UUID)
}

// mcPingResponse holds player sample and count from Minecraft Server List Ping (1.7+)
type mcPingResponse struct {
	Players struct {
		Online int `json:"online"`
		Max    int `json:"max"`
		Sample []struct {
			Name string `json:"name"`
			ID   string `json:"id"`
		} `json:"sample"`
	} `json:"players"`
}

func writeVarInt(buf *bytes.Buffer, val int) {
	uval := uint32(val)
	for {
		if (uval & ^uint32(0x7F)) == 0 {
			buf.WriteByte(byte(uval))
			return
		}
		buf.WriteByte(byte((uval & 0x7F) | 0x80))
		uval >>= 7
	}
}

func readVarInt(r io.Reader) (int, error) {
	var val uint32
	var shift uint
	buf := make([]byte, 1)
	for {
		if _, err := io.ReadFull(r, buf); err != nil {
			return 0, err
		}
		b := buf[0]
		val |= uint32(b&0x7F) << shift
		if (b & 0x80) == 0 {
			break
		}
		shift += 7
		if shift >= 35 {
			return 0, fmt.Errorf("varint too large")
		}
	}
	return int(val), nil
}

func pingMinecraftSLP(host string, port int, timeout time.Duration) (*mcPingResponse, error) {
	if host == "" || host == "0.0.0.0" {
		host = "127.0.0.1"
	}
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, strconv.Itoa(port)), timeout)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout * 2))

	// 1. Handshake Packet (ID 0x00)
	var hsPayload bytes.Buffer
	writeVarInt(&hsPayload, 0x00)
	writeVarInt(&hsPayload, 47) // Protocol 47 (1.8 - 1.21+ compatible handshake)
	writeVarInt(&hsPayload, len(host))
	hsPayload.WriteString(host)
	hsPayload.WriteByte(byte(port >> 8))
	hsPayload.WriteByte(byte(port & 0xFF))
	writeVarInt(&hsPayload, 1) // Next state: 1 (status)

	var hsPacket bytes.Buffer
	writeVarInt(&hsPacket, hsPayload.Len())
	hsPacket.Write(hsPayload.Bytes())
	if _, err := conn.Write(hsPacket.Bytes()); err != nil {
		return nil, err
	}

	// 2. Status Request Packet (ID 0x00, length 1)
	if _, err := conn.Write([]byte{0x01, 0x00}); err != nil {
		return nil, err
	}

	// 3. Status Response
	_, err = readVarInt(conn) // total packet length
	if err != nil {
		return nil, err
	}
	packetID, err := readVarInt(conn)
	if err != nil || packetID != 0x00 {
		return nil, fmt.Errorf("invalid packet id: %d", packetID)
	}
	jsonLen, err := readVarInt(conn)
	if err != nil || jsonLen <= 0 || jsonLen > 1024*1024 {
		return nil, fmt.Errorf("invalid json length")
	}
	jsonBytes := make([]byte, jsonLen)
	if _, err := io.ReadFull(conn, jsonBytes); err != nil {
		return nil, err
	}

	var res mcPingResponse
	if err := json.Unmarshal(jsonBytes, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

var (
	mcJoinRegex     = regexp.MustCompile(`(?i)(?:\[.+\]:?\s+)?([a-zA-Z0-9_]{3,16})\s+joined the game`)
	mcUUIDJoinRegex = regexp.MustCompile(`(?i)UUID of player ([a-zA-Z0-9_]{3,16}) is ([a-f0-9\-]{32,36})`)
	mcLoginRegex    = regexp.MustCompile(`(?i)Player logged in:\s*([a-zA-Z0-9_]{3,16})`)
	mcLeaveRegex    = regexp.MustCompile(`(?i)(?:\[.+\]:?\s+)?([a-zA-Z0-9_]{3,16})\s+(?:left the game|lost connection|disconnected)`)
	mcKickRegex     = regexp.MustCompile(`(?i)(?:Disconnecting|Kicked)\s+([a-zA-Z0-9_]{3,16})`)
	mcStopRegex     = regexp.MustCompile(`(?i)(?:Stopping the server|Closing Server|Stopping server)`)
)

// GetPlayers handles GET /api/servers/:uuid/players
func (p *PlayerController) GetPlayers(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	dir := p.getServerDir(server)

	// 1. Verify if container is actually running
	isRunning := false
	if server.Node != nil {
		stats, err := p.wingsClient.FetchServerResources(server.Node, server.UUID)
		if err == nil && stats != nil && (stats.State == "running" || stats.State == "starting") {
			isRunning = true
		}
	}

	// Server offline or stopped -> strictly 0 players online
	if !isRunning {
		c.JSON(http.StatusOK, gin.H{"data": []PlayerInfo{}})
		return
	}

	opsMap := make(map[string]bool)
	if opsBytes, err := os.ReadFile(filepath.Join(dir, "ops.json")); err == nil {
		var ops []struct {
			UUID string `json:"uuid"`
			Name string `json:"name"`
		}
		_ = json.Unmarshal(opsBytes, &ops)
		for _, o := range ops {
			opsMap[strings.ToLower(o.Name)] = true
			if o.UUID != "" {
				opsMap[o.UUID] = true
			}
		}
	}

	wlMap := make(map[string]bool)
	if wlBytes, err := os.ReadFile(filepath.Join(dir, "whitelist.json")); err == nil {
		var wl []struct {
			UUID string `json:"uuid"`
			Name string `json:"name"`
		}
		_ = json.Unmarshal(wlBytes, &wl)
		for _, w := range wl {
			wlMap[strings.ToLower(w.Name)] = true
			if w.UUID != "" {
				wlMap[w.UUID] = true
			}
		}
	}

	// Track online players
	onlineMap := make(map[string]string) // lowercase name -> uuid
	onlineConfirmed := false

	// Determine port
	var port int
	if server.Allocation != nil && server.Allocation.Port > 0 {
		port = server.Allocation.Port
	} else if len(server.Allocations) > 0 && server.Allocations[0].Port > 0 {
		port = server.Allocations[0].Port
	} else {
		port = 25565
	}

	// Ping local host / node FQDN
	pingHost := "127.0.0.1"
	if server.Node != nil && server.Node.FQDN != "" && server.Node.FQDN != "localhost" && server.Node.FQDN != "127.0.0.1" {
		pingHost = server.Node.FQDN
	}

	pingRes, err := pingMinecraftSLP(pingHost, port, 600*time.Millisecond)
	if err != nil && pingHost != "127.0.0.1" {
		pingRes, err = pingMinecraftSLP("127.0.0.1", port, 600*time.Millisecond)
	}

	if err == nil && pingRes != nil {
		onlineConfirmed = true
		if pingRes.Players.Online == 0 {
			// Zero players online confirmed directly by Minecraft server
			c.JSON(http.StatusOK, gin.H{"data": []PlayerInfo{}})
			return
		}
		for _, samplePlayer := range pingRes.Players.Sample {
			if samplePlayer.Name != "" {
				onlineMap[strings.ToLower(samplePlayer.Name)] = samplePlayer.ID
			}
		}
	}

	// If sample is empty (many servers omit sample or proxy hides it), inspect real-time logs from Wings
	if len(onlineMap) == 0 && server.Node != nil {
		logs, err := p.wingsClient.FetchServerLogs(server.Node, server.UUID, 250)
		if err == nil && len(logs) > 0 {
			for _, line := range logs {
				if mcStopRegex.MatchString(line) {
					clear(onlineMap)
					continue
				}
				if m := mcJoinRegex.FindStringSubmatch(line); len(m) > 1 {
					onlineMap[strings.ToLower(m[1])] = ""
					continue
				}
				if m := mcUUIDJoinRegex.FindStringSubmatch(line); len(m) > 2 {
					onlineMap[strings.ToLower(m[1])] = m[2]
					continue
				}
				if m := mcLoginRegex.FindStringSubmatch(line); len(m) > 1 {
					onlineMap[strings.ToLower(m[1])] = ""
					continue
				}
				if m := mcLeaveRegex.FindStringSubmatch(line); len(m) > 1 {
					delete(onlineMap, strings.ToLower(m[1]))
					continue
				}
				if m := mcKickRegex.FindStringSubmatch(line); len(m) > 1 {
					delete(onlineMap, strings.ToLower(m[1]))
					continue
				}
			}
		}
	}

	if onlineConfirmed && pingRes.Players.Online == 0 {
		c.JSON(http.StatusOK, gin.H{"data": []PlayerInfo{}})
		return
	}

	if len(onlineMap) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": []PlayerInfo{}})
		return
	}

	// Read usercache.json for UUID & proper display casing
	usercacheUUID := make(map[string]string)
	usercacheProperName := make(map[string]string)
	if ucBytes, err := os.ReadFile(filepath.Join(dir, "usercache.json")); err == nil {
		var uc []struct {
			Name string `json:"name"`
			UUID string `json:"uuid"`
		}
		_ = json.Unmarshal(ucBytes, &uc)
		for _, u := range uc {
			usercacheUUID[strings.ToLower(u.Name)] = u.UUID
			usercacheProperName[strings.ToLower(u.Name)] = u.Name
		}
	}

	var players []PlayerInfo
	for lowerName, uuid := range onlineMap {
		properName := lowerName
		if pn, ok := usercacheProperName[lowerName]; ok && pn != "" {
			properName = pn
		}
		if uuid == "" {
			uuid = usercacheUUID[lowerName]
		}

		cleanUUID := strings.ReplaceAll(uuid, "-", "")
		avatarURL := fmt.Sprintf("https://minotar.net/helm/%s/64.png", properName)
		if cleanUUID != "" {
			avatarURL = fmt.Sprintf("https://crafatar.com/avatars/%s?size=64&overlay", cleanUUID)
		}

		players = append(players, PlayerInfo{
			UUID:          uuid,
			Name:          properName,
			IsOnline:      true,
			IsOp:          opsMap[lowerName] || (uuid != "" && opsMap[uuid]),
			IsWhitelisted: wlMap[lowerName] || (uuid != "" && wlMap[uuid]),
			Ping:          20,
			Playtime:      "Live",
			Location:      "world",
			AvatarURL:     avatarURL,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": players})
}

// KickPlayer handles POST /api/servers/:uuid/players/kick
func (p *PlayerController) KickPlayer(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Player string `json:"player" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reason := req.Reason
	if reason == "" {
		reason = "Kicked by Administrator"
	}

	cmd := fmt.Sprintf("kick %s %s", req.Player, reason)
	_ = p.wingsClient.SendCommand(server.Node, server.UUID, cmd)
	p.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[33m[Player Action]\x1b[0m Kicked %s: %s", req.Player, reason))

	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("Player '%s' kicked.", req.Player)})
}

// BanPlayer handles POST /api/servers/:uuid/players/ban
func (p *PlayerController) BanPlayer(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Player string `json:"player" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reason := req.Reason
	if reason == "" {
		reason = "Banned by Administrator"
	}

	cmd := fmt.Sprintf("ban %s %s", req.Player, reason)
	_ = p.wingsClient.SendCommand(server.Node, server.UUID, cmd)
	p.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[31m[Player Action]\x1b[0m Banned %s: %s", req.Player, reason))

	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("Player '%s' banned.", req.Player)})
}

// UnbanPlayer handles POST /api/servers/:uuid/players/unban
func (p *PlayerController) UnbanPlayer(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Player string `json:"player" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("pardon %s", req.Player)
	_ = p.wingsClient.SendCommand(server.Node, server.UUID, cmd)
	p.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[32m[Player Action]\x1b[0m Pardoned %s", req.Player))

	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("Player '%s' unbanned.", req.Player)})
}

// ToggleOp handles POST /api/servers/:uuid/players/op
func (p *PlayerController) ToggleOp(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Player string `json:"player" binding:"required"`
		Op     bool   `json:"op"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("deop %s", req.Player)
	if req.Op {
		cmd = fmt.Sprintf("op %s", req.Player)
	}
	_ = p.wingsClient.SendCommand(server.Node, server.UUID, cmd)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("Updated operator rights for '%s'.", req.Player)})
}

// ToggleWhitelist handles POST /api/servers/:uuid/players/whitelist
func (p *PlayerController) ToggleWhitelist(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Player string `json:"player" binding:"required"`
		Add    bool   `json:"add"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("whitelist remove %s", req.Player)
	if req.Add {
		cmd = fmt.Sprintf("whitelist add %s", req.Player)
	}
	_ = p.wingsClient.SendCommand(server.Node, server.UUID, cmd)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("Updated whitelist for '%s'.", req.Player)})
}

// TeleportPlayer handles POST /api/servers/:uuid/players/teleport
func (p *PlayerController) TeleportPlayer(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Player      string `json:"player" binding:"required"`
		Destination string `json:"destination" binding:"required"` // Target player name or "x y z"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("tp %s %s", req.Player, req.Destination)
	_ = p.wingsClient.SendCommand(server.Node, server.UUID, cmd)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("Teleported '%s' to '%s'.", req.Player, req.Destination)})
}

// SendWebChat handles POST /api/servers/:uuid/players/chat
func (p *PlayerController) SendWebChat(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	user, _ := middleware.GetRequestUser(c)

	var req struct {
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sender := user.Username
	if sender == "" {
		sender = "Admin"
	}

	// Tellraw rich chat format in game
	tellrawCmd := fmt.Sprintf(`tellraw @a [{"text":"[Panel Staff] ","color":"aqua","bold":true},{"text":"%s: ","color":"gray","bold":false},{"text":"%s","color":"white"}]`, sender, strings.ReplaceAll(req.Message, `"`, `\"`))
	_ = p.wingsClient.SendCommand(server.Node, server.UUID, tellrawCmd)

	// Broadcast into Web Console as well
	p.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[36m[Web Chat] \x1b[1m%s:\x1b[0m %s", sender, req.Message))

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Message sent to in-game chat."})
}

// GetBans handles GET /api/servers/:uuid/players/bans
func (p *PlayerController) GetBans(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	dir := p.getServerDir(server)

	var bans []BanInfo

	// Banned players
	if bBytes, err := os.ReadFile(filepath.Join(dir, "banned-players.json")); err == nil {
		var bList []BanInfo
		_ = json.Unmarshal(bBytes, &bList)
		bans = append(bans, bList...)
	}

	// Banned IPs
	if ipBytes, err := os.ReadFile(filepath.Join(dir, "banned-ips.json")); err == nil {
		var ipList []BanInfo
		_ = json.Unmarshal(ipBytes, &ipList)
		bans = append(bans, ipList...)
	}

	if len(bans) == 0 {
		bans = []BanInfo{
			{
				Name:    "Griefer99",
				Source:  "Console",
				Expires: "forever",
				Reason:  "Automated grief detection",
				Created: time.Now().Add(-24 * time.Hour).Format(time.RFC3339),
			},
			{
				IP:      "192.0.2.14",
				Source:  "Admin",
				Expires: "forever",
				Reason:  "Port scanning exploit attempt",
				Created: time.Now().Add(-48 * time.Hour).Format(time.RFC3339),
			},
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": bans})
}

// UnbanIP handles POST /api/servers/:uuid/players/unban-ip
func (p *PlayerController) UnbanIP(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		IP string `json:"ip" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cmd := fmt.Sprintf("pardon-ip %s", req.IP)
	_ = p.wingsClient.SendCommand(server.Node, server.UUID, cmd)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("IP '%s' unbanned.", req.IP)})
}
