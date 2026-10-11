package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

type SftpKeyController struct {
	db *gorm.DB
}

func NewSftpKeyController(db *gorm.DB) *SftpKeyController {
	return &SftpKeyController{db: db}
}

type CreateSftpKeyRequest struct {
	Label      string `json:"label" binding:"required"`
	TTLHours   int    `json:"ttl_hours"`   // e.g. 3 (hours)
	AllowedIPs string `json:"allowed_ips"` // Optional IP whitelist
}

// ListKeys handles GET /api/servers/:uuid/sftp-keys
func (s *SftpKeyController) ListKeys(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var keys []models.SftpAccessKey
	s.db.Where("server_id = ?", server.ID).Order("created_at desc").Find(&keys)

	nodeFQDN := "127.0.0.1"
	sftpPort := 2022
	if server.Node != nil {
		nodeFQDN = server.Node.FQDN
		if server.Node.DaemonSFTPPort > 0 {
			sftpPort = server.Node.DaemonSFTPPort
		}
	}

	type KeyResponse struct {
		models.SftpAccessKey
		IsExpired   bool   `json:"is_expired"`
		SftpURI     string `json:"sftp_uri"`
		FileZillaURI string `json:"filezilla_uri"`
		WinSCPLink  string `json:"winscp_link"`
	}

	res := make([]KeyResponse, len(keys))
	for i, k := range keys {
		expired := k.IsExpired()

		fullUser := fmt.Sprintf("%s.%s", k.Username, server.Identifier)
		// sftp://username:password@fqdn:port/
		encodedUser := url.QueryEscape(fullUser)
		encodedPass := url.QueryEscape(k.Password)
		sftpURI := fmt.Sprintf("sftp://%s:%s@%s:%d/", encodedUser, encodedPass, nodeFQDN, sftpPort)

		res[i] = KeyResponse{
			SftpAccessKey: k,
			IsExpired:     expired,
			SftpURI:       sftpURI,
			FileZillaURI:  sftpURI,
			WinSCPLink:   fmt.Sprintf("winscp-%s", sftpURI),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"keys":      res,
		"node_host": nodeFQDN,
		"sftp_port": sftpPort,
	})
}

// CreateKey handles POST /api/servers/:uuid/sftp-keys
func (s *SftpKeyController) CreateKey(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req CreateSftpKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ttl := req.TTLHours
	if ttl <= 0 {
		ttl = 3 // Default 3 hours TTL
	}

	// Generate secure random guest username and password
	randBytes := make([]byte, 4)
	_, _ = rand.Read(randBytes)
	guestUser := fmt.Sprintf("guest_%s", hex.EncodeToString(randBytes))

	pwBytes := make([]byte, 12)
	_, _ = rand.Read(pwBytes)
	guestPass := hex.EncodeToString(pwBytes)

	expiresAt := time.Now().UTC().Add(time.Duration(ttl) * time.Hour)

	key := models.SftpAccessKey{
		ServerID:   server.ID,
		Label:      req.Label,
		Username:   guestUser,
		Password:   guestPass,
		AllowedIPs: strings.TrimSpace(req.AllowedIPs),
		ExpiresAt:  expiresAt,
		IsActive:   true,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}

	if err := s.db.Create(&key).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fehler beim Erstellen des Gast-SFTP-Keys."})
		return
	}

	nodeFQDN := "127.0.0.1"
	sftpPort := 2022
	if server.Node != nil {
		nodeFQDN = server.Node.FQDN
		if server.Node.DaemonSFTPPort > 0 {
			sftpPort = server.Node.DaemonSFTPPort
		}
	}

	fullUser := fmt.Sprintf("%s.%s", key.Username, server.Identifier)
	sftpURI := fmt.Sprintf("sftp://%s:%s@%s:%d/", url.QueryEscape(fullUser), url.QueryEscape(key.Password), nodeFQDN, sftpPort)

	c.JSON(http.StatusCreated, gin.H{
		"message":   "Temporärer Gast-SFTP-Key erfolgreich erstellt.",
		"key":       key,
		"sftp_uri":  sftpURI,
		"expires_in": fmt.Sprintf("%d Stunden", ttl),
	})
}

// DeleteKey handles DELETE /api/servers/:uuid/sftp-keys/:id
func (s *SftpKeyController) DeleteKey(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	keyID, _ := strconv.Atoi(c.Param("id"))

	if err := s.db.Where("id = ? AND server_id = ?", keyID, server.ID).Delete(&models.SftpAccessKey{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Konnte SFTP-Key nicht löschen."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SFTP-Key widerrufen."})
}
