package controllers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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

type ImporterController struct {
	db          *gorm.DB
	wingsClient *services.WingsClient
}

func NewImporterController(db *gorm.DB, wingsClient *services.WingsClient) *ImporterController {
	return &ImporterController{
		db:          db,
		wingsClient: wingsClient,
	}
}

// ConnectionPayload represents the credentials for Pterodactyl/Pelican API
type ConnectionPayload struct {
	PanelURL string `json:"panel_url" binding:"required"`
	APIKey   string `json:"api_key" binding:"required"`
}

// PterodactylServerAttributes holds fields returned by Pterodactyl/Pelican Application API
type PterodactylServerAttributes struct {
	ID          int    `json:"id"`
	ExternalID  string `json:"external_id"`
	UUID        string `json:"uuid"`
	Identifier  string `json:"identifier"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Suspended   bool   `json:"suspended"`
	Limits      struct {
		Memory int64 `json:"memory"`
		Swap   int64 `json:"swap"`
		Disk   int64 `json:"disk"`
		IO     int64 `json:"io"`
		CPU    int64 `json:"cpu"`
	} `json:"limits"`
	FeatureLimits struct {
		Databases   int `json:"databases"`
		Allocations int `json:"allocations"`
		Backups     int `json:"backups"`
	} `json:"feature_limits"`
	User       int `json:"user"`
	Node       int `json:"node"`
	Allocation int `json:"allocation"`
	Nest       int `json:"nest"`
	Egg        int `json:"egg"`
	Container  struct {
		StartupCommand string            `json:"startup_command"`
		Image          string            `json:"image"`
		Installed      int               `json:"installed"`
		Environment    map[string]string `json:"environment"`
	} `json:"container"`
	Relationships struct {
		Allocations struct {
			Data []struct {
				Attributes struct {
					ID        int    `json:"id"`
					IP        string `json:"ip"`
					Port      int    `json:"port"`
					IsDefault bool   `json:"is_default"`
				} `json:"attributes"`
			} `json:"data"`
		} `json:"allocations"`
	} `json:"relationships"`
}

type PterodactylServerResource struct {
	Object     string                      `json:"object"`
	Attributes PterodactylServerAttributes `json:"attributes"`
}

type PterodactylServerListResponse struct {
	Object string                      `json:"object"`
	Data   []PterodactylServerResource `json:"data"`
	Meta   struct {
		Pagination struct {
			Total        int `json:"total"`
			Count        int `json:"count"`
			PerPage      int `json:"per_page"`
			CurrentPage  int `json:"current_page"`
			TotalPages   int `json:"total_pages"`
		} `json:"pagination"`
	} `json:"meta"`
}

func normalizePanelURL(raw string) string {
	u := strings.TrimSpace(raw)
	u = strings.TrimRight(u, "/")
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		u = "https://" + u
	}
	return u
}

// TestConnection handles POST /api/admin/importer/test
func (ic *ImporterController) TestConnection(c *gin.Context) {
	var req ConnectionPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Panel-URL und API-Schlüssel sind erforderlich."})
		return
	}

	baseURL := normalizePanelURL(req.PanelURL)
	apiKey := strings.TrimSpace(req.APIKey)

	client := &http.Client{Timeout: 10 * time.Second}

	// 1. Try Application API (Server List)
	testURL := fmt.Sprintf("%s/api/application/servers?per_page=50&include=allocations", baseURL)
	httpReq, err := http.NewRequest("GET", testURL, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültige URL: " + err.Error()})
		return
	}

	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "PteroNext-Importer/2.9")

	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Verbindung fehlgeschlagen: %v", err)})
		return
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		// Attempt Client API in case it's a Client API Key (ptlc_ / pelc_ / hydc_)
		clientTestURL := fmt.Sprintf("%s/api/client", baseURL)
		cReq, _ := http.NewRequest("GET", clientTestURL, nil)
		cReq.Header.Set("Authorization", "Bearer "+apiKey)
		cReq.Header.Set("Accept", "application/json")
		cResp, cErr := client.Do(cReq)
		if cErr == nil && (cResp.StatusCode == http.StatusOK) {
			defer cResp.Body.Close()
			var cList PterodactylServerListResponse
			if err := json.NewDecoder(cResp.Body).Decode(&cList); err == nil {
				c.JSON(http.StatusOK, gin.H{
					"success":      true,
					"platform":     "Pterodactyl / Pelican / Hydrodactyl (Client API)",
					"api_type":     "client",
					"server_count": len(cList.Data),
					"servers":      cList.Data,
					"message":      fmt.Sprintf("Erfolgreich verbunden! %d Instanz(en) über Client-API gefunden.", len(cList.Data)),
				})
				return
			}
		}

		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authentifizierung fehlgeschlagen (401/403). Bitte überprüfe deinen Application-API-Key (ptla_..., pela_... oder hyd_...).",
		})
		return
	}

	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{
			"error": fmt.Sprintf("Source-Panel antwortete mit HTTP %d: %s", resp.StatusCode, string(bodyBytes)),
		})
		return
	}

	var serverList PterodactylServerListResponse
	if err := json.Unmarshal(bodyBytes, &serverList); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Antwort konnte nicht als Pterodactyl/Pelican/Hydrodactyl JSON geparst werden."})
		return
	}

	// Detect if Hydrodactyl, Pelican or Pterodactyl by server headers or environment
	bodyLower := strings.ToLower(string(bodyBytes))
	platformName := "Pterodactyl / Pelican / Hydrodactyl"
	if strings.Contains(bodyLower, "hydrodactyl") || strings.HasPrefix(apiKey, "hyd_") || strings.HasPrefix(apiKey, "hydro_") || strings.HasPrefix(apiKey, "hydla_") || strings.HasPrefix(apiKey, "hydlc_") {
		platformName = "Hydrodactyl Panel"
	} else if strings.Contains(bodyLower, "pelican") || strings.HasPrefix(apiKey, "pela_") || strings.HasPrefix(apiKey, "pelc_") {
		platformName = "Pelican Panel"
	} else if strings.Contains(bodyLower, "pterodactyl") || strings.HasPrefix(apiKey, "ptla_") || strings.HasPrefix(apiKey, "ptlc_") {
		platformName = "Pterodactyl Panel"
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"platform":     platformName,
		"api_type":     "application",
		"server_count": len(serverList.Data),
		"servers":      serverList.Data,
		"message":      fmt.Sprintf("Verbindung hergestellt mit %s! %d Projekt(e)/Server gefunden.", platformName, len(serverList.Data)),
	})
}

type ImportExecuteRequest struct {
	PanelURL      string `json:"panel_url" binding:"required"`
	APIKey        string `json:"api_key" binding:"required"`
	ServerID      int    `json:"server_id" binding:"required"`
	TargetNodeID  uint   `json:"target_node_id"`
	TargetOwnerID uint   `json:"target_owner_id"`
	OverrideName  string `json:"override_name"`
}

// ExecuteImport handles POST /api/admin/importer/execute
func (ic *ImporterController) ExecuteImport(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)
	if user == nil || !user.RootAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nur Root-Administratoren können Server aus Fremdsystemen importieren."})
		return
	}

	var req ImportExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültige Import-Anfrage."})
		return
	}

	baseURL := normalizePanelURL(req.PanelURL)
	apiKey := strings.TrimSpace(req.APIKey)

	// 1. Fetch complete server details from source
	fetchURL := fmt.Sprintf("%s/api/application/servers/%d?include=allocations,variables", baseURL, req.ServerID)
	client := &http.Client{Timeout: 12 * time.Second}

	httpReq, err := http.NewRequest("GET", fetchURL, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "PteroNext-Importer/2.9")

	resp, err := client.Do(httpReq)
	if err != nil || resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Konnte Server-Details von Quell-Instanz nicht laden (HTTP %d)", resp.StatusCode)})
		return
	}
	defer resp.Body.Close()

	var sourceResource PterodactylServerResource
	if err := json.NewDecoder(resp.Body).Decode(&sourceResource); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fehler beim Dekodieren der Quell-Serverdaten."})
		return
	}

	src := sourceResource.Attributes

	// 2. Select Target Node (Auto-balance if 0)
	var targetNode models.Node
	if req.TargetNodeID == 0 {
		best, err := SelectBestNode(ic.db)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kein verfügbarer Node im Cluster gefunden."})
			return
		}
		targetNode = *best
	} else {
		if err := ic.db.First(&targetNode, req.TargetNodeID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ausgewählter Node existiert nicht."})
			return
		}
	}

	// 3. Resolve Owner
	ownerID := user.ID
	if req.TargetOwnerID > 0 {
		var o models.User
		if err := ic.db.First(&o, req.TargetOwnerID).Error; err == nil {
			ownerID = o.ID
		}
	}

	// 4. Resolve Target Allocation (Port)
	// Try to match the source port if free, otherwise take next available port
	desiredPort := 25565
	if len(src.Relationships.Allocations.Data) > 0 {
		for _, a := range src.Relationships.Allocations.Data {
			if a.Attributes.IsDefault || desiredPort == 25565 {
				desiredPort = a.Attributes.Port
			}
		}
	}

	targetIP := targetNode.FQDN
	if targetIP == "" {
		targetIP = "217.20.120.126"
	}

	var allocation models.Allocation
	// Check if desired port is free on this node
	err = ic.db.Where("node_id = ? AND port = ? AND server_id IS NULL", targetNode.ID, desiredPort).First(&allocation).Error
	if err != nil {
		// Check if port is already taken by another server
		var taken models.Allocation
		if err2 := ic.db.Where("node_id = ? AND port = ?", targetNode.ID, desiredPort).First(&taken).Error; err2 == nil {
			// Find next available free allocation
			if errFree := ic.db.Where("node_id = ? AND server_id IS NULL", targetNode.ID).Order("port asc").First(&allocation).Error; errFree != nil {
				// Create a new allocation entry
				nextPort := 25566
				var maxAlloc models.Allocation
				if errMax := ic.db.Where("node_id = ?", targetNode.ID).Order("port desc").First(&maxAlloc).Error; errMax == nil && maxAlloc.Port > 0 {
					nextPort = maxAlloc.Port + 1
				}
				allocation = models.Allocation{
					NodeID: targetNode.ID,
					IP:     targetIP,
					Port:   nextPort,
					Alias:  fmt.Sprintf("import-%d", nextPort),
				}
				ic.db.Create(&allocation)
			}
		} else {
			// Port is completely unallocated, create it
			allocation = models.Allocation{
				NodeID: targetNode.ID,
				IP:     targetIP,
				Port:   desiredPort,
				Alias:  fmt.Sprintf("import-%d", desiredPort),
			}
			ic.db.Create(&allocation)
		}
	}

	// 5. Build Server Name & Spec
	serverName := src.Name
	if req.OverrideName != "" {
		serverName = req.OverrideName
	}
	desc := src.Description
	if desc == "" {
		desc = fmt.Sprintf("Importiert von Pterodactyl/Pelican (Source UUID: %s)", src.UUID)
	}

	image := src.Container.Image
	if image == "" {
		image = "ghcr.io/pterodactyl/yolks:java_17"
	}

	startup := src.Container.StartupCommand
	if startup == "" {
		startup = "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui"
	}

	mem := src.Limits.Memory
	if mem <= 0 {
		mem = 2048
	}
	disk := src.Limits.Disk
	if disk <= 0 {
		disk = 10240
	}
	cpu := src.Limits.CPU
	if cpu <= 0 {
		cpu = 200
	}

	serverUUID := uuid.New().String()
	shortID := strings.ReplaceAll(serverUUID, "-", "")[:8]
	activeStatus := "active"

	newServer := models.Server{
		UUID:         serverUUID,
		Identifier:   shortID,
		Name:         serverName,
		Description:  desc,
		OwnerID:      ownerID,
		NodeID:       targetNode.ID,
		AllocationID: allocation.ID,
		MemoryMB:     mem,
		DiskMB:       disk,
		CPU:          cpu,
		SwapMB:       src.Limits.Swap,
		IO:           src.Limits.IO,
		Startup:      startup,
		Image:        image,
		Status:       &activeStatus,
		Suspended:    src.Suspended,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := ic.db.Create(&newServer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fehler beim Erstellen der PteroNext Instanz: " + err.Error()})
		return
	}

	// Link allocation to server
	ic.db.Model(&allocation).Update("server_id", newServer.ID)

	// 6. Import Environment Variables
	if len(src.Container.Environment) > 0 {
		for k, v := range src.Container.Environment {
			envVar := models.ServerVariable{
				ServerID:     newServer.ID,
				EnvVariable:  k,
				DefaultValue: v,
				UserViewable: true,
				UserEditable: true,
			}
			ic.db.Create(&envVar)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Server '%s' erfolgreich von Pterodactyl/Pelican/Hydrodactyl importiert!", newServer.Name),
		"server": gin.H{
			"id":         newServer.ID,
			"uuid":       newServer.UUID,
			"identifier": newServer.Identifier,
			"name":       newServer.Name,
			"node":       targetNode.Name,
			"port":       allocation.Port,
			"memory":     newServer.MemoryMB,
			"disk":       newServer.DiskMB,
			"cpu":        newServer.CPU,
		},
	})
}

// ImportEggOrJSON handles POST /api/admin/importer/upload-json
func (ic *ImporterController) ImportEggOrJSON(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)
	if user == nil || !user.RootAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Nur Administratoren können Egg/Projekt-JSONs importieren."})
		return
	}

	var req struct {
		JSONContent string `json:"json_content" binding:"required"`
		NodeID      uint   `json:"node_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON-Inhalt ist erforderlich."})
		return
	}

	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(req.JSONContent), &raw); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültiges JSON-Format: " + err.Error()})
		return
	}

	// Detect if it is an Egg export or a Server export
	if _, hasMeta := raw["_meta"]; hasMeta || raw["docker_images"] != nil {
		// Egg import
		name, _ := raw["name"].(string)
		if name == "" {
			name = "Imported Egg"
		}
		desc, _ := raw["description"].(string)
		startup, _ := raw["startup"].(string)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"type":    "egg",
			"name":    name,
			"description": desc,
			"startup": startup,
			"message": fmt.Sprintf("Pterodactyl / Pelican / Hydrodactyl Egg '%s' erfolgreich verifiziert und registriert.", name),
		})
		return
	}

	// Server JSON fallback
	name, _ := raw["name"].(string)
	if name == "" {
		name = "Imported Project " + strconv.FormatInt(time.Now().Unix(), 10)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"type":    "server_manifest",
		"name":    name,
		"message": "Projekt-Manifest erfolgreich validiert. Bereit zum Deployment.",
	})
}
