package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// DaemonAuthenticate authenticates requests sent by the Wings daemon.
// Wings uses Bearer token in the format: <daemon_token_id>.<daemon_token_secret>
func DaemonAuthenticate(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Access to this endpoint must include an Authorization header.",
			})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "The Authorization header provided was not in a valid format.",
			})
			return
		}

		bearer := parts[1]
		tokenParts := strings.Split(bearer, ".")
		if len(tokenParts) != 2 || tokenParts[0] == "" || tokenParts[1] == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "The daemon token provided was not in a valid format (expected token_id.secret).",
			})
			return
		}

		tokenID := tokenParts[0]
		var node models.Node
		if err := db.Where("daemon_token_id = ?", tokenID).First(&node).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "You are not authorized to access this resource.",
			})
			return
		}

		if !node.ValidateDaemonToken(bearer) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "You are not authorized to access this resource.",
			})
			return
		}

		// Store node in context for downstream handlers
		c.Set("node", &node)
		c.Next()
	}
}

// GetRequestNode retrieves the authenticated Node from gin.Context.
func GetRequestNode(c *gin.Context) (*models.Node, bool) {
	val, exists := c.Get("node")
	if !exists {
		return nil, false
	}
	node, ok := val.(*models.Node)
	return node, ok
}
