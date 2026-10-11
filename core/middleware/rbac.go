package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// RequireAdmin verifies that the requesting user is a Root Administrator.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetRequestUser(c)
		if !ok || user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		if user.RootAdmin || (user.Role != nil && strings.ToLower(user.Role.Name) == "administrator") {
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "This action requires administrative privileges.",
		})
	}
}

// RequirePermission verifies role-based permission for a specific resource and action.
func RequirePermission(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetRequestUser(c)
		if !ok || user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		// Root admin bypasses all permission checks
		if user.RootAdmin {
			c.Next()
			return
		}

		if user.Role != nil {
			for _, perm := range user.Role.Permissions {
				if perm.Resource == "*" || perm.Resource == resource {
					if perm.Action == "*" || perm.Action == action {
						c.Next()
						return
					}
				}
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "You do not have the required permissions to perform this action.",
		})
	}
}

// RequireServerAccess verifies the user is the owner, a root admin, or a subuser with permitted action.
func RequireServerAccess(db *gorm.DB, requiredAction string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetRequestUser(c)
		if !ok || user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		serverIdentifier := c.Param("uuid")
		if serverIdentifier == "" {
			serverIdentifier = c.Param("server")
		}

		var server models.Server
		err := db.Preload("Node").
			Preload("Allocation").
			Preload("Allocations").
			Preload("Variables").
			Preload("Owner").
			Where("uuid = ? OR identifier = ?", serverIdentifier, serverIdentifier).
			First(&server).Error

		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Server not found."})
			return
		}

		// Root admin or Server owner has full access
		if user.RootAdmin || server.OwnerID == user.ID {
			c.Set("server", &server)
			c.Next()
			return
		}

		// Check subuser permissions
		var subuser models.Subuser
		if err := db.Where("user_id = ? AND server_id = ?", user.ID, server.ID).First(&subuser).Error; err == nil {
			if requiredAction == "" || subuser.HasPermission(requiredAction) {
				c.Set("server", &server)
				c.Set("subuser", &subuser)
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "You do not have permission to access this server.",
		})
	}
}

// GetRequestServer retrieves the preloaded Server from gin.Context.
func GetRequestServer(c *gin.Context) (*models.Server, bool) {
	val, exists := c.Get("server")
	if !exists {
		return nil, false
	}
	server, ok := val.(*models.Server)
	return server, ok
}
