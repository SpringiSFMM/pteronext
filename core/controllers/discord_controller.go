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
	db           *gorm.DB
	authService  *services.AuthService
	botService   *services.DiscordBotService
	auditService *services.AuditService
}

func NewDiscordController(db *gorm.DB, authService *services.AuthService, botService *services.DiscordBotService, auditService *services.AuditService) *DiscordController {
	return &DiscordController{db: db, authService: authService, botService: botService, auditService: auditService}
}

type DiscordConfigRequest struct {
	Enabled              bool   `json:"enabled"`
	ClientID             string `json:"client_id"`
	ClientSecret         string `json:"client_secret"`
	BotToken             string `json:"bot_token"`
	GuildID              string `json:"guild_id"`
	RedirectURI          string `json:"redirect_uri"`
	SlashCommandsEnabled bool   `json:"slash_commands_enabled"`
	RoleMappings         string `json:"role_mappings"`
}

// GetDiscordConfig handles GET /api/admin/integrations/discord (Admin only)
func (d *DiscordController) GetDiscordConfig(c *gin.Context) {
	var settings []models.SystemSetting
	d.db.Where("key LIKE 'discord_%'").Find(&settings)

	configMap := make(map[string]string)
	for _, s := range settings {
		configMap[s.Key] = s.Value
	}

	botIdent := d.botService.GetBotIdentity()
	var botTag string
	if botIdent != nil {
		botTag = botIdent.BotTag
	}

	c.JSON(http.StatusOK, gin.H{
		"enabled":                configMap["discord_enabled"] == "true",
		"client_id":              configMap["discord_client_id"],
		"client_secret":          configMap["discord_client_secret"],
		"bot_token":              configMap["discord_bot_token"],
		"guild_id":               configMap["discord_guild_id"],
		"redirect_uri":           configMap["discord_redirect_uri"],
		"slash_commands_enabled": configMap["discord_slash_commands_enabled"] == "true",
		"role_mappings":          configMap["discord_role_mappings"],
		"bot_active":             configMap["discord_bot_token"] != "" && configMap["discord_enabled"] == "true",
		"bot_running":            d.botService.IsRunning(),
		"bot_tag":                botTag,
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

	slashEnabledStr := "false"
	if req.SlashCommandsEnabled {
		slashEnabledStr = "true"
	}
	saveSetting("discord_slash_commands_enabled", slashEnabledStr)
	saveSetting("discord_role_mappings", req.RoleMappings)

	// Trigger Discord Bot service reload in background
	if d.botService != nil {
		go d.botService.Reload()
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Discord integration and bot settings saved successfully.",
		"enabled": req.Enabled,
	})
}

// TestDiscordConnection handles POST /api/admin/integrations/discord/test (Admin only)
func (d *DiscordController) TestDiscordConnection(c *gin.Context) {
	var req struct {
		BotToken string `json:"bot_token"`
	}
	_ = c.ShouldBindJSON(&req)

	token := strings.TrimSpace(req.BotToken)
	if token == "" {
		var s models.SystemSetting
		d.db.Where("key = 'discord_bot_token'").First(&s)
		token = strings.TrimSpace(s.Value)
	}

	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kein Discord Bot-Token angegeben."})
		return
	}

	botIdent, err := d.botService.TestConnection(token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Verbindung fehlgeschlagen: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  fmt.Sprintf("Verbindung erfolgreich! Bot: %s", botIdent.BotTag),
		"bot_user": botIdent,
	})
}

// GetDiscordRoles handles GET /api/admin/integrations/discord/roles (Admin only)
func (d *DiscordController) GetDiscordRoles(c *gin.Context) {
	var guildSetting, tokenSetting models.SystemSetting
	d.db.Where("key = 'discord_guild_id'").First(&guildSetting)
	d.db.Where("key = 'discord_bot_token'").First(&tokenSetting)

	guildID := strings.TrimSpace(guildSetting.Value)
	token := strings.TrimSpace(tokenSetting.Value)

	if guildID == "" || token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Guild-ID und Bot-Token müssen konfiguriert sein."})
		return
	}

	roles, err := d.botService.GetGuildRoles(guildID, token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"roles": roles,
	})
}

// SyncSlashCommands handles POST /api/admin/integrations/discord/sync-commands (Admin only)
func (d *DiscordController) SyncSlashCommands(c *gin.Context) {
	var clientIDSetting, guildSetting, tokenSetting models.SystemSetting
	d.db.Where("key = 'discord_client_id'").First(&clientIDSetting)
	d.db.Where("key = 'discord_guild_id'").First(&guildSetting)
	d.db.Where("key = 'discord_bot_token'").First(&tokenSetting)

	clientID := strings.TrimSpace(clientIDSetting.Value)
	guildID := strings.TrimSpace(guildSetting.Value)
	token := strings.TrimSpace(tokenSetting.Value)

	if clientID == "" || guildID == "" || token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Client-ID, Guild-ID und Bot-Token sind erforderlich, um Slash-Commands zu registrieren."})
		return
	}

	if err := d.botService.RegisterSlashCommands(clientID, guildID, token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Registrierung fehlgeschlagen: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Slash-Commands (/server list, /server status, /server start, /server stop, /server restart, /link, /panel) erfolgreich auf Discord registriert!",
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

// GetUserByDiscordID handles GET /api/discord/users/:discord_id
func (d *DiscordController) GetUserByDiscordID(c *gin.Context) {
	discordID := strings.TrimSpace(c.Param("discord_id"))
	if discordID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "discord_id parameter required"})
		return
	}

	var user models.User
	if err := d.db.Where("discord_id = ?", discordID).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"linked":  false,
			"message": "Discord account is not linked to any PteroNext panel account.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"linked": true,
		"user": gin.H{
			"id":               user.ID,
			"username":         user.Username,
			"email":            user.Email,
			"root_admin":       user.RootAdmin,
			"role":             user.Role,
			"discord_id":       user.DiscordID,
			"discord_username": user.DiscordUsername,
		},
	})
}

// ─────────────────────────────────────────────────────────────
// BOT GUILD & FEATURE MANAGEMENT (ADMIN DASHBOARD)
// ─────────────────────────────────────────────────────────────

// GetBotStatus handles GET /api/admin/integrations/discord/status
func (d *DiscordController) GetBotStatus(c *gin.Context) {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:25566/api/bot/status")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":     true,
			"bot_running": d.botService.IsRunning(),
			"bot_tag":     "PteroNext.com#7367",
		})
		return
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err == nil {
		c.JSON(http.StatusOK, gin.H{
			"success":     true,
			"bot_running": true,
			"bot_tag":     data["bot"],
			"details":     data,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"bot_running": true,
		"bot_tag":     "PteroNext.com#7367",
	})
}

// GetBotGuilds handles GET /api/admin/integrations/discord/guilds
func (d *DiscordController) GetBotGuilds(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)
	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get("http://127.0.0.1:25566/api/bot/guilds")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":     false,
			"bot_running": d.botService.IsRunning(),
			"bot_tag":     "PteroNext.com#7367",
			"guilds":      []interface{}{},
			"error":       "Discord Bot Sync-Server ist offline oder startet noch.",
		})
		return
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Ungültige Antwort vom Bot Sync-Server"})
		return
	}

	data["bot_running"] = true
	if data["bot"] != nil {
		data["bot_tag"] = data["bot"]
	} else {
		data["bot_tag"] = "PteroNext.com#7367"
	}

	// Filter guilds by user's BetaDiscordScope if not root admin
	if user != nil && !user.RootAdmin {
		var scope []string
		if err := json.Unmarshal([]byte(user.BetaDiscordScope), &scope); err == nil && len(scope) > 0 {
			hasWildcard := false
			for _, s := range scope {
				if strings.TrimSpace(s) == "*" {
					hasWildcard = true
					break
				}
			}
			if !hasWildcard {
				if rawGuilds, ok := data["guilds"].([]interface{}); ok {
					var filtered []interface{}
					for _, rg := range rawGuilds {
						if gm, ok := rg.(map[string]interface{}); ok {
							gid := fmt.Sprintf("%v", gm["id"])
							for _, allowed := range scope {
								if strings.TrimSpace(allowed) == gid {
									filtered = append(filtered, gm)
									break
								}
							}
						}
					}
					data["guilds"] = filtered
				}
			}
		}
	}

	c.JSON(resp.StatusCode, data)
}

type ClaimGuildRequest struct {
	GuildID string `json:"guild_id" binding:"required"`
}

// ClaimBotGuild handles POST /api/admin/integrations/discord/guilds/claim
// Allows a Beta Tester (or admin) to register/claim their Discord server if their linked Discord account is the server owner.
func (d *DiscordController) ClaimBotGuild(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// 1. Check if user has linked their Discord account
	if strings.TrimSpace(user.DiscordID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":    false,
			"needs_link": true,
			"error":      "Bitte verknüpfe zuerst deinen Discord-Account in den Profileinstellungen, um die Inhaberschaft deines Discord-Servers verifizieren zu können.",
			"error_en":   "Please link your Discord account in your Profile Settings first to verify ownership of your Discord server.",
		})
		return
	}

	var req ClaimGuildRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.GuildID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":  false,
			"error":    "Bitte gib eine gültige Discord Server-ID (Guild ID) ein.",
			"error_en": "Please provide a valid Discord Server ID (Guild ID).",
		})
		return
	}

	cleanGuildID := strings.TrimSpace(req.GuildID)

	// 2. Fetch guild details from Bot Sync Server or Discord REST API
	client := &http.Client{Timeout: 5 * time.Second}
	var foundGuild map[string]interface{}

	resp, err := client.Get("http://127.0.0.1:25566/api/bot/guilds")
	if err == nil {
		defer resp.Body.Close()
		var data map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&data); err == nil {
			if rawGuilds, ok := data["guilds"].([]interface{}); ok {
				for _, rg := range rawGuilds {
					if gm, ok := rg.(map[string]interface{}); ok {
						if fmt.Sprintf("%v", gm["id"]) == cleanGuildID {
							foundGuild = gm
							break
						}
					}
				}
			}
		}
	}

	// If not found in sync server cache, query Discord API directly with bot token
	if foundGuild == nil {
		var tokenSetting models.SystemSetting
		d.db.Where("key = 'discord_bot_token'").First(&tokenSetting)
		botToken := strings.TrimSpace(tokenSetting.Value)

		if botToken != "" {
			reqDiscord, _ := http.NewRequest("GET", fmt.Sprintf("https://discord.com/api/v10/guilds/%s", cleanGuildID), nil)
			reqDiscord.Header.Set("Authorization", "Bot "+botToken)
			reqDiscord.Header.Set("User-Agent", "PteroNext-Panel")

			respDiscord, errDiscord := client.Do(reqDiscord)
			if errDiscord == nil {
				defer respDiscord.Body.Close()
				if respDiscord.StatusCode == http.StatusOK {
					var discordGuild map[string]interface{}
					if err := json.NewDecoder(respDiscord.Body).Decode(&discordGuild); err == nil {
						foundGuild = discordGuild
					}
				}
			}
		}
	}

	// If guild is still not found, bot is not on that server
	if foundGuild == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":    false,
			"not_found":  true,
			"invite_url": "https://discord.com/oauth2/authorize?client_id=1560663382296895608&permissions=8&scope=bot%20applications.commands",
			"error":      "Der PteroNext-Bot befindet sich nicht auf diesem Discord-Server oder die Server-ID existiert nicht. Bitte lade den Bot zuerst auf deinen Discord-Server ein.",
			"error_en":   "The PteroNext bot is not present on this Discord server or the server ID does not exist. Please invite the bot to your server first.",
		})
		return
	}

	// 3. Verify Server Ownership
	ownerID := fmt.Sprintf("%v", foundGuild["owner_id"])
	if ownerID == "" {
		ownerID = fmt.Sprintf("%v", foundGuild["ownerId"])
	}

	guildName := fmt.Sprintf("%v", foundGuild["name"])
	if guildName == "" {
		guildName = "Discord Server (" + cleanGuildID + ")"
	}

	if !user.RootAdmin && ownerID != user.DiscordID {
		c.JSON(http.StatusForbidden, gin.H{
			"success":  false,
			"error":    fmt.Sprintf("Verifikation fehlgeschlagen: Du bist nicht der Eigentümer dieses Discord-Servers. Dieser Server gehört dem Discord-Account mit ID %s (deine verknüpfte Discord-ID: %s). Nur der Server-Owner kann den Server freischalten.", ownerID, user.DiscordID),
			"error_en": fmt.Sprintf("Verification failed: You are not the owner of this Discord server. This server is owned by Discord account ID %s (your linked Discord ID: %s). Only the server owner can claim this server.", ownerID, user.DiscordID),
		})
		return
	}

	// 4. Update user's BetaDiscordScope
	var scope []string
	_ = json.Unmarshal([]byte(user.BetaDiscordScope), &scope)

	alreadyInScope := false
	for _, s := range scope {
		if strings.TrimSpace(s) == cleanGuildID || strings.TrimSpace(s) == "*" {
			alreadyInScope = true
			break
		}
	}

	if !alreadyInScope {
		scope = append(scope, cleanGuildID)
		newBytes, _ := json.Marshal(scope)
		user.BetaDiscordScope = string(newBytes)
		d.db.Model(&user).Update("beta_discord_scope", user.BetaDiscordScope)
	}

	// Ensure user has beta tester status & discord_bot_mgmt enabled
	if !user.IsBetaTester && !user.RootAdmin {
		user.IsBetaTester = true
		d.db.Model(&user).Update("is_beta_tester", true)
	}
	var features []string
	_ = json.Unmarshal([]byte(user.BetaFeatures), &features)
	hasFeature := false
	for _, f := range features {
		if f == "discord_bot_mgmt" || f == "*" {
			hasFeature = true
			break
		}
	}
	if !hasFeature && !user.RootAdmin {
		features = append(features, "discord_bot_mgmt")
		featBytes, _ := json.Marshal(features)
		user.BetaFeatures = string(featBytes)
		d.db.Model(&user).Update("beta_features", user.BetaFeatures)
	}

	// 5. Audit logging
	_ = d.auditService.Log(&user.ID, "user", nil, "discord:claim_guild", map[string]interface{}{
		"guild_id":   cleanGuildID,
		"guild_name": guildName,
		"discord_id": user.DiscordID,
		"owner_id":   ownerID,
	}, c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"success":            true,
		"message":            fmt.Sprintf("Discord-Server '%s' wurde erfolgreich für deinen Account freigeschaltet!", guildName),
		"message_en":         fmt.Sprintf("Discord server '%s' has been successfully linked and unlocked for your account!", guildName),
		"guild": gin.H{
			"id":       cleanGuildID,
			"name":     guildName,
			"icon":     foundGuild["icon"],
			"is_owner": true,
		},
		"beta_discord_scope": scope,
	})
}

// GetBotCommands handles GET /api/admin/integrations/discord/commands
func (d *DiscordController) GetBotCommands(c *gin.Context) {
	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get("http://127.0.0.1:25566/api/bot/commands")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":  false,
			"commands": []interface{}{},
			"error":    "Discord Bot Sync-Server ist offline oder startet noch.",
		})
		return
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Ungültige Antwort vom Bot Sync-Server"})
		return
	}

	c.JSON(resp.StatusCode, data)
}

// GetBotGuildConfig handles GET /api/admin/integrations/discord/guilds/:guild_id/config
func (d *DiscordController) GetBotGuildConfig(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)
	guildID := strings.TrimSpace(c.Param("guild_id"))
	if guildID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "guild_id parameter required"})
		return
	}

	if user != nil && !user.RootAdmin && !user.HasBetaFeature("discord_bot_mgmt", "", guildID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Zugriff verweigert: Du hast keine Berechtigung für diesen Discord-Server."})
		return
	}

	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:25566/api/bot/guilds/%s/config", url.PathEscape(guildID)))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Bot Sync-Server nicht erreichbar"})
		return
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Ungültige Antwort vom Bot Sync-Server"})
		return
	}

	c.JSON(resp.StatusCode, data)
}

// SaveBotGuildConfig handles POST /api/admin/integrations/discord/guilds/:guild_id/config
func (d *DiscordController) SaveBotGuildConfig(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	guildID := strings.TrimSpace(c.Param("guild_id"))
	if guildID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "guild_id parameter required"})
		return
	}

	if !user.RootAdmin && !user.HasBetaFeature("discord_bot_mgmt", "", guildID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Zugriff verweigert: Du hast keine Berechtigung für diesen Discord-Server."})
		return
	}

	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON payload"})
		return
	}

	// 1. Fetch current config before applying updates to generate detailed change diff
	httpClient := &http.Client{Timeout: 5 * time.Second}
	oldConfig := make(map[string]interface{})
	oldResp, err := httpClient.Get(fmt.Sprintf("http://127.0.0.1:25566/api/bot/guilds/%s/config", url.PathEscape(guildID)))
	if err == nil && oldResp.StatusCode == http.StatusOK {
		var oldData struct {
			Config map[string]interface{} `json:"config"`
		}
		if err := json.NewDecoder(oldResp.Body).Decode(&oldData); err == nil && oldData.Config != nil {
			oldConfig = oldData.Config
		}
		oldResp.Body.Close()
	}

	// 2. Mark updated_by
	payload["updated_by"] = fmt.Sprintf("%s (User #%d)", user.Username, user.ID)

	// 3. Forward update to Bot Sync-Server
	bodyBytes, _ := json.Marshal(payload)
	postResp, err := httpClient.Post(
		fmt.Sprintf("http://127.0.0.1:25566/api/bot/guilds/%s/config", url.PathEscape(guildID)),
		"application/json",
		bytes.NewReader(bodyBytes),
	)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Bot Sync-Server nicht erreichbar: " + err.Error()})
		return
	}
	defer postResp.Body.Close()

	var resultData map[string]interface{}
	_ = json.NewDecoder(postResp.Body).Decode(&resultData)

	// 4. Calculate detailed diff between oldConfig and payload for Audit Log
	var changes []string
	readableNames := map[string]string{
		"leveling_enabled":             "Level & XP System",
		"tickets_enabled":              "Support Tickets",
		"moderation_enabled":           "Auto-Mod & Security",
		"suggestions_enabled":          "Suggestions & Voting",
		"giveaways_enabled":            "Giveaways",
		"ticket_transcripts_enabled":   "Ticket Transcripts",
		"ticket_claim_enabled":         "Ticket Claiming",
		"level_roles_enabled":          "Level Role Rewards",
		"level_pings_enabled":          "Level Up Pings",
		"welcome_dm_enabled":           "Welcome DM",
		"automod_links_enabled":        "Anti-Link Filter",
		"automod_spam_enabled":         "Anti-Spam Filter",
		"ai_assistant_enabled":         "AI Troubleshooter",
		"starboard_enabled":            "Starboard",
		"welcome_channel_id":           "Welcome Channel",
		"leave_channel_id":             "Leave Channel",
		"log_channel_id":               "Audit / Mod-Logs Channel",
		"ticket_category_id":           "Ticket Category",
		"ticket_transcript_channel_id": "Ticket Transcripts Channel",
		"ticket_support_role_id":       "Ticket Support Role",
		"level_up_channel_id":          "Level-Up Channel",
		"suggestion_channel_id":        "Suggestions Channel",
		"starboard_channel_id":         "Starboard Channel",
		"alerts_channel_id":            "Alerts Channel",
		"welcome_message":              "Welcome Message Template",
		"leave_message":                "Leave Message Template",
		"ticket_welcome_message":       "Ticket Welcome Message",
		"level_up_message":             "Level Up Message",
		"disabled_commands":            "Disabled Commands",
		"autorole_enabled":             "Auto-Role System",
		"autorole_role_id":             "Auto-Role Target Role",
	}

	for k, newVal := range payload {
		if k == "updated_by" || k == "guild_id" {
			continue
		}
		label := readableNames[k]
		if label == "" {
			label = k
		}

		oldVal := oldConfig[k]
		newValStr := fmt.Sprintf("%v", newVal)
		oldValStr := fmt.Sprintf("%v", oldVal)

		if newValStr != oldValStr {
			changes = append(changes, fmt.Sprintf("%s: %s -> %s", label, oldValStr, newValStr))
		}
	}

	guildName := fmt.Sprintf("Guild %s", guildID)
	if name, ok := payload["guild_name"].(string); ok && name != "" {
		guildName = name
	} else if name, ok := oldConfig["guild_name"].(string); ok && name != "" {
		guildName = name
	}

	// 5. Record Detailed Audit Log Entry
	if d.auditService != nil {
		diffSummary := fmt.Sprintf("Admin %s updated Discord Bot configuration for %s (%d changes)", user.Username, guildName, len(changes))
		_ = d.auditService.Log(
			&user.ID,
			"user",
			nil,
			"discord:bot_config_updated",
			map[string]interface{}{
				"guild_id":   guildID,
				"guild_name": guildName,
				"changes":    changes,
				"summary":    diffSummary,
				"timestamp":  time.Now().UTC().Format(time.RFC3339),
			},
			c.ClientIP(),
		)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Discord Bot Konfiguration für %s erfolgreich gespeichert und live angewendet!", guildName),
		"changes": changes,
		"config":  resultData["config"],
	})
}

// SyncBotGuildAutorole handles POST /api/admin/integrations/discord/guilds/:guild_id/sync-autorole
func (d *DiscordController) SyncBotGuildAutorole(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	guildID := strings.TrimSpace(c.Param("guild_id"))
	if guildID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "guild_id parameter required"})
		return
	}

	if !user.RootAdmin && !user.HasBetaFeature("discord_bot_mgmt", "", guildID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Zugriff verweigert: Du hast keine Berechtigung für diesen Discord-Server."})
		return
	}

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Post(
		fmt.Sprintf("http://127.0.0.1:25566/api/bot/guilds/%s/sync-autorole", url.PathEscape(guildID)),
		"application/json",
		nil,
	)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Bot Sync-Server nicht erreichbar: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Ungültige Antwort vom Bot Sync-Server"})
		return
	}

	// Record audit log for mass role sync
	if d.auditService != nil && resp.StatusCode == http.StatusOK {
		_ = d.auditService.Log(
			&user.ID,
			"user",
			nil,
			"discord:bot_autorole_synced",
			map[string]interface{}{
				"guild_id":       guildID,
				"assigned_count": data["assigned_count"],
				"role_name":      data["role_name"],
				"timestamp":      time.Now().UTC().Format(time.RFC3339),
			},
			c.ClientIP(),
		)
	}

	c.JSON(resp.StatusCode, data)
}

// GetBotAuditLogs handles GET /api/admin/integrations/discord/audit-logs
func (d *DiscordController) GetBotAuditLogs(c *gin.Context) {
	var logs []models.AuditLog
	d.db.Where("event LIKE 'discord:%'").Order("id desc").Limit(50).Find(&logs)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"logs":    logs,
	})
}

// GetBotClusterNodes handles GET /api/admin/integrations/discord/cluster
func (d *DiscordController) GetBotClusterNodes(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)
	if user != nil && !user.RootAdmin && !user.HasBetaFeature("discord_bot_mgmt", "", "") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Zugriff verweigert."})
		return
	}

	httpClient := &http.Client{Timeout: 4 * time.Second}
	resp, err := httpClient.Get("http://127.0.0.1:25566/api/bot/cluster")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Bot Sync-Server nicht erreichbar"})
		return
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Ungültige Antwort vom Bot Sync-Server"})
		return
	}

	c.JSON(resp.StatusCode, data)
}

// TriggerBotClusterFailover handles POST /api/admin/integrations/discord/cluster/failover
func (d *DiscordController) TriggerBotClusterFailover(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil || !user.RootAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin rights required for manual cluster failover."})
		return
	}

	httpClient := &http.Client{Timeout: 5 * time.Second}
	resp, err := httpClient.Post("http://127.0.0.1:25566/api/bot/cluster/failover", "application/json", nil)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Bot Sync-Server nicht erreichbar: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Ungültige Antwort"})
		return
	}

	if d.auditService != nil {
		_ = d.auditService.Log(
			&user.ID,
			"user",
			nil,
			"discord:cluster_failover_triggered",
			map[string]interface{}{
				"summary":   fmt.Sprintf("Admin %s triggered manual Discord Bot cluster failover", user.Username),
				"timestamp": time.Now().UTC().Format(time.RFC3339),
			},
			c.ClientIP(),
		)
	}

	c.JSON(resp.StatusCode, data)
}
