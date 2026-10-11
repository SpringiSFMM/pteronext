package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
)

// AuthenticateUser validates incoming JWT tokens or API keys.
func AuthenticateUser(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := ""

		// Check Authorization Header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				tokenStr = parts[1]
			}
		}

		// Also check query param ?token= (essential for WebSocket handshakes)
		if tokenStr == "" {
			tokenStr = c.Query("token")
		}

		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication token required.",
			})
			return
		}

		// 1. API Key Auth
		if strings.HasPrefix(tokenStr, "ptl_") {
			apiKey, user, err := authService.ValidateAPIKey(tokenStr)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
				return
			}
			c.Set("api_key", apiKey)
			c.Set("user", user)
			c.Next()
			return
		}

		// 2. JWT Auth
		claims, user, err := authService.ValidateJWT(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		c.Set("claims", claims)
		c.Set("user", user)
		c.Next()
	}
}

// GetRequestUser retrieves the authenticated User from context.
func GetRequestUser(c *gin.Context) (*models.User, bool) {
	val, exists := c.Get("user")
	if !exists {
		return nil, false
	}
	user, ok := val.(*models.User)
	return user, ok
}
