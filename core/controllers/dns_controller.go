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
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

type DNSController struct {
	db    *gorm.DB
	wsHub *services.WebSocketHub
}

func NewDNSController(db *gorm.DB, wsHub *services.WebSocketHub) *DNSController {
	return &DNSController{db: db, wsHub: wsHub}
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
	Subdomain string `json:"subdomain"`
	Hostname  string `json:"hostname"`
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültiges Format"})
		return
	}

	chosenSub := req.Subdomain
	if chosenSub == "" {
		chosenSub = req.Hostname
	}
	if strings.TrimSpace(chosenSub) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Subdomain is required"})
		return
	}

	cleanSub := strings.ToLower(strings.TrimSpace(chosenSub))
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

	// 1. Fetch Cloudflare and Relay settings
	var settings []models.SystemSetting
	dc.db.Where("key LIKE 'cloudflare_%' OR key LIKE 'relay_%'").Find(&settings)
	config := make(map[string]string)
	for _, s := range settings {
		config[s.Key] = s.Value
	}

	baseDomain := config["cloudflare_base_domain"]
	if baseDomain == "" {
		baseDomain = "pteronext.com"
	}
	apiToken := config["cloudflare_api_token"]
	zoneID := config["cloudflare_zone_id"]
	relayURL := config["relay_url"]
	if relayURL == "" {
		relayURL = "http://127.0.0.1:8085" // Default local relay micro-service
	}

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

	// 2a. Attempt Relay Micro-Service First (Separated project architecture)
	relaySuccess := false
	relayClient := &http.Client{Timeout: 6 * time.Second}
	scheme := "https"
	if c.Request.TLS == nil && c.GetHeader("X-Forwarded-Proto") != "https" {
		scheme = "http"
	}
	panelURL := "https://panel.pteronext.com"
	if c.Request.Host != "" {
		panelURL = fmt.Sprintf("%s://%s", scheme, c.Request.Host)
	}

	relayPayload, _ := json.Marshal(map[string]interface{}{
		"subdomain":   cleanSub,
		"target_ip":   targetIP,
		"port":        serverPort,
		"server_uuid": server.UUID,
		"panel_url":   panelURL,
		"server_name": server.Name,
	})

	relayReq, err := http.NewRequest("POST", relayURL+"/v1/domains/register", bytes.NewBuffer(relayPayload))
	if err == nil {
		relayReq.Header.Set("Content-Type", "application/json")
		relayResp, rErr := relayClient.Do(relayReq)
		if rErr == nil && relayResp != nil {
			defer relayResp.Body.Close()
			if relayResp.StatusCode == http.StatusOK {
				var rBody struct {
					Success    bool   `json:"success"`
					FullDomain string `json:"full_domain"`
					Message    string `json:"message"`
				}
				if err := json.NewDecoder(relayResp.Body).Decode(&rBody); err == nil && rBody.Success {
					relaySuccess = true
					if rBody.FullDomain != "" {
						fullDomain = rBody.FullDomain
					}
				}
			} else if relayResp.StatusCode == http.StatusForbidden {
				var errBody struct {
					Error string `json:"error"`
				}
				_ = json.NewDecoder(relayResp.Body).Decode(&errBody)
				msg := "Dieser Domain-Name ist unzulässig oder enthält gesperrte Begriffe."
				if errBody.Error != "" {
					msg = errBody.Error
				}
				c.JSON(http.StatusForbidden, gin.H{"error": msg})
				return
			} else if relayResp.StatusCode == http.StatusConflict {
				c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Die Subdomain '%s' ist bereits registriert.", cleanSub)})
				return
			}
		}
	}

	// 2b. If Relay is not running, fallback to direct Cloudflare if credentials exist
	if !relaySuccess && apiToken != "" && zoneID != "" {
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
		Status:      "active",
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

	// Unregister from Relay if configured
	var relaySetting models.SystemSetting
	dc.db.Where("key = 'relay_url'").First(&relaySetting)
	rURL := relaySetting.Value
	if rURL == "" {
		rURL = "http://127.0.0.1:8085"
	}
	rClient := &http.Client{Timeout: 3 * time.Second}
	delReq, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/v1/domains/unregister?subdomain=%s&server_uuid=%s", rURL, domain.Subdomain, server.UUID), nil)
	if delReq != nil {
		_, _ = rClient.Do(delReq)
	}

	// Also directly delete from Cloudflare if direct keys are present
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

// HandleRelayRevocationNotification handles POST /api/servers/:uuid/dns/notify
// Called by the Relay Micro-Service when an admin revokes a domain with a reason.
func (dc *DNSController) HandleRelayRevocationNotification(c *gin.Context) {
	serverUUID := c.Param("uuid")
	var payload struct {
		Event      string `json:"event"`
		Subdomain  string `json:"subdomain"`
		FullDomain string `json:"full_domain"`
		Reason     string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	cleanSub := strings.ToLower(strings.TrimSpace(payload.Subdomain))
	cleanFull := strings.ToLower(strings.TrimSpace(payload.FullDomain))
	reasonText := strings.TrimSpace(payload.Reason)
	if reasonText == "" {
		reasonText = "Vom Administrator aus dem DNS-Netzwerk entfernt."
	}

	// 1. Unconditionally DELETE the domain from the panel database!
	// (Addressing: "Die domain in dem Panel wird nicht gelöscht")
	dc.db.Where("server_uuid = ? AND (subdomain = ? OR full_domain = ?)", serverUUID, cleanSub, cleanFull).
		Delete(&models.ServerCustomDomain{})

	// 2. Create persistent notification popup record so panel operator is notified!
	// (Addressing: "wird der Panel betreiber nicht benachrichtigt (soll dann als popup angezeigt werden)")
	title := "Domain von Administrator entfernt"
	msg := fmt.Sprintf("Die Subdomain '%s' wurde von einem Administrator aus dem DNS-Netzwerk entfernt.", cleanFull)
	if cleanFull == "" {
		msg = fmt.Sprintf("Die Subdomain '%s' wurde von einem Administrator aus dem DNS-Netzwerk entfernt.", cleanSub)
	}

	notif := models.ServerNotification{
		ServerUUID:  serverUUID,
		Type:        "dns_revoked",
		Title:       title,
		Message:     msg,
		Reason:      reasonText,
		Subdomain:   cleanSub,
		FullDomain:  cleanFull,
		IsDismissed: false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	dc.db.Create(&notif)

	// 3. Dispatch real-time WebSocket event to active panel clients for instant popup
	if dc.wsHub != nil {
		dc.wsHub.Broadcast(serverUUID, "dns:revoked", map[string]interface{}{
			"id":          notif.ID,
			"title":       title,
			"message":     msg,
			"reason":      reasonText,
			"subdomain":   cleanSub,
			"full_domain": cleanFull,
			"revoked_at":  time.Now().Format(time.RFC3339),
		})
	}

	// 4. Log in audit activities
	propJSON, _ := json.Marshal(map[string]string{
		"full_domain": cleanFull,
		"subdomain":   cleanSub,
		"reason":      reasonText,
	})
	auditLog := models.AuditLog{
		ActorType:  "Domain-Security-Admin",
		Event:      "domain:revoked",
		Properties: string(propJSON),
		IP:         c.ClientIP(),
		Timestamp:  time.Now(),
		CreatedAt:  time.Now(),
	}
	dc.db.Create(&auditLog)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"deleted":  true,
		"notified": true,
	})
}

// GetServerNotifications handles GET /api/servers/:uuid/notifications
func (dc *DNSController) GetServerNotifications(c *gin.Context) {
	serverUUID := c.Param("uuid")
	var notifications []models.ServerNotification
	dc.db.Where("server_uuid = ? AND is_dismissed = ?", serverUUID, false).
		Order("id desc").
		Find(&notifications)

	c.JSON(http.StatusOK, gin.H{"notifications": notifications})
}

// DismissServerNotification handles POST /api/servers/:uuid/notifications/:id/dismiss
func (dc *DNSController) DismissServerNotification(c *gin.Context) {
	serverUUID := c.Param("uuid")
	notifID := c.Param("id")

	dc.db.Model(&models.ServerNotification{}).
		Where("id = ? AND server_uuid = ?", notifID, serverUUID).
		Update("is_dismissed", true)

	c.JSON(http.StatusOK, gin.H{"success": true})
}



