package controllers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/services"
)

// WebSocketController handles live terminal and console WebSocket connections.
type WebSocketController struct {
	wsHub *services.WebSocketHub
}

// NewWebSocketController creates a new WebSocketController.
func NewWebSocketController(wsHub *services.WebSocketHub) *WebSocketController {
	return &WebSocketController{wsHub: wsHub}
}

// ConnectConsole handles GET /api/servers/:uuid/ws
func (w *WebSocketController) ConnectConsole(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	if err := w.wsHub.HandleWebSocket(c.Writer, c.Request, server); err != nil {
		log.Printf("[WS ERROR] Failed handling websocket connection for %s: %v", server.UUID, err)
		c.Status(http.StatusInternalServerError)
		return
	}
}
