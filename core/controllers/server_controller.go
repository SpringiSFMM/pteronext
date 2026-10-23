package controllers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// ServerController handles REST actions on server containers.
type ServerController struct {
	db             *gorm.DB
	serverService  *services.ServerService
	wingsClient    *services.WingsClient
	wsHub          *services.WebSocketHub
	auditService   *services.AuditService
	webhookService *services.WebhookService
	fileService    *services.FileService
}

// NewServerController creates a new ServerController.
func NewServerController(
	db *gorm.DB,
	serverService *services.ServerService,
	wingsClient *services.WingsClient,
	wsHub *services.WebSocketHub,
	auditService *services.AuditService,
	webhookService *services.WebhookService,
	fileService *services.FileService,
) *ServerController {
	return &ServerController{
		db:             db,
		serverService:  serverService,
		wingsClient:    wingsClient,
		wsHub:          wsHub,
		auditService:   auditService,
		webhookService: webhookService,
		fileService:    fileService,
	}
}

// ListServers handles GET /api/servers
func (s *ServerController) ListServers(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)

	query := s.db.Preload("Node").
		Preload("Allocation").
		Preload("Owner").
		Preload("Nest").
		Preload("Egg")

	// Regular users only see servers they own or have subuser access to
	if !user.RootAdmin {
		var subuserServerIDs []uint
		s.db.Model(&models.Subuser{}).Where("user_id = ?", user.ID).Pluck("server_id", &subuserServerIDs)
		if len(subuserServerIDs) > 0 {
			query = query.Where("owner_id = ? OR id IN (?)", user.ID, subuserServerIDs)
		} else {
			query = query.Where("owner_id = ?", user.ID)
		}
	}

	var servers []models.Server
	if err := query.Find(&servers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying servers."})
		return
	}

	for i := range servers {
		if servers[i].Egg != nil {
			servers[i].EggCategory = servers[i].Egg.GetCategory()
		}
		if servers[i].Nest != nil {
			servers[i].NestSlug = servers[i].Nest.Slug
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": servers,
	})
}

// GetServer handles GET /api/servers/:uuid
func (s *ServerController) GetServer(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	resolvedStartup := s.serverService.ResolveStartupCommand(server)

	if server.Egg != nil {
		server.EggCategory = server.Egg.GetCategory()
	}
	if server.Nest != nil {
		server.NestSlug = server.Nest.Slug
	}

	user, _ := middleware.GetRequestUser(c)
	var perms []string
	roleName := "Owner"

	if user != nil && (user.RootAdmin || server.OwnerID == user.ID) {
		perms = []string{"*"}
		if user.RootAdmin && server.OwnerID != user.ID {
			roleName = "Admin"
		}
	} else if user != nil {
		var subuser models.Subuser
		if err := s.db.Where("user_id = ? AND server_id = ?", user.ID, server.ID).First(&subuser).Error; err == nil {
			roleName = subuser.RoleName
			if roleName == "" {
				roleName = "Subuser"
			}
			_ = json.Unmarshal([]byte(subuser.Permissions), &perms)
			if len(perms) == 0 && subuser.Permissions != "" {
				perms = strings.Split(subuser.Permissions, ",")
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"server":           server,
		"resolved_startup": resolvedStartup,
		"permissions":      perms,
		"role":             roleName,
		"egg_category":     server.EggCategory,
		"nest_slug":        server.NestSlug,
	})
}

type CreateServerRequest struct {
	Name         string                 `json:"name" binding:"required"`
	Description  string                 `json:"description"`
	OwnerID      *uint                  `json:"owner_id"`
	NodeID       uint                   `json:"node_id"`
	AllocationID uint                   `json:"allocation_id"`
	NestID       *uint                  `json:"nest_id"`
	EggID        *uint                  `json:"egg_id"`
	Port         int                    `json:"port"`
	MemoryMB     int64                  `json:"memory"`
	SwapMB       int64                  `json:"swap"`
	DiskMB       int64                  `json:"disk"`
	CPU          int64                  `json:"cpu"`
	IO           int64                  `json:"io"`
	Startup      string                 `json:"startup"`
	Image        string                 `json:"image"`
	Egg          string                 `json:"egg"`
	Environment  map[string]interface{} `json:"environment"`
}

// SelectBestNode selects the optimal Wings node based on actual real-time resource availability.
func SelectBestNode(db *gorm.DB) (*models.Node, error) {
	var nodes []models.Node
	if err := db.Find(&nodes).Error; err != nil || len(nodes) == 0 {
		return nil, fmt.Errorf("no active nodes available in cluster")
	}

	if len(nodes) == 1 {
		return &nodes[0], nil
	}

	type NodeUsage struct {
		NodeID      uint  `gorm:"column:node_id"`
		ServerCount int64 `gorm:"column:server_count"`
		AllocMemory int64 `gorm:"column:alloc_memory"`
		AllocDisk   int64 `gorm:"column:alloc_disk"`
		AllocCPU    int64 `gorm:"column:alloc_cpu"`
	}

	var usages []NodeUsage
	db.Model(&models.Server{}).
		Select("node_id, count(id) as server_count, coalesce(sum(memory), 0) as alloc_memory, coalesce(sum(disk), 0) as alloc_disk, coalesce(sum(cpu), 0) as alloc_cpu").
		Group("node_id").
		Scan(&usages)

	usageMap := make(map[uint]NodeUsage)
	for _, u := range usages {
		usageMap[u.NodeID] = u
	}

	var bestNode *models.Node
	var highestScore float64 = -1e9

	for i := range nodes {
		n := &nodes[i]
		u := usageMap[n.ID]

		totalMemory := float64(n.MemoryMB)
		if totalMemory <= 0 {
			totalMemory = 8192
		}
		availMemory := totalMemory - float64(u.AllocMemory)
		if availMemory < 0 {
			availMemory = 0
		}

		totalDisk := float64(n.DiskMB)
		if totalDisk <= 0 {
			totalDisk = 50000
		}
		availDisk := totalDisk - float64(u.AllocDisk)
		if availDisk < 0 {
			availDisk = 0
		}

		score := (availMemory * 0.5) + (availDisk * 0.05) - (float64(u.ServerCount) * 150.0)

		if score > highestScore || bestNode == nil {
			highestScore = score
			bestNode = n
		}
	}

	return bestNode, nil
}

// CreateServer handles POST /api/servers
func (s *ServerController) CreateServer(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)
	if user == nil || !user.RootAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only root administrators can deploy and provision new server containers."})
		return
	}

	var req CreateServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify or auto-balance node
	var node models.Node
	if req.NodeID == 0 {
		best, err := SelectBestNode(s.db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Multi-node load balancer: " + err.Error()})
			return
		}
		node = *best
		req.NodeID = node.ID
	} else {
		if err := s.db.First(&node, req.NodeID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Specified node does not exist."})
			return
		}
	}

	// Process Egg if provided
	var egg models.Egg
	if req.EggID != nil && *req.EggID > 0 {
		if err := s.db.First(&egg, *req.EggID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Specified egg does not exist."})
			return
		}
	} else if req.Egg != "" {
		// Attempt numeric parse or name match
		if numID, err := strconv.ParseUint(req.Egg, 10, 32); err == nil {
			if err := s.db.First(&egg, uint(numID)).Error; err == nil {
				req.EggID = &egg.ID
			}
		} else {
			if err := s.db.Where("name = ?", req.Egg).First(&egg).Error; err == nil {
				req.EggID = &egg.ID
			}
		}
	}

	if egg.ID > 0 {
		if req.NestID == nil || *req.NestID == 0 {
			req.NestID = &egg.NestID
		}
		if req.Startup == "" {
			req.Startup = egg.StartupCommand
		}
		if req.Image == "" && len(egg.DockerImages) > 0 {
			for _, img := range egg.DockerImages {
				req.Image = img
				break
			}
		}
	}

	// Safeguard for Node.js / Bot workloads: ensure Node.js 20+ and proper bot startup
	isNodeWorkload := false
	if egg.ID > 0 {
		eName := strings.ToLower(egg.Name)
		if strings.Contains(eName, "node") || strings.Contains(eName, "discord") || strings.Contains(eName, "bot") {
			isNodeWorkload = true
		}
	}
	rName := strings.ToLower(req.Name)
	if strings.Contains(rName, "bot") || strings.Contains(rName, "discord") || strings.Contains(rName, "node") {
		isNodeWorkload = true
	}
	if isNodeWorkload {
		if req.Image == "" || strings.Contains(req.Image, "nodejs_12") || strings.Contains(req.Image, "nodejs_14") || strings.Contains(req.Image, "nodejs_15") || strings.Contains(req.Image, "nodejs_16") {
			req.Image = "ghcr.io/parkervcp/yolks:nodejs_20"
		}
		if req.Startup == "" || req.Startup == "npm install" || req.Startup == "npm install " || (strings.HasPrefix(req.Startup, "npm install") && !strings.Contains(req.Startup, "node ")) {
			req.Startup = "if [ -f /home/container/package.json ]; then npm install; fi; node {{BOT_JS:-bot.js}}"
		}
	}

	// Default fallbacks
	if req.MemoryMB == 0 {
		req.MemoryMB = 1024
	}
	if req.DiskMB == 0 {
		req.DiskMB = 5120
	}
	if req.CPU == 0 {
		req.CPU = 100
	}
	if req.IO == 0 {
		req.IO = 500
	}
	if req.Startup == "" {
		req.Startup = "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui"
	}
	if req.Image == "" {
		req.Image = "ghcr.io/pterodactyl/yolks:java_17"
	}

	// Find or assign allocation
	allocID := req.AllocationID
	if allocID == 0 {
		var alloc models.Allocation
		allocQuery := s.db.Where("node_id = ? AND server_id IS NULL", req.NodeID)
		if req.Port > 0 {
			allocQuery = allocQuery.Where("port = ?", req.Port)
		}
		if err := allocQuery.First(&alloc).Error; err != nil {
			port := req.Port
			if port <= 0 {
				var maxPort int
				s.db.Model(&models.Allocation{}).Where("node_id = ?", req.NodeID).Select("COALESCE(MAX(port), 25565)").Scan(&maxPort)
				port = maxPort + 1
			}
			newAlloc := models.Allocation{
				NodeID: req.NodeID,
				IP:     "0.0.0.0",
				Port:   port,
			}
			if err := s.db.Create(&newAlloc).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating allocation."})
				return
			}
			allocID = newAlloc.ID
		} else {
			allocID = alloc.ID
		}
	}

	newUUID := uuid.New().String()
	shortID := strings.ReplaceAll(newUUID, "-", "")[:8]
	now := time.Now().UTC()

	targetOwnerID := user.ID
	if req.OwnerID != nil && *req.OwnerID > 0 {
		targetOwnerID = *req.OwnerID
	}

	server := models.Server{
		UUID:         newUUID,
		Identifier:   shortID,
		Name:         req.Name,
		Description:  req.Description,
		OwnerID:      targetOwnerID,
		NodeID:       req.NodeID,
		AllocationID: allocID,
		NestID:       req.NestID,
		EggID:        req.EggID,
		MemoryMB:     req.MemoryMB,
		SwapMB:       req.SwapMB,
		DiskMB:       req.DiskMB,
		CPU:          req.CPU,
		IO:           req.IO,
		Startup:      req.Startup,
		Image:        req.Image,
		InstalledAt:  &now,
	}

	if err := s.db.Create(&server).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating server."})
		return
	}

	// Mark allocation as assigned to this server
	s.db.Model(&models.Allocation{}).Where("id = ?", allocID).Update("server_id", server.ID)

	// Set up variables properly from Egg definition and environment override
	processedVars := make(map[string]bool)

	if egg.ID > 0 && len(egg.Variables) > 0 {
		for _, ev := range egg.Variables {
			val := ev.DefaultValue
			if req.Environment != nil {
				if userVal, ok := req.Environment[ev.EnvVariable]; ok {
					val = fmt.Sprintf("%v", userVal)
				}
			}
			s.db.Create(&models.ServerVariable{
				ServerID:     server.ID,
				EnvVariable:  ev.EnvVariable,
				DefaultValue: val,
				UserViewable: ev.UserViewable,
				UserEditable: ev.UserEditable,
			})
			processedVars[ev.EnvVariable] = true
		}
	}

	// Process any additional dynamic environment variables
	if req.Environment != nil {
		for k, v := range req.Environment {
			if !processedVars[k] {
				valStr := fmt.Sprintf("%v", v)
				s.db.Create(&models.ServerVariable{
					ServerID:     server.ID,
					EnvVariable:  k,
					DefaultValue: valStr,
					UserViewable: true,
					UserEditable: true,
				})
				processedVars[k] = true
			}
		}
	}

	// Load complete server entity with relations
	var fullServer models.Server
	s.db.Preload("Node").
		Preload("Allocation").
		Preload("Allocations").
		Preload("Variables").
		Preload("Nest").
		Preload("Egg").
		Preload("Owner").
		First(&fullServer, server.ID)

	resolvedStartup := s.serverService.ResolveStartupCommand(&fullServer)

	// Dispatch server creation to Wings daemon
	go func(targetNode *models.Node, sUUID string) {
		if targetNode != nil {
			if err := s.wingsClient.CreateServer(targetNode, sUUID, false); err != nil {
				log.Printf("[WINGS] Notice creating server %s on node %s: %v", sUUID, targetNode.Name, err)
			}
		}
	}(&node, server.UUID)

	_ = s.auditService.Log(&user.ID, "user", &server.ID, "server:create", map[string]interface{}{
		"name": req.Name,
		"node": node.Name,
		"egg":  req.Egg,
	}, c.ClientIP())

	c.JSON(http.StatusCreated, gin.H{
		"server":           fullServer,
		"data":             fullServer,
		"resolved_startup": resolvedStartup,
	})
}

// UpdateServerRequest defines editable server fields.
type UpdateServerRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Startup     *string `json:"startup"`
	Image       *string `json:"image"`
	DockerImage *string `json:"docker_image"`
	Memory      *int64  `json:"memory"`
	MemoryMB    *int64  `json:"memory_mb"`
	Disk        *int64  `json:"disk"`
	DiskMB      *int64  `json:"disk_mb"`
	CPU         *int64  `json:"cpu"`
	CPULimit    *int64  `json:"cpu_limit"`
	IO          *int64  `json:"io"`
	IOLimit     *int64  `json:"io_limit"`
	Swap        *int64  `json:"swap"`
	SwapMB      *int64  `json:"swap_mb"`
	Suspended   *bool   `json:"suspended"`
	IsSuspended *bool   `json:"is_suspended"`
}

// UpdateServer handles PATCH /api/servers/:uuid
func (s *ServerController) UpdateServer(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	user, _ := middleware.GetRequestUser(c)

	var req UpdateServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Startup != nil {
		updates["startup"] = *req.Startup
	}
	if req.Image != nil && strings.TrimSpace(*req.Image) != "" {
		updates["image"] = strings.TrimSpace(*req.Image)
	} else if req.DockerImage != nil && strings.TrimSpace(*req.DockerImage) != "" {
		updates["image"] = strings.TrimSpace(*req.DockerImage)
	}
	if req.Memory != nil {
		updates["memory_mb"] = *req.Memory
	} else if req.MemoryMB != nil {
		updates["memory_mb"] = *req.MemoryMB
	}
	if req.Disk != nil {
		updates["disk_mb"] = *req.Disk
	} else if req.DiskMB != nil {
		updates["disk_mb"] = *req.DiskMB
	}
	if req.CPU != nil {
		updates["cpu"] = *req.CPU
	} else if req.CPULimit != nil {
		updates["cpu"] = *req.CPULimit
	}
	if req.IO != nil {
		updates["io"] = *req.IO
	} else if req.IOLimit != nil {
		updates["io"] = *req.IOLimit
	}
	if req.Swap != nil {
		updates["swap_mb"] = *req.Swap
	} else if req.SwapMB != nil {
		updates["swap_mb"] = *req.SwapMB
	}
	if req.Suspended != nil {
		updates["suspended"] = *req.Suspended
	} else if req.IsSuspended != nil {
		updates["suspended"] = *req.IsSuspended
	}

	if len(updates) > 0 {
		if err := s.db.Model(&models.Server{}).Where("id = ?", server.ID).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating server in database: " + err.Error()})
			return
		}

		// When suspended, immediately kill/stop container processes and broadcast offline state
		if isSusp, ok := updates["suspended"].(bool); ok && isSusp {
			if server.Node != nil && s.wingsClient != nil {
				_ = s.wingsClient.SendPowerAction(server.Node, server.UUID, "kill")
			}
			s.wsHub.Broadcast(server.UUID, "status", "offline")
			s.wsHub.Broadcast(server.UUID, "console output", "\x1b[31;1m[SERVER SUSPENDED]\x1b[0m Dieser Server wurde administrativ suspendiert. Alle Prozesse wurden beendet.")
		}
	}

	// Reload server with relations to return fresh state
	var fresh models.Server
	if err := s.db.Preload("Node").
		Preload("Allocation").
		Preload("Allocations").
		Preload("Variables").
		Preload("Nest").
		Preload("Egg").
		Preload("Owner").
		First(&fresh, server.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed reloading fresh server: " + err.Error()})
		return
	}

	// Sync changes to Wings in background
	if fresh.Node != nil {
		go func(n *models.Node, sUUID string) {
			_ = s.wingsClient.SyncServer(n, sUUID)
		}(fresh.Node, fresh.UUID)
	}

	resolvedStartup := s.serverService.ResolveStartupCommand(&fresh)

	_ = s.auditService.Log(&user.ID, "user", &fresh.ID, "server:update", updates, c.ClientIP())
	c.JSON(http.StatusOK, gin.H{
		"server":           fresh,
		"data":             fresh,
		"resolved_startup": resolvedStartup,
	})
}

// DeleteServer handles DELETE /api/servers/:uuid
func (s *ServerController) DeleteServer(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	user, _ := middleware.GetRequestUser(c)

	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized."})
		return
	}

	// Security requirement: User must confirm their account password
	var delReq struct {
		Password string `json:"password"`
	}
	_ = c.ShouldBindJSON(&delReq)

	if delReq.Password == "" {
		delReq.Password = c.GetHeader("X-Password")
	}

	if delReq.Password == "" || !user.CheckPassword(delReq.Password) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Ungültiges Account-Passwort. Bitte bestätige die Serverlöschung mit deinem Passwort."})
		return
	}

	// 1. Instruct Wings daemon to delete the server environment & container
	if server.Node != nil {
		if err := s.wingsClient.DeleteServer(server.Node, server.UUID); err != nil {
			log.Printf("[ServerController] Wings delete warning for %s: %v", server.UUID, err)
		}
	}

	// 2. Fallback physical cleanup of local server directory if present (/servers/<uuid> or ./servers/<uuid>)
	localPaths := []string{
		fmt.Sprintf("/servers/%s", server.UUID),
		fmt.Sprintf("./servers/%s", server.UUID),
		fmt.Sprintf("servers/%s", server.UUID),
		fmt.Sprintf("/var/lib/pterodactyl/volumes/%s", server.UUID),
	}
	for _, lp := range localPaths {
		if fi, err := os.Stat(lp); err == nil && fi.IsDir() {
			log.Printf("[ServerController] Removing local server directory: %s", lp)
			_ = os.RemoveAll(lp)
		}
	}

	// 3. Cascading DB cleanups
	s.db.Transaction(func(tx *gorm.DB) error {
		// Unlink allocations
		tx.Model(&models.Allocation{}).Where("server_id = ?", server.ID).Update("server_id", nil)
		// Delete dependent models
		tx.Where("server_id = ?", server.ID).Delete(&models.ServerVariable{})
		tx.Where("server_id = ?", server.ID).Delete(&models.Schedule{})
		tx.Where("server_id = ?", server.ID).Delete(&models.Task{})
		tx.Where("server_id = ?", server.ID).Delete(&models.Subuser{})
		tx.Where("server_id = ?", server.ID).Delete(&models.Database{})
		tx.Where("server_id = ?", server.ID).Delete(&models.Backup{})
		tx.Where("server_id = ?", server.ID).Delete(&models.Webhook{})
		tx.Where("server_id = ?", server.ID).Delete(&models.Sidecar{})
		tx.Where("server_id = ?", server.ID).Delete(&models.ServerCustomDomain{})
		tx.Where("server_id = ?", server.ID).Delete(&models.ServerTrigger{})
		tx.Where("server_id = ?", server.ID).Delete(&models.FileRevision{})
		// Unlink audits
		tx.Model(&models.AuditLog{}).Where("server_id = ?", server.ID).Update("server_id", nil)

		// Hard delete the server record
		return tx.Unscoped().Delete(server).Error
	})

	_ = s.auditService.Log(&user.ID, "user", &server.ID, "server:delete", map[string]interface{}{
		"name": server.Name,
		"uuid": server.UUID,
	}, c.ClientIP())

	c.Status(http.StatusNoContent)
}

type PowerActionRequest struct {
	Action string `json:"action" binding:"required"` // "start", "stop", "restart", "kill"
}

// PowerAction handles POST /api/servers/:uuid/power
func (s *ServerController) PowerAction(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	user, _ := middleware.GetRequestUser(c)

	var req PowerActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Action is required (start, stop, restart, kill)."})
		return
	}

	validActions := map[string]bool{"start": true, "stop": true, "restart": true, "kill": true}
	if !validActions[req.Action] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid power action. Allowed: start, stop, restart, kill."})
		return
	}

	// Block start/restart power actions on suspended servers
	if server.Suspended && (req.Action == "start" || req.Action == "restart") {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Dieser Server ist administrativ suspendiert. Starts und Neustarts sind deaktiviert.",
		})
		return
	}

	// Try sending action to Wings daemon
	var daemonErr error
	if server.Node == nil && server.NodeID > 0 {
		var n models.Node
		if err := s.db.First(&n, server.NodeID).Error; err == nil {
			server.Node = &n
		}
	}

	if server.Node != nil {
		daemonErr = s.wingsClient.SendPowerAction(server.Node, server.UUID, req.Action)
	}

	// Determine resulting state
	newState := "starting"
	if req.Action == "stop" {
		newState = "stopping"
	} else if req.Action == "kill" {
		newState = "offline"
	}

	if daemonErr != nil {
		// If kill or stop failed because daemon server is missing or unreachable, still enforce state in database
		if req.Action == "kill" || req.Action == "stop" {
			_ = s.db.Model(&models.Server{}).Where("id = ?", server.ID).Update("status", newState)
			s.wsHub.Broadcast(server.UUID, "status", newState)
			s.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[33m[Power Action]\x1b[0m Action '%s' applied (Daemon note: %s)", req.Action, daemonErr.Error()))
		} else {
			nodeFQDN := "daemon"
			if server.Node != nil {
				nodeFQDN = server.Node.FQDN
			}
			s.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[31m[Daemon Error]\x1b[0m %s", daemonErr.Error()))
			c.JSON(http.StatusBadGateway, gin.H{
				"error": fmt.Sprintf("Failed to communicate with Wings daemon on %s: %s", nodeFQDN, daemonErr.Error()),
			})
			return
		}
	} else {
		// Update server status in database
		_ = s.db.Model(&models.Server{}).Where("id = ?", server.ID).Update("status", newState)
		// Broadcast status update through console WebSocket
		s.wsHub.Broadcast(server.UUID, "status", newState)
		s.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[33m[Power Action]\x1b[0m Action '%s' successfully dispatched by %s", req.Action, user.Username))
	}

	_ = s.auditService.Log(&user.ID, "user", &server.ID, fmt.Sprintf("server:power.%s", req.Action), map[string]interface{}{
		"action": req.Action,
	}, c.ClientIP())

	if s.webhookService != nil {
		nodeName := "Wings Node"
		if server.Node != nil && server.Node.Name != "" {
			nodeName = server.Node.Name
		}
		fields := map[string]string{
			"Aktion":    req.Action,
			"Benutzer":  user.Username,
			"Node Host": nodeName,
		}

		if req.Action == "restart" {
			s.webhookService.TriggerEvent(
				server.UUID,
				"server.stop",
				fmt.Sprintf("Power-Aktion: RESTART (Stop) - %s", server.Name),
				fmt.Sprintf("Server **%s** wird für einen Neustart gestoppt (ausgelöst durch `%s`).", server.Name, user.Username),
				fields,
				fmt.Sprintf("https://panel.springisfm.de/server/%s", server.UUID),
			)
			s.webhookService.TriggerEvent(
				server.UUID,
				"server.start",
				fmt.Sprintf("Power-Aktion: RESTART (Start) - %s", server.Name),
				fmt.Sprintf("Server **%s** startet nach Restart neu (ausgelöst durch `%s`).", server.Name, user.Username),
				fields,
				fmt.Sprintf("https://panel.springisfm.de/server/%s", server.UUID),
			)
		} else {
			eventMap := map[string]string{
				"start": "server.start",
				"stop":  "server.stop",
				"kill":  "server.crash",
			}
			evt := eventMap[req.Action]
			if evt == "" {
				evt = "server.power"
			}
			title := fmt.Sprintf("Power-Aktion: %s", strings.ToUpper(req.Action))
			desc := fmt.Sprintf("Server **%s** hat das Signal `%s` erhalten (ausgelöst durch Benutzer `%s`).", server.Name, req.Action, user.Username)
			s.webhookService.TriggerEvent(server.UUID, evt, title, desc, fields, fmt.Sprintf("https://panel.springisfm.de/server/%s", server.UUID))
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"action":  req.Action,
		"status":  "dispatched",
		"state":   newState,
		"server":  server.UUID,
	})
}

// ReinstallServer handles POST /api/servers/:uuid/reinstall
func (s *ServerController) ReinstallServer(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	user, _ := middleware.GetRequestUser(c)

	if server.Node == nil && server.NodeID > 0 {
		var n models.Node
		if err := s.db.First(&n, server.NodeID).Error; err == nil {
			server.Node = &n
		}
	}

	// 1. Force kill running container so files are not held open
	if server.Node != nil {
		_ = s.wingsClient.SendPowerAction(server.Node, server.UUID, "kill")
	}

	// 2. Set server status to installing
	installingSt := models.ServerStatusInstalling
	_ = s.db.Model(&models.Server{}).Where("id = ?", server.ID).Update("status", installingSt)
	s.wsHub.Broadcast(server.UUID, "status", installingSt)
	s.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[33m[Server Reinstall]\x1b[0m Server reinstallation requested by %s. Stopping container and purging volume...", user.Username))

	// 3. Purge server volume files cleanly (locally and remotely on remote nodes)
	if s.fileService != nil {
		if err := s.fileService.PurgeServerFiles(server.UUID); err != nil {
			log.Printf("[ServerController] PurgeServerFiles for %s warning: %v", server.UUID, err)
		}
	}

	// 4. Trigger Wings daemon reinstall
	if server.Node != nil {
		if err := s.wingsClient.ReinstallServer(server.Node, server.UUID); err != nil {
			log.Printf("[ServerController] Wings ReinstallServer error (falling back to CreateServer): %v", err)
			_ = s.wingsClient.CreateServer(server.Node, server.UUID, false)
		}
	}

	s.wsHub.Broadcast(server.UUID, "console output", "\x1b[32m[Server Reinstall]\x1b[0m Volume cleared. Installer dispatched to node daemon.")

	_ = s.auditService.Log(&user.ID, "user", &server.ID, "server:settings.reinstall", map[string]interface{}{
		"action": "reinstall",
		"server": server.UUID,
	}, c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"message": "Reinstallation initiated successfully.",
		"status":  installingSt,
	})
}

type CommandRequest struct {
	Command string `json:"command" binding:"required"`
}

// SendCommand handles POST /api/servers/:uuid/command and /api/servers/:uuid/commands
func (s *ServerController) SendCommand(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	user, _ := middleware.GetRequestUser(c)

	var req CommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Command is required."})
		return
	}

	// Block console commands on suspended servers
	if server.Suspended {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Dieser Server ist administrativ suspendiert. Konsolenbefehle sind gesperrt.",
		})
		return
	}

	// Command-Rules checking for subusers (Whitelist / Blacklist)
	if subuserVal, exists := c.Get("subuser"); exists {
		if subuser, ok := subuserVal.(*models.Subuser); ok && subuser != nil {
			if !subuser.CheckCommandAccess(req.Command) {
				c.JSON(http.StatusForbidden, gin.H{
					"error": fmt.Sprintf("Command execution for '%s' forbidden by server command policy.", req.Command),
				})
				return
			}
		}
	}

	var daemonErr error
	if server.Node != nil {
		daemonErr = s.wingsClient.SendCommand(server.Node, server.UUID, req.Command)
	}

	s.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("> %s", req.Command))
	_ = s.auditService.Log(&user.ID, "user", &server.ID, "server:command", map[string]interface{}{
		"command": req.Command,
	}, c.ClientIP())

	res := gin.H{
		"status":  "dispatched",
		"command": req.Command,
	}
	if daemonErr != nil {
		res["daemon_notice"] = daemonErr.Error()
	}

	c.JSON(http.StatusOK, res)
}

// GetSleepMode handles GET /api/servers/:uuid/sleep-mode
func (s *ServerController) GetSleepMode(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	c.JSON(http.StatusOK, gin.H{
		"sleep_mode_enabled":    server.SleepModeEnabled,
		"sleep_timeout_minutes": server.SleepTimeoutMinutes,
		"is_sleeping":          server.IsSleeping,
	})
}

type UpdateSleepModeRequest struct {
	SleepModeEnabled    bool `json:"sleep_mode_enabled"`
	SleepTimeoutMinutes int  `json:"sleep_timeout_minutes"`
}

// UpdateSleepMode handles POST /api/servers/:uuid/sleep-mode
func (s *ServerController) UpdateSleepMode(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	var req UpdateSleepModeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	if req.SleepTimeoutMinutes <= 0 {
		req.SleepTimeoutMinutes = 15
	}

	updates := map[string]interface{}{
		"sleep_mode_enabled":    req.SleepModeEnabled,
		"sleep_timeout_minutes": req.SleepTimeoutMinutes,
	}

	if err := s.db.Model(&models.Server{}).Where("id = ?", server.ID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating sleep mode configuration"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":               "Sleep mode configuration updated",
		"sleep_mode_enabled":    req.SleepModeEnabled,
		"sleep_timeout_minutes": req.SleepTimeoutMinutes,
		"is_sleeping":          server.IsSleeping,
	})
}

type CloneServerRequest struct {
	Name string `json:"name"`
}

// CloneServer handles POST /api/servers/:uuid/clone (Instant Server-Klon / 1-Klick-Staging)
func (s *ServerController) CloneServer(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}
	user, _ := middleware.GetRequestUser(c)

	// Block cloning on suspended servers
	if server.Suspended && (user == nil || !user.RootAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Suspendierte Server können aus Sicherheitsgründen nicht geklont werden."})
		return
	}

	// Verify caller is either RootAdmin or the server owner
	if user == nil || (!user.RootAdmin && server.OwnerID != user.ID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nur der Servereigentümer oder ein Administrator kann diesen Server klonen."})
		return
	}

	var req CloneServerRequest
	_ = c.ShouldBindJSON(&req)

	cloneName := strings.TrimSpace(req.Name)
	if cloneName == "" {
		cloneName = fmt.Sprintf("%s (Staging)", server.Name)
	}

	newUUID := uuid.New().String()
	shortID := newUUID[:8]

	allocIP := "0.0.0.0"
	allocPort := 25565
	if server.Allocation != nil {
		allocIP = server.Allocation.IP
		allocPort = server.Allocation.Port
	}

	// Find next available free port on the node
	var freeAlloc models.Allocation
	if err := s.db.Where("node_id = ? AND server_id IS NULL", server.NodeID).Order("port asc").First(&freeAlloc).Error; err != nil {
		freeAlloc = models.Allocation{
			NodeID: server.NodeID,
			IP:     allocIP,
			Port:   allocPort + 10,
			Notes:  "Auto-Staging Allocation",
		}
		s.db.Create(&freeAlloc)
	}

	clonedServer := models.Server{
		UUID:                 newUUID,
		Identifier:           shortID,
		Name:                 cloneName,
		Description:          fmt.Sprintf("Staging clone of %s", server.Name),
		Suspended:            false,
		OwnerID:              server.OwnerID,
		NodeID:               server.NodeID,
		AllocationID:         freeAlloc.ID,
		NestID:               server.NestID,
		EggID:                server.EggID,
		MemoryMB:             server.MemoryMB,
		SwapMB:               server.SwapMB,
		DiskMB:               server.DiskMB,
		CPU:                  server.CPU,
		IO:                   server.IO,
		OOMDisabled:          server.OOMDisabled,
		Startup:              server.Startup,
		Image:                server.Image,
		SleepModeEnabled:     server.SleepModeEnabled,
		SleepTimeoutMinutes: server.SleepTimeoutMinutes,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}

	if err := s.db.Create(&clonedServer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating clone: " + err.Error()})
		return
	}

	// Link allocation
	s.db.Model(&models.Allocation{}).Where("id = ?", freeAlloc.ID).Update("server_id", clonedServer.ID)

	// Copy files in background
	go func(srcUUID, destUUID string) {
		srcDir := fmt.Sprintf("/var/lib/pterodactyl/volumes/%s", srcUUID)
		destDir := fmt.Sprintf("/var/lib/pterodactyl/volumes/%s", destUUID)
		_ = exec.Command("cp", "-r", srcDir, destDir).Run()
	}(server.UUID, newUUID)

	if s.auditService != nil && user != nil {
		_ = s.auditService.Log(&user.ID, "server", &clonedServer.ID, "server:clone", map[string]interface{}{
			"source_uuid": server.UUID,
			"clone_uuid":  newUUID,
			"clone_name":  cloneName,
		}, c.ClientIP())
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": fmt.Sprintf("Server erfolgreich geklont! Neue Staging-Instanz '%s' bereit.", cloneName),
		"server":  clonedServer,
	})
}
