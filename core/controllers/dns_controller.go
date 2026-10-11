package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

type DNSController struct {
	db *gorm.DB
}

func NewDNSController(db *gorm.DB) *DNSController {
	return &DNSController{db: db}
}

type CloudflareSettingsPayload struct {
	APIToken   string `json:"api_token"`
	ZoneID     string `json:"zone_id"`
	BaseDomain string `json:"base_domain"`
	Enabled    bool   `json:"enabled"`
}

// GetCloudflareConfig handles GET /api/admin/integrations/cloudflare (Admin only)
func (dc *DNSController) GetCloudflareConfig(c *gin.Context) {
	var settings []models.SystemSetting
	dc.db.Where("key LIKE 'cloudflare_%'").Find(&settings)

	configMap := make(map[string]string)
	for _, s := range settings {
		configMap[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, gin.H{
		"enabled":     configMap["cloudflare_enabled"] == "true",
		"api_token":   configMap["cloudflare_api_token"],
		"zone_id":     configMap["cloudflare_zone_id"],
		"base_domain": configMap["cloudflare_base_domain"],
		"is_active":   configMap["cloudflare_api_token"] != "" && configMap["cloudflare_zone_id"] != "",
	})
}

// SaveCloudflareConfig handles POST /api/admin/integrations/cloudflare (Admin only)
func (dc *DNSController) SaveCloudflareConfig(c *gin.Context) {
	var req CloudflareSettingsPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Cloudflare settings payload"})
		return
	}

	saveSetting := func(key, val string) {
		var s models.SystemSetting
		if err := dc.db.Where("key = ?", key).First(&s).Error; err != nil {
			dc.db.Create(&models.SystemSetting{Key: key, Value: val, UpdatedAt: time.Now()})
		} else {
			dc.db.Model(&s).Updates(map[string]interface{}{"value": val, "updated_at": time.Now()})
		}
	}

	enabledStr := "false"
	if req.Enabled {
		enabledStr = "true"
	}
	saveSetting("cloudflare_enabled", enabledStr)
	if req.APIToken != "" {
		saveSetting("cloudflare_api_token", req.APIToken)
	}
	saveSetting("cloudflare_zone_id", req.ZoneID)
	saveSetting("cloudflare_base_domain", strings.ToLower(strings.TrimSpace(req.BaseDomain)))

	c.JSON(http.StatusOK, gin.H{
		"message": "Cloudflare DNS-Automations-Einstellungen gespeichert.",
		"enabled": req.Enabled,
	})
}

// ListServerDomains handles GET /api/servers/:uuid/dns
func (dc *DNSController) ListServerDomains(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	var domains []models.ServerCustomDomain
	dc.db.Where("server_uuid = ?", server.UUID).Find(&domains)

	// Fetch base domain from settings
	var baseSetting models.SystemSetting
	dc.db.Where("key = 'cloudflare_base_domain'").First(&baseSetting)
	baseDomain := baseSetting.Value
	if baseDomain == "" {
		baseDomain = "springisfm.de"
	}

	targetIP := "217.20.120.126"
	serverPort := 25565
	if server.Allocation != nil {
		if server.Allocation.IP != "" && server.Allocation.IP != "0.0.0.0" {
			targetIP = server.Allocation.IP
		}
		if server.Allocation.Port > 0 {
			serverPort = server.Allocation.Port
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"domains":     domains,
		"base_domain": baseDomain,
		"server_ip":   targetIP,
		"server_port": serverPort,
	})
}

type CreateDomainRequest struct {
	Subdomain string `json:"subdomain" binding:"required"`
}

// CreateServerDomain handles POST /api/servers/:uuid/dns
// Automatically provisions A-Record and SRV-Record via Cloudflare API v4
func (dc *DNSController) CreateServerDomain(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	var req CreateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Subdomain is required"})
		return
	}

	cleanSub := strings.ToLower(strings.TrimSpace(req.Subdomain))
	cleanSub = strings.ReplaceAll(cleanSub, " ", "")

	subdomainRegex := regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)
	if !subdomainRegex.MatchString(cleanSub) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültiger Subdomain-Name. Nur Kleinbuchstaben, Ziffern und Bindestriche erlaubt (z.B. 'play', 'mc-pvp')."})
		return
	}

	// Prevent duplicate subdomain usage across servers
	var existing models.ServerCustomDomain
	if err := dc.db.Where("subdomain = ?", cleanSub).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Die Subdomain '%s' ist bereits durch einen Server belegt.", cleanSub)})
		return
	}

	// 1. Fetch Cloudflare settings
	var settings []models.SystemSetting
	dc.db.Where("key LIKE 'cloudflare_%'").Find(&settings)
	config := make(map[string]string)
	for _, s := range settings {
		config[s.Key] = s.Value
	}

	baseDomain := config["cloudflare_base_domain"]
	if baseDomain == "" {
		baseDomain = "springisfm.de"
	}
	apiToken := config["cloudflare_api_token"]
	zoneID := config["cloudflare_zone_id"]

	fullDomain := fmt.Sprintf("%s.%s", cleanSub, baseDomain)
	targetIP := "217.20.120.126"
	serverPort := 25565
	if server.Allocation != nil {
		if server.Allocation.IP != "" && server.Allocation.IP != "0.0.0.0" {
			targetIP = server.Allocation.IP
		}
		if server.Allocation.Port > 0 {
			serverPort = server.Allocation.Port
		}
	}

	recordIDA := fmt.Sprintf("cf_a_%d", time.Now().UnixNano())
	recordIDSRV := fmt.Sprintf("cf_srv_%d", time.Now().UnixNano())

	// 2. If Cloudflare API Token & Zone ID are set, call real Cloudflare REST API
	if apiToken != "" && zoneID != "" {
		client := &http.Client{Timeout: 10 * time.Second}

		// Create A-Record
		aPayload, _ := json.Marshal(map[string]interface{}{
			"type":    "A",
			"name":    fullDomain,
			"content": targetIP,
			"ttl":     1, // Auto
			"proxied": false, // Raw UDP/TCP game traffic
		})
		aReq, _ := http.NewRequest("POST", fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records", zoneID), bytes.NewBuffer(aPayload))
		aReq.Header.Set("Authorization", "Bearer "+apiToken)
		aReq.Header.Set("Content-Type", "application/json")
		aResp, err := client.Do(aReq)
		if err == nil && aResp != nil {
			var res struct {
				Success bool `json:"success"`
				Result  struct {
					ID string `json:"id"`
				} `json:"result"`
			}
			if err := json.NewDecoder(aResp.Body).Decode(&res); err == nil && res.Success && res.Result.ID != "" {
				recordIDA = res.Result.ID
			}
			aResp.Body.Close()
		}

		// Create SRV-Record
		srvPayload, _ := json.Marshal(map[string]interface{}{
			"type": "SRV",
			"data": map[string]interface{}{
				"service":  "_minecraft",
				"proto":    "_tcp",
				"name":     cleanSub,
				"priority": 0,
				"weight":   5,
				"port":     serverPort,
				"target":   fullDomain,
			},
			"ttl": 1,
		})
		srvReq, _ := http.NewRequest("POST", fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records", zoneID), bytes.NewBuffer(srvPayload))
		srvReq.Header.Set("Authorization", "Bearer "+apiToken)
		srvReq.Header.Set("Content-Type", "application/json")
		srvResp, err := client.Do(srvReq)
		if err == nil && srvResp != nil {
			var res struct {
				Success bool `json:"success"`
				Result  struct {
					ID string `json:"id"`
				} `json:"result"`
			}
			if err := json.NewDecoder(srvResp.Body).Decode(&res); err == nil && res.Success && res.Result.ID != "" {
				recordIDSRV = res.Result.ID
			}
			srvResp.Body.Close()
		}
	}

	// 3. Persist record in database
	customDomain := models.ServerCustomDomain{
		ServerUUID:  server.UUID,
		Subdomain:   cleanSub,
		FullDomain:  fullDomain,
		RecordIDA:   recordIDA,
		RecordIDSRV: recordIDSRV,
		Port:        serverPort,
		TargetIP:    targetIP,
		IsActive:    true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := dc.db.Create(&customDomain).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fehler beim Speichern der Domain: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     fmt.Sprintf("A- und SRV-Record für %s erfolgreich angelegt! Spieler können ohne Port verbinden.", fullDomain),
		"domain":      customDomain,
		"full_domain": fullDomain,
		"direct_ip":   fmt.Sprintf("%s:%d", targetIP, serverPort),
	})
}

// DeleteServerDomain handles DELETE /api/servers/:uuid/dns/:id
func (dc *DNSController) DeleteServerDomain(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	domainID := c.Param("id")
	var domain models.ServerCustomDomain
	if err := dc.db.Where("id = ? AND server_uuid = ?", domainID, server.UUID).First(&domain).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "DNS-Record nicht gefunden"})
		return
	}

	// Optionally delete from Cloudflare if configured
	var tokenSetting, zoneSetting models.SystemSetting
	dc.db.Where("key = 'cloudflare_api_token'").First(&tokenSetting)
	dc.db.Where("key = 'cloudflare_zone_id'").First(&zoneSetting)
	if tokenSetting.Value != "" && zoneSetting.Value != "" {
		client := &http.Client{Timeout: 5 * time.Second}
		if !strings.HasPrefix(domain.RecordIDA, "cf_a_") {
			delReq, _ := http.NewRequest("DELETE", fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records/%s", zoneSetting.Value, domain.RecordIDA), nil)
			delReq.Header.Set("Authorization", "Bearer "+tokenSetting.Value)
			_, _ = client.Do(delReq)
		}
		if !strings.HasPrefix(domain.RecordIDSRV, "cf_srv_") {
			delReq, _ := http.NewRequest("DELETE", fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records/%s", zoneSetting.Value, domain.RecordIDSRV), nil)
			delReq.Header.Set("Authorization", "Bearer "+tokenSetting.Value)
			_, _ = client.Do(delReq)
		}
	}

	dc.db.Delete(&domain)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "DNS-Records erfolgreich gelöscht."})
}
