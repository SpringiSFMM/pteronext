package controllers

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

type DiscordController struct {
	db          *gorm.DB
	authService *services.AuthService
}

func NewDiscordController(db *gorm.DB, authService *services.AuthService) *DiscordController {
	return &DiscordController{db: db, authService: authService}
}

type DiscordConfigRequest struct {
	Enabled      bool   `json:"enabled"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	BotToken     string `json:"bot_token"`
	GuildID      string `json:"guild_id"`
	RedirectURI  string `json:"redirect_uri"`
}

// GetDiscordConfig handles GET /api/admin/integrations/discord (Admin only)
func (d *DiscordController) GetDiscordConfig(c *gin.Context) {
	var settings []models.SystemSetting
	d.db.Where("key LIKE 'discord_%'").Find(&settings)

	configMap := make(map[string]string)
	for _, s := range settings {
		configMap[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, gin.H{
		"enabled":       configMap["discord_enabled"] == "true",
		"client_id":     configMap["discord_client_id"],
		"client_secret": configMap["discord_client_secret"],
		"bot_token":     configMap["discord_bot_token"],
		"guild_id":      configMap["discord_guild_id"],
		"redirect_uri":  configMap["discord_redirect_uri"],
		"bot_active":    configMap["discord_bot_token"] != "",
	})
}

// SaveDiscordConfig handles POST /api/admin/integrations/discord (Admin only)
func (d *DiscordController) SaveDiscordConfig(c *gin.Context) {
	var req DiscordConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Discord config payload"})
		return
	}

	saveSetting := func(key, val string) {
		var s models.SystemSetting
		if err := d.db.Where("key = ?", key).First(&s).Error; err != nil {
			d.db.Create(&models.SystemSetting{Key: key, Value: val, UpdatedAt: time.Now()})
		} else {
			d.db.Model(&s).Updates(map[string]interface{}{"value": val, "updated_at": time.Now()})
		}
	}

	enabledStr := "false"
	if req.Enabled {
		enabledStr = "true"
	}
	saveSetting("discord_enabled", enabledStr)
	saveSetting("discord_client_id", req.ClientID)
	if req.ClientSecret != "" {
		saveSetting("discord_client_secret", req.ClientSecret)
	}
	if req.BotToken != "" {
		saveSetting("discord_bot_token", req.BotToken)
	}
	saveSetting("discord_guild_id", req.GuildID)
	saveSetting("discord_redirect_uri", req.RedirectURI)

	c.JSON(http.StatusOK, gin.H{
		"message": "Discord integration settings saved successfully.",
		"enabled": req.Enabled,
	})
}

// GetPublicStatus handles GET /api/auth/discord/status
func (d *DiscordController) GetPublicStatus(c *gin.Context) {
	var enabledSetting, clientIDSetting models.SystemSetting
	d.db.Where("key = 'discord_enabled'").First(&enabledSetting)
	d.db.Where("key = 'discord_client_id'").First(&clientIDSetting)

	c.JSON(http.StatusOK, gin.H{
		"enabled":   enabledSetting.Value == "true",
		"client_id": clientIDSetting.Value,
	})
}

// DiscordLogin handles GET /api/auth/discord/login (Initiates official OAuth2 redirect)
func (d *DiscordController) DiscordLogin(c *gin.Context) {
	var settings []models.SystemSetting
	d.db.Where("key LIKE 'discord_%'").Find(&settings)
	configMap := make(map[string]string)
	for _, s := range settings {
		configMap[s.Key] = s.Value
	}

	enabled := configMap["discord_enabled"] == "true"
	clientID := strings.TrimSpace(configMap["discord_client_id"])
	if !enabled || clientID == "" {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=discord_disabled")
		return
	}

	redirectURI := strings.TrimSpace(configMap["discord_redirect_uri"])
	if redirectURI == "" {
		proto := "https"
		if c.Request.TLS == nil && c.GetHeader("X-Forwarded-Proto") != "https" {
			proto = "http"
		}
		redirectURI = fmt.Sprintf("%s://%s/api/auth/discord/callback", proto, c.Request.Host)
	}

	// 32-character random state token for CSRF protection
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	state := fmt.Sprintf("%x", b)

	authURL := fmt.Sprintf(
		"https://discord.com/oauth2/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&state=%s&prompt=consent",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape("identify email"),
		url.QueryEscape(state),
	)

	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// DiscordCallback handles GET /api/auth/discord/callback (Exchanges code and logs user in)
func (d *DiscordController) DiscordCallback(c *gin.Context) {
	if errParam := c.Query("error"); errParam != "" {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=discord_cancelled")
		return
	}

	code := strings.TrimSpace(c.Query("code"))
	if code == "" {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=missing_code")
		return
	}

	var settings []models.SystemSetting
	d.db.Where("key LIKE 'discord_%'").Find(&settings)
	configMap := make(map[string]string)
	for _, s := range settings {
		configMap[s.Key] = s.Value
	}

	clientID := strings.TrimSpace(configMap["discord_client_id"])
	clientSecret := strings.TrimSpace(configMap["discord_client_secret"])
	redirectURI := strings.TrimSpace(configMap["discord_redirect_uri"])
	if redirectURI == "" {
		proto := "https"
		if c.Request.TLS == nil && c.GetHeader("X-Forwarded-Proto") != "https" {
			proto = "http"
		}
		redirectURI = fmt.Sprintf("%s://%s/api/auth/discord/callback", proto, c.Request.Host)
	}

	form := url.Values{}
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)

	httpClient := &http.Client{Timeout: 10 * time.Second}
	tokenReq, err := http.NewRequest("POST", "https://discord.com/api/v10/oauth2/token", strings.NewReader(form.Encode()))
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=discord_exchange_failed")
		return
	}
	tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	tokenReq.Header.Set("User-Agent", "PteroNext-Panel")

	tokenResp, err := httpClient.Do(tokenReq)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=discord_network_error")
		return
	}
	defer tokenResp.Body.Close()

	if tokenResp.StatusCode != http.StatusOK {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=discord_token_rejected")
		return
	}

	var tokenData struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenData); err != nil || tokenData.AccessToken == "" {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=discord_invalid_token")
		return
	}

	// Query user details from Discord
	userReq, _ := http.NewRequest("GET", "https://discord.com/api/v10/users/@me", nil)
	userReq.Header.Set("Authorization", "Bearer "+tokenData.AccessToken)
	userReq.Header.Set("User-Agent", "PteroNext-Panel")

	userResp, err := httpClient.Do(userReq)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=discord_fetch_user_failed")
		return
	}
	defer userResp.Body.Close()

	var discordUser struct {
		ID       string `json:"id"`
		Username string `json:"username"`
		Email    string `json:"email"`
	}
	if err := json.NewDecoder(userResp.Body).Decode(&discordUser); err != nil || discordUser.ID == "" {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=discord_invalid_user")
		return
	}

	// Match user in database
	var user models.User
	err = d.db.Where("discord_id = ?", discordUser.ID).First(&user).Error
	if err != nil && discordUser.Email != "" {
		// Auto-link by matching email
		err = d.db.Where("LOWER(email) = ?", strings.ToLower(discordUser.Email)).First(&user).Error
		if err == nil {
			now := time.Now()
			_ = d.db.Model(&user).Updates(map[string]interface{}{
				"discord_id":        discordUser.ID,
				"discord_username":  discordUser.Username,
				"discord_linked_at": &now,
			})
		}
	}

	if user.ID == 0 {
		c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("/login?error=discord_not_linked&discord_tag=%s", url.QueryEscape(discordUser.Username)))
		return
	}

	// Generate authenticated session token
	token, err := d.authService.GenerateJWT(&user)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=token_generation_failed")
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("/login?discord_token=%s", url.QueryEscape(token)))
}

type RequestCodePayload struct {
	DiscordTag string `json:"discord_tag" binding:"required"`
	Language   string `json:"language"`
}

type ConfirmCodePayload struct {
	Code string `json:"code" binding:"required"`
}

type DiscordUserObj struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	GlobalName    string `json:"global_name"`
	Discriminator string `json:"discriminator"`
	Avatar        string `json:"avatar"`
}

type DiscordGuildMemberObj struct {
	User DiscordUserObj `json:"user"`
	Nick string         `json:"nick"`
}

type DiscordDMChannelObj struct {
	ID string `json:"id"`
}

// RequestVerificationCode handles POST /api/account/discord/request-code
func (d *DiscordController) RequestVerificationCode(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req RequestCodePayload
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.DiscordTag) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bitte gib deinen Discord-Benutzernamen, Tag oder deine User-ID ein."})
		return
	}

	input := strings.TrimSpace(req.DiscordTag)
	// Remove leading @ if present
	input = strings.TrimPrefix(input, "@")

	// 1. Fetch Discord settings
	var settings []models.SystemSetting
	d.db.Where("key LIKE 'discord_%'").Find(&settings)
	configMap := make(map[string]string)
	for _, s := range settings {
		configMap[s.Key] = s.Value
	}

	botToken := configMap["discord_bot_token"]
	guildID := configMap["discord_guild_id"]
	enabled := configMap["discord_enabled"] == "true"

	if !enabled || botToken == "" || guildID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Discord-Integration ist noch nicht vollständig eingerichtet. Bitte stelle sicher, dass im Admin-Dashboard das Bot-Token sowie die Discord Server-ID (Guild-ID) hinterlegt und aktiviert sind.",
		})
		return
	}

	// 2. Query Discord API to verify member is on the guild
	httpClient := &http.Client{Timeout: 10 * time.Second}
	var targetUser *DiscordUserObj

	// Check if input is numeric ID (Discord Snowflake is 17-20 digits)
	isNumericID := true
	for _, r := range input {
		if r < '0' || r > '9' {
			isNumericID = false
			break
		}
	}
	if len(input) < 16 || len(input) > 22 {
		isNumericID = false
	}

	if isNumericID {
		// Fetch member directly by ID
		memberReq, _ := http.NewRequest("GET", fmt.Sprintf("https://discord.com/api/v10/guilds/%s/members/%s", guildID, input), nil)
		memberReq.Header.Set("Authorization", "Bot "+botToken)
		memberReq.Header.Set("User-Agent", "PteroNext-Panel (https://panel.springisfm.de, v2.7.0)")

		resp, err := httpClient.Do(memberReq)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Verbindung zur Discord-API fehlgeschlagen: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var member DiscordGuildMemberObj
			if err := json.NewDecoder(resp.Body).Decode(&member); err == nil && member.User.ID != "" {
				targetUser = &member.User
			}
		} else if resp.StatusCode == http.StatusNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Du wurdest auf unserem Discord-Server nicht gefunden! Bitte trete zuerst unserem Discord-Server bei, bevor du die Verknüpfung durchführst.",
			})
			return
		} else if resp.StatusCode == http.StatusUnauthorized {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Das im Admin-Dashboard hinterlegte Discord-Bot-Token ist ungültig oder abgelaufen.",
			})
			return
		}
	}

	// If not found yet, search members by query
	if targetUser == nil {
		searchURL := fmt.Sprintf("https://discord.com/api/v10/guilds/%s/members/search?query=%s&limit=10", guildID, url.QueryEscape(input))
		searchReq, _ := http.NewRequest("GET", searchURL, nil)
		searchReq.Header.Set("Authorization", "Bot "+botToken)
		searchReq.Header.Set("User-Agent", "PteroNext-Panel (https://panel.springisfm.de, v2.7.0)")

		resp, err := httpClient.Do(searchReq)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Verbindung zur Discord-API fehlgeschlagen: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var members []DiscordGuildMemberObj
			if err := json.NewDecoder(resp.Body).Decode(&members); err == nil {
				inputLower := strings.ToLower(input)
				for _, m := range members {
					if strings.ToLower(m.User.Username) == inputLower ||
						strings.ToLower(m.User.GlobalName) == inputLower ||
						strings.ToLower(m.Nick) == inputLower ||
						strings.Contains(strings.ToLower(m.User.Username), inputLower) {
						targetUser = &m.User
						break
					}
				}
				if targetUser == nil && len(members) > 0 {
					targetUser = &members[0].User
				}
			}
		} else if resp.StatusCode == http.StatusUnauthorized {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Das im Admin-Dashboard hinterlegte Discord-Bot-Token ist ungültig oder abgelaufen.",
			})
			return
		}
	}

	if targetUser == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Benutzer '%s' wurde nicht auf unserem Discord-Server gefunden! Bitte stelle sicher, dass du auf unserem Discord-Server beigetreten bist.", input),
		})
		return
	}

	// 3. Open DM Channel with user
	dmPayload, _ := json.Marshal(map[string]string{
		"recipient_id": targetUser.ID,
	})
	dmReq, _ := http.NewRequest("POST", "https://discord.com/api/v10/users/@me/channels", bytes.NewBuffer(dmPayload))
	dmReq.Header.Set("Authorization", "Bot "+botToken)
	dmReq.Header.Set("Content-Type", "application/json")
	dmReq.Header.Set("User-Agent", "PteroNext-Panel (https://panel.springisfm.de, v2.7.0)")

	dmResp, err := httpClient.Do(dmReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Konnte DM-Kanal nicht anfordern: " + err.Error()})
		return
	}
	defer dmResp.Body.Close()

	if dmResp.StatusCode != http.StatusOK && dmResp.StatusCode != http.StatusCreated {
		var errData map[string]interface{}
		_ = json.NewDecoder(dmResp.Body).Decode(&errData)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Der Discord-Bot konnte dir keine Direktnachricht senden. Bitte aktiviere in deinen Discord-Server-Einstellungen 'Direktnachrichten von Servermitgliedern erlauben' und versuche es erneut.",
		})
		return
	}

	var dmChannel DiscordDMChannelObj
	if err := json.NewDecoder(dmResp.Body).Decode(&dmChannel); err != nil || dmChannel.ID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ungültige Antwort beim Erstellen des DM-Kanals."})
		return
	}

	// 4. Generate 6-digit verification code
	n, _ := rand.Int(rand.Reader, big.NewInt(900000))
	code := fmt.Sprintf("%06d", n.Int64()+100000)

	lang := strings.ToLower(strings.TrimSpace(req.Language))
	if lang != "en" {
		lang = "de"
	}

	// 5. Send message with code in DM (in user's requested language)
	displayName := targetUser.GlobalName
	if displayName == "" {
		displayName = targetUser.Username
	}

	var msgContent string
	if lang == "en" {
		msgContent = fmt.Sprintf("👋 Hello **%s**!\n\nYour PteroNext verification code is: **`%s`**\n\nEnter this 6-digit code in your PteroNext panel to link your Discord account with **%s**.\n⏱️ This code is valid for 10 minutes.",
			displayName, code, user.Username)
	} else {
		msgContent = fmt.Sprintf("👋 Hallo **%s**!\n\nDein PteroNext Verifizierungs-Code lautet: **`%s`**\n\nGib diesen 6-stelligen Code in deinem PteroNext-Panel ein, um deinen Discord-Account mit **%s** zu verknüpfen.\n⏱️ Dieser Code ist 10 Minuten gültig.",
			displayName, code, user.Username)
	}

	msgPayload, _ := json.Marshal(map[string]string{
		"content": msgContent,
	})
	sendMsgReq, _ := http.NewRequest("POST", fmt.Sprintf("https://discord.com/api/v10/channels/%s/messages", dmChannel.ID), bytes.NewBuffer(msgPayload))
	sendMsgReq.Header.Set("Authorization", "Bot "+botToken)
	sendMsgReq.Header.Set("Content-Type", "application/json")
	sendMsgReq.Header.Set("User-Agent", "PteroNext-Panel (https://panel.springisfm.de, v2.7.0)")

	sendResp, err := httpClient.Do(sendMsgReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Konnte DM nicht absenden: " + err.Error()})
		return
	}
	defer sendResp.Body.Close()

	if sendResp.StatusCode != http.StatusOK && sendResp.StatusCode != http.StatusCreated {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Der Bot konnte die Verifizierungs-Nachricht nicht senden. Bitte stelle sicher, dass deine DMs für diesen Server offen sind.",
		})
		return
	}

	// 6. Save or update verification record in DB
	d.db.Where("user_id = ? OR discord_id = ?", user.ID, targetUser.ID).Delete(&models.DiscordLinkVerification{})
	verification := models.DiscordLinkVerification{
		UserID:          user.ID,
		DiscordID:       targetUser.ID,
		DiscordUsername: targetUser.Username,
		Code:            code,
		DMChannelID:     dmChannel.ID,
		Language:        lang,
		ExpiresAt:       time.Now().Add(10 * time.Minute),
		CreatedAt:       time.Now(),
	}
	if err := d.db.Create(&verification).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Konnte Verifizierungsanfrage nicht speichern."})
		return
	}

	successMsg := fmt.Sprintf("Verifizierungs-Code wurde per DM an @%s gesendet!", targetUser.Username)
	if lang == "en" {
		successMsg = fmt.Sprintf("Verification code sent via DM to @%s!", targetUser.Username)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":            true,
		"message":            successMsg,
		"discord_id":         targetUser.ID,
		"discord_username":   targetUser.Username,
		"expires_in_seconds": 600,
	})
}

// ConfirmVerificationCode handles POST /api/account/discord/confirm-code
func (d *DiscordController) ConfirmVerificationCode(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req ConfirmCodePayload
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Code) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bitte gib den 6-stelligen Verifizierungs-Code ein."})
		return
	}

	cleanCode := strings.TrimSpace(req.Code)

	var verification models.DiscordLinkVerification
	if err := d.db.Where("user_id = ? AND expires_at > ?", user.ID, time.Now()).Order("id desc").First(&verification).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Es wurde kein aktiver Verifizierungs-Code gefunden oder der Code ist abgelaufen. Bitte fordere einen neuen Code an.",
		})
		return
	}

	if verification.Code != cleanCode {
		verification.Attempts++
		if verification.Attempts >= 5 {
			d.db.Where("user_id = ?", user.ID).Delete(&models.DiscordLinkVerification{})
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Zu viele Fehlversuche! Der Code wurde aus Sicherheitsgründen ungültig gemacht. Bitte fordere einen neuen Code an.",
			})
			return
		}
		d.db.Save(&verification)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Falscher Verifizierungs-Code! Noch %d Versuche übrig.", 5-verification.Attempts),
		})
		return
	}

	// Code is valid! Link Discord account
	now := time.Now()
	if err := d.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"discord_id":        verification.DiscordID,
		"discord_username":  verification.DiscordUsername,
		"discord_linked_at": &now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fehler beim Verknüpfen des Discord-Accounts."})
		return
	}

	// Unconditionally delete and deactivate ALL verification codes for this user immediately
	d.db.Where("user_id = ? OR discord_id = ?", user.ID, verification.DiscordID).Delete(&models.DiscordLinkVerification{})

	// Send success confirmation in DM
	var botTokenSetting models.SystemSetting
	d.db.Where("key = 'discord_bot_token'").First(&botTokenSetting)
	if botTokenSetting.Value != "" && verification.DMChannelID != "" {
		go func(token, channelID, username, vLang string) {
			client := &http.Client{Timeout: 5 * time.Second}
			var confContent string
			if vLang == "en" {
				confContent = fmt.Sprintf("✅ **Successfully linked!**\n\nYour Discord account has been successfully linked with PteroNext account **%s**. You can now conveniently log in via Discord!", username)
			} else {
				confContent = fmt.Sprintf("✅ **Erfolgreich verknüpft!**\n\nDein Discord-Account wurde erfolgreich mit dem PteroNext-Account **%s** verknüpft. Du kannst dich ab jetzt bequem über Discord anmelden!", username)
			}
			confPayload, _ := json.Marshal(map[string]string{
				"content": confContent,
			})
			req, _ := http.NewRequest("POST", fmt.Sprintf("https://discord.com/api/v10/channels/%s/messages", channelID), bytes.NewBuffer(confPayload))
			req.Header.Set("Authorization", "Bot "+token)
			req.Header.Set("Content-Type", "application/json")
			_, _ = client.Do(req)
		}(botTokenSetting.Value, verification.DMChannelID, user.Username, verification.Language)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":          true,
		"message":          "Discord-Account erfolgreich verknüpft!",
		"discord_id":       verification.DiscordID,
		"discord_username": verification.DiscordUsername,
	})
}

type LinkDiscordRequest struct {
	DiscordID       string `json:"discord_id" binding:"required"`
	DiscordUsername string `json:"discord_username" binding:"required"`
}

// LinkDiscord handles POST /api/account/discord/link (Legacy direct link)
func (d *DiscordController) LinkDiscord(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req LinkDiscordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "discord_id and discord_username required"})
		return
	}

	now := time.Now()
	if err := d.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"discord_id":        req.DiscordID,
		"discord_username":  req.DiscordUsername,
		"discord_linked_at": &now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed linking Discord account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Discord account successfully linked!",
		"discord_id":       req.DiscordID,
		"discord_username": req.DiscordUsername,
	})
}

// UnlinkDiscord handles POST /api/account/discord/unlink
func (d *DiscordController) UnlinkDiscord(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if err := d.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
		"discord_id":        "",
		"discord_username":  "",
		"discord_linked_at": nil,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed unlinking Discord account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Discord account unlinked."})
}
