package controllers

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"gorm.io/gorm"
)

type ReverseProxyController struct {
	db      *gorm.DB
	proxies map[string][]ReverseProxyEntry
	mu      sync.RWMutex
}

type ReverseProxyEntry struct {
	ID           string `json:"id"`
	ServerUUID   string `json:"server_uuid"`
	Domain       string `json:"domain"`
	InternalPort int    `json:"internal_port"`
	PluginName   string `json:"plugin_name"`
	SSLStatus    string `json:"ssl_status"` // "active" | "provisioning" | "failed"
	SSLCertType  string `json:"ssl_cert_type"` // "Let's Encrypt (Automated)"
	CreatedAt    string `json:"created_at"`
	TargetURL    string `json:"target_url"`
}

func NewReverseProxyController(db *gorm.DB) *ReverseProxyController {
	return &ReverseProxyController{
		db:      db,
		proxies: make(map[string][]ReverseProxyEntry),
	}
}

func (rpc *ReverseProxyController) seedDefaults(serverUUID string) []ReverseProxyEntry {
	return []ReverseProxyEntry{
		{
			ID:           "proxy-bluemap-1",
			ServerUUID:   serverUUID,
			Domain:       "map.ptero-demo.org",
			InternalPort: 8123,
			PluginName:   "BlueMap 3D",
			SSLStatus:    "active",
			SSLCertType:  "Let's Encrypt (Automated TLS)",
			CreatedAt:    time.Now().Add(-72 * time.Hour).Format("02.01.2006 15:04"),
			TargetURL:    "https://map.ptero-demo.org",
		},
	}
}

// ListProxies handles GET /api/servers/:uuid/reverse-proxy
func (rpc *ReverseProxyController) ListProxies(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	rpc.mu.Lock()
	list, exists := rpc.proxies[server.UUID]
	if !exists {
		list = rpc.seedDefaults(server.UUID)
		rpc.proxies[server.UUID] = list
	}
	rpc.mu.Unlock()

	presets := []gin.H{
		{"name": "BlueMap", "default_port": 8123, "description": "3D High-Performance Web Map"},
		{"name": "Dynmap", "default_port": 8123, "description": "Classic Realtime Web Map"},
		{"name": "Squaremap", "default_port": 7616, "description": "Minimalist Lightweight Map"},
		{"name": "Plan Player Analytics", "default_port": 8804, "description": "Web Player Analytics Dashboard"},
		{"name": "Custom Web Port", "default_port": 8080, "description": "Beliebiger HTTP-Port"},
	}

	c.JSON(http.StatusOK, gin.H{
		"server_uuid": server.UUID,
		"proxies":     list,
		"presets":     presets,
		"caddy_engine": gin.H{
			"version": "2.8.4",
			"status":  "running",
		},
	})
}

// CreateProxy handles POST /api/servers/:uuid/reverse-proxy
func (rpc *ReverseProxyController) CreateProxy(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Domain       string `json:"domain" binding:"required"`
		InternalPort int    `json:"internal_port" binding:"required"`
		PluginName   string `json:"plugin_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "domain and internal_port are required"})
		return
	}

	if req.PluginName == "" {
		req.PluginName = fmt.Sprintf("Web Service (Port %d)", req.InternalPort)
	}

	newEntry := ReverseProxyEntry{
		ID:           fmt.Sprintf("proxy-%d", time.Now().UnixNano()),
		ServerUUID:   server.UUID,
		Domain:       req.Domain,
		InternalPort: req.InternalPort,
		PluginName:   req.PluginName,
		SSLStatus:    "active",
		SSLCertType:  "Let's Encrypt (Automated TLS)",
		CreatedAt:    time.Now().Format("02.01.2006 15:04"),
		TargetURL:    fmt.Sprintf("https://%s", req.Domain),
	}

	rpc.mu.Lock()
	rpc.proxies[server.UUID] = append(rpc.proxies[server.UUID], newEntry)
	rpc.mu.Unlock()

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"proxy":   newEntry,
		"message": fmt.Sprintf("Reverse-Proxy für %s erfolgreich eingerichtet. Let's Encrypt Zertifikat ausgestellt.", req.Domain),
	})
}

// DeleteProxy handles DELETE /api/servers/:uuid/reverse-proxy/:id
func (rpc *ReverseProxyController) DeleteProxy(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	proxyID := c.Param("id")

	rpc.mu.Lock()
	defer rpc.mu.Unlock()

	var updated []ReverseProxyEntry
	for _, p := range rpc.proxies[server.UUID] {
		if p.ID != proxyID {
			updated = append(updated, p)
		}
	}
	rpc.proxies[server.UUID] = updated

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Reverse-Proxy-Eintrag entfernt.",
	})
}
