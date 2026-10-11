package remote

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

type SftpAuthRequest struct {
	Type     string `json:"type"` // "password" or "public_key"
	Username string `json:"username"`
	Password string `json:"password"`
	IP       string `json:"ip"`
}

// SftpRemoteController handles SFTP authentication queries from Wings.
type SftpRemoteController struct {
	db *gorm.DB
}

// NewSftpRemoteController creates a new SftpRemoteController.
func NewSftpRemoteController(db *gorm.DB) *SftpRemoteController {
	return &SftpRemoteController{db: db}
}

// AuthenticateSFTP handles POST /api/remote/sftp/auth
func (c *SftpRemoteController) AuthenticateSFTP(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	var req SftpAuthRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request."})
		return
	}

	// Username format is: <username>.<server_identifier>
	parts := strings.Split(req.Username, ".")
	if len(parts) < 2 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid SFTP username format. Expected user.identifier."})
		return
	}

	rawUsername := strings.Join(parts[:len(parts)-1], ".")
	rawServerIdent := parts[len(parts)-1]

	var server models.Server
	if err := c.db.Where("(uuid = ? OR identifier = ?) AND node_id = ?", rawServerIdent, rawServerIdent, node.ID).First(&server).Error; err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Server not found on this node."})
		return
	}

	// 1. Check if username matches a temporary SftpAccessKey
	if strings.HasPrefix(rawUsername, "guest_") {
		var accessKey models.SftpAccessKey
		if err := c.db.Where("server_id = ? AND username = ? AND is_active = ?", server.ID, rawUsername, true).First(&accessKey).Error; err == nil {
			// Check expiration TTL
			if accessKey.IsExpired() {
				ctx.JSON(http.StatusForbidden, gin.H{"error": "Guest SFTP key has expired (TTL passed)."})
				return
			}
			// Check Password
			if accessKey.Password != req.Password {
				ctx.JSON(http.StatusForbidden, gin.H{"error": "Invalid guest SFTP key credentials."})
				return
			}
			// Check IP Whitelist if configured
			if accessKey.AllowedIPs != "" && req.IP != "" {
				allowed := false
				for _, ip := range strings.Split(accessKey.AllowedIPs, ",") {
					if strings.TrimSpace(ip) == req.IP {
						allowed = true
						break
					}
				}
				if !allowed {
					ctx.JSON(http.StatusForbidden, gin.H{"error": "Client IP is not permitted by this SFTP key whitelist."})
					return
				}
			}

			// Guest access granted with file permissions
			ctx.JSON(http.StatusOK, gin.H{
				"user":   accessKey.Username,
				"server": server.UUID,
				"permissions": []string{
					"file.create",
					"file.read",
					"file.read-content",
					"file.update",
					"file.delete",
					"file.archive",
					"file.sftp",
				},
			})
			return
		}
	}

	// 2. Regular User Authentication
	var user models.User
	if err := c.db.Where("username = ?", rawUsername).First(&user).Error; err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Authorization credentials were not correct."})
		return
	}

	if !user.CheckPassword(req.Password) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Authorization credentials were not correct."})
		return
	}

	// Verify permissions
	if !user.RootAdmin && server.OwnerID != user.ID {
		var subuser models.Subuser
		if err := c.db.Where("user_id = ? AND server_id = ?", user.ID, server.ID).First(&subuser).Error; err != nil {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to access SFTP for this server."})
			return
		}
		if !subuser.HasPermission("file.sftp") && !subuser.HasPermission("*") {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to access SFTP for this server."})
			return
		}
	}

	permissions := []string{
		"control.start",
		"control.stop",
		"control.restart",
		"file.create",
		"file.read",
		"file.read-content",
		"file.update",
		"file.delete",
		"file.archive",
		"file.sftp",
	}

	ctx.JSON(http.StatusOK, gin.H{
		"user":        user.UUID,
		"server":      server.UUID,
		"permissions": permissions,
	})
}
