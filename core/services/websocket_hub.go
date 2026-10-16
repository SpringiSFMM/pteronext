package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

func MaskSensitiveOutput(line string) string {
	res := discordToken.ReplaceAllString(line, `$1••••••••••••`)
	res = bearerRegex.ReplaceAllString(res, `Bearer ••••••••••••`)
	res = rconPassRegex.ReplaceAllString(res, `$1=••••••••••••`)
	res = tokenRegex.ReplaceAllStringFunc(res, func(m string) string {
		parts := strings.SplitN(m, "=", 2)
		if len(parts) == 2 {
			return parts[0] + "=••••••••••••"
		}
		parts = strings.SplitN(m, ":", 2)
		if len(parts) == 2 {
			return parts[0] + ": ••••••••••••"
		}
		return m
	})
	return res
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev/panel frontend
	},
}

// WSMessage represents a standard Pterodactyl console WebSocket event.
type WSMessage struct {
	Event string        `json:"event"`
	Args  []interface{} `json:"args"`
}

// Client represents an active WebSocket client session.
type Client struct {
	Hub        *WebSocketHub
	Conn       *websocket.Conn
	ServerUUID string
	SendChan   chan []byte
}

// WebSocketHub manages live WebSocket connections for server consoles.
type WebSocketHub struct {
	clients    map[string]map[*Client]bool // serverUUID -> set of clients
	broadcast  chan BroadcastMessage
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
	wings      *WingsClient
	db         *gorm.DB
}

// BroadcastMessage holds a message targeted to all listeners of a specific server.
type BroadcastMessage struct {
	ServerUUID string
	Data       []byte
}

// NewWebSocketHub initializes and starts a new WebSocketHub.
func NewWebSocketHub(wings *WingsClient, db *gorm.DB) *WebSocketHub {
	hub := &WebSocketHub{
		clients:    make(map[string]map[*Client]bool),
		broadcast:  make(chan BroadcastMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		wings:      wings,
		db:         db,
	}
	go hub.run()
	return hub
}

func (h *WebSocketHub) IsServerSuspended(uuid string) bool {
	if h.db != nil {
		var s models.Server
		if err := h.db.Select("suspended").Where("uuid = ?", uuid).First(&s).Error; err == nil {
			return s.Suspended
		}
	}
	return false
}

func (h *WebSocketHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			if h.clients[client.ServerUUID] == nil {
				h.clients[client.ServerUUID] = make(map[*Client]bool)
			}
			h.clients[client.ServerUUID][client] = true
			h.mutex.Unlock()

		case client := <-h.unregister:
			h.mutex.Lock()
			if clients, ok := h.clients[client.ServerUUID]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.SendChan)
					if len(clients) == 0 {
						delete(h.clients, client.ServerUUID)
					}
				}
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			if clients, ok := h.clients[message.ServerUUID]; ok {
				for client := range clients {
					select {
					case client.SendChan <- message.Data:
					default:
						close(client.SendChan)
						delete(clients, client)
					}
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// Broadcast sends a message to all connected clients for a given server.
func (h *WebSocketHub) Broadcast(serverUUID string, event string, args ...interface{}) {
	if event == "console output" && len(args) > 0 {
		if line, ok := args[0].(string); ok {
			args[0] = MaskSensitiveOutput(line)
		}
	}
	msg := WSMessage{
		Event: event,
		Args:  args,
	}
	data, err := json.Marshal(msg)
	if err == nil {
		h.broadcast <- BroadcastMessage{
			ServerUUID: serverUUID,
			Data:       data,
		}
	}
}

// HandleWebSocket upgrades HTTP connection and manages the WebSocket lifecycle for a server.
func (h *WebSocketHub) HandleWebSocket(w http.ResponseWriter, r *http.Request, server *models.Server) error {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return fmt.Errorf("websocket upgrade error: %w", err)
	}

	client := &Client{
		Hub:        h,
		Conn:       conn,
		ServerUUID: server.UUID,
		SendChan:   make(chan []byte, 64),
	}

	h.register <- client

	// Start reading and writing goroutines
	go client.writePump()
	go client.readPump(server)

	return nil
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.SendChan:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)
			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) readPump(server *models.Server) {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(65536)
	_ = c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Send initial welcome & query real status
	c.sendMessage("auth success")
	initialState := "offline"
	isSuspended := c.Hub.IsServerSuspended(server.UUID)
	if isSuspended {
		initialState = "suspended"
		if server.Node != nil {
			_ = c.Hub.wings.SendPowerAction(server.Node, server.UUID, "kill")
		}
	} else if server.Node != nil {
		if stats, err := c.Hub.wings.FetchServerResources(server.Node, server.UUID); err == nil && stats != nil && stats.State != "" {
			initialState = stats.State
		}
	}
	c.sendMessage("status", initialState)
	c.sendMessage("console output", fmt.Sprintf("\x1b[33m[PteroNext Core]\x1b[0m Connected to console for \x1b[1m%s\x1b[0m (%s)", server.Name, server.Identifier))
	c.sendMessage("console output", fmt.Sprintf("\x1b[32m[PteroNext Node]\x1b[0m %s (%s) | Status: %s", server.Node.Name, server.Node.FQDN, initialState))
	if isSuspended {
		c.sendMessage("console output", "\x1b[31;1m[SERVER SUSPENDED]\x1b[0m Dieser Server ist administrativ suspendiert. Konsolenbefehle und Prozess-Starts sind gesperrt.")
	}

	// Fetch recent server logs from Wings if available
	if server.Node != nil {
		if logs, err := c.Hub.wings.FetchServerLogs(server.Node, server.UUID, 50); err == nil && len(logs) > 0 {
			for _, line := range logs {
				c.sendMessage("console output", line)
			}
		}
	}

	// Periodically stream real resource stats and live logs from Wings
	stopStats := make(chan struct{})
	defer close(stopStats)
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		seenLogs := make(map[string]bool)

		// Seed initially seen logs
		if server.Node != nil {
			if initialLogs, err := c.Hub.wings.FetchServerLogs(server.Node, server.UUID, 100); err == nil {
				for _, line := range initialLogs {
					seenLogs[line] = true
				}
			}
		}

		for {
			select {
			case <-ticker.C:
				if server.Node != nil {
					if c.Hub.IsServerSuspended(server.UUID) {
						c.sendMessage("status", "suspended")
						// Ensure any lingering container process is stopped
						if stats, err := c.Hub.wings.FetchServerResources(server.Node, server.UUID); err == nil && stats != nil && stats.State == "running" {
							_ = c.Hub.wings.SendPowerAction(server.Node, server.UUID, "kill")
						}
						continue
					}

					stats, err := c.Hub.wings.FetchServerResources(server.Node, server.UUID)
					if err == nil && stats != nil {
						data, _ := json.Marshal(map[string]interface{}{
							"memory_bytes":       stats.MemoryBytes,
							"memory_limit_bytes": stats.MemoryLimitBytes,
							"cpu_absolute":       stats.CpuAbsolute,
							"disk_bytes":         stats.DiskBytes,
							"network": map[string]int64{
								"rx_bytes": stats.NetworkRx,
								"tx_bytes": stats.NetworkTx,
							},
							"uptime": stats.UptimeMs,
							"state":  stats.State,
						})
						c.sendMessage("stats", string(data))
						c.sendMessage("status", stats.State)
					} else {
						data, _ := json.Marshal(map[string]interface{}{
							"memory_bytes":       0,
							"memory_limit_bytes": server.MemoryMB * 1024 * 1024,
							"cpu_absolute":       0,
							"disk_bytes":         0,
							"network": map[string]int64{
								"rx_bytes": 0,
								"tx_bytes": 0,
							},
							"uptime": 0,
							"state":  "offline",
						})
						c.sendMessage("stats", string(data))
						c.sendMessage("status", "offline")
					}

					// Stream live container stdout from Wings
					if liveLogs, err := c.Hub.wings.FetchServerLogs(server.Node, server.UUID, 100); err == nil && len(liveLogs) > 0 {
						for _, line := range liveLogs {
							if !seenLogs[line] {
								seenLogs[line] = true
								c.sendMessage("console output", line)
							}
						}
					}
				}
			case <-stopStats:
				return
			}
		}
	}()

	for {
		_, rawMsg, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS WARN] client read error: %v", err)
			}
			break
		}

		var wsMsg WSMessage
		if err := json.Unmarshal(rawMsg, &wsMsg); err != nil {
			continue
		}

		switch wsMsg.Event {
		case "send command":
			if len(wsMsg.Args) > 0 {
				if c.Hub.IsServerSuspended(server.UUID) {
					c.sendMessage("console output", "\x1b[31;1m[SECURITY LOCKDOWN]\x1b[0m Dieser Server ist administrativ suspendiert. Konsolenbefehle sind gesperrt.")
					continue
				}
				cmdStr := fmt.Sprintf("%v", wsMsg.Args[0])
				c.Hub.Broadcast(server.UUID, "console output", fmt.Sprintf("> %s", cmdStr))
				if server.Node != nil {
					if cmdErr := c.Hub.wings.SendCommand(server.Node, server.UUID, cmdStr); cmdErr != nil {
						c.Hub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[31m[Wings Notice]\x1b[0m %s", cmdErr.Error()))
					}
				}
			}

		case "set state":
			if len(wsMsg.Args) > 0 {
				state := fmt.Sprintf("%v", wsMsg.Args[0])
				if c.Hub.IsServerSuspended(server.UUID) && (state == "start" || state == "restart") {
					c.sendMessage("console output", "\x1b[31;1m[SECURITY LOCKDOWN]\x1b[0m Dieser Server ist administrativ suspendiert. Server-Starts sind gesperrt.")
					continue
				}
				broadcastState := state
				if state == "kill" {
					broadcastState = "offline"
				}
				c.Hub.Broadcast(server.UUID, "status", broadcastState)
				c.Hub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[33m[Server]\x1b[0m Server state change received: %s", state))
				if server.Node != nil {
					go func(targetNode *models.Node, targetUUID, act string) {
						if pErr := c.Hub.wings.SendPowerAction(targetNode, targetUUID, act); pErr != nil {
							c.Hub.Broadcast(targetUUID, "console output", fmt.Sprintf("\x1b[31m[Wings Error]\x1b[0m %s", pErr.Error()))
						}
					}(server.Node, server.UUID, state)
				}
			}

		case "send logs":
			if server.Node != nil {
				if logs, err := c.Hub.wings.FetchServerLogs(server.Node, server.UUID, 50); err == nil {
					for _, line := range logs {
						c.sendMessage("console output", line)
					}
				}
			}
		}
	}
}

func (c *Client) sendMessage(event string, args ...interface{}) {
	msg := WSMessage{
		Event: event,
		Args:  args,
	}
	data, err := json.Marshal(msg)
	if err == nil {
		select {
		case c.SendChan <- data:
		default:
		}
	}
}
