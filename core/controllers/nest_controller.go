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
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// NestController handles Nest and Egg queries, templates and PTDL_v2 imports.
type NestController struct {
	db *gorm.DB
}

// NewNestController creates a new NestController instance.
func NewNestController(db *gorm.DB) *NestController {
	return &NestController{db: db}
}

// ListNests handles GET /api/nests
// Returns all nests with their associated eggs preloaded.
func (n *NestController) ListNests(c *gin.Context) {
	var nests []models.Nest
	if err := n.db.Preload("Eggs").Find(&nests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying nests."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  nests,
		"nests": nests,
	})
}

// GetEgg handles GET /api/eggs/:id
// Returns a specific egg with its variables and docker images.
func (n *NestController) GetEgg(c *gin.Context) {
	id := c.Param("id")
	var egg models.Egg
	if err := n.db.Preload("Nest").First(&egg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Egg not found."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": egg,
		"egg":  egg,
	})
}

// GetNest handles GET /api/nests/:id
// Returns a single nest with its eggs preloaded.
func (n *NestController) GetNest(c *gin.Context) {
	id := c.Param("id")
	var nest models.Nest
	if err := n.db.Preload("Eggs").First(&nest, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Nest not found."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": nest, "nest": nest})
}

// nestPayload is the accepted write payload for nest create/update operations.
type nestPayload struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Slug        string `json:"slug"`
}

// slugify produces a URL-safe slug from an arbitrary string.
func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			prevDash = false
			continue
		}
		if !prevDash && b.Len() > 0 {
			b.WriteRune('-')
			prevDash = true
		}
	}
	return strings.Trim(b.String(), "-")
}

// CreateNest handles POST /api/nests (admin only).
func (n *NestController) CreateNest(c *gin.Context) {
	var payload nestPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid nest payload: " + err.Error()})
		return
	}
	if strings.TrimSpace(payload.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nest name is required."})
		return
	}

	slug := slugify(payload.Slug)
	if slug == "" {
		slug = slugify(payload.Name)
	}
	if slug == "" {
		slug = "nest"
	}

	// Ensure slug uniqueness
	var count int64
	n.db.Model(&models.Nest{}).Where("slug = ?", slug).Count(&count)
	if count > 0 {
		slug = fmt.Sprintf("%s-%d", slug, time.Now().Unix()%100000)
	}

	nest := models.Nest{
		Name:        strings.TrimSpace(payload.Name),
		Description: strings.TrimSpace(payload.Description),
		Slug:        slug,
	}
	if err := n.db.Create(&nest).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating nest: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": nest, "nest": nest, "message": "Nest created."})
}

// UpdateNest handles PATCH /api/nests/:id (admin only).
func (n *NestController) UpdateNest(c *gin.Context) {
	id := c.Param("id")
	var nest models.Nest
	if err := n.db.First(&nest, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Nest not found."})
		return
	}

	var payload nestPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid nest payload: " + err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if strings.TrimSpace(payload.Name) != "" {
		updates["name"] = strings.TrimSpace(payload.Name)
	}
	if payload.Description != "" {
		updates["description"] = strings.TrimSpace(payload.Description)
	}
	if slug := slugify(payload.Slug); slug != "" && slug != nest.Slug {
		var count int64
		n.db.Model(&models.Nest{}).Where("slug = ? AND id <> ?", slug, nest.ID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "A nest with that slug already exists."})
			return
		}
		updates["slug"] = slug
	}

	if len(updates) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": nest, "nest": nest})
		return
	}

	if err := n.db.Model(&nest).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating nest."})
		return
	}
	n.db.Preload("Eggs").First(&nest, nest.ID)

	c.JSON(http.StatusOK, gin.H{"data": nest, "nest": nest, "message": "Nest updated."})
}

// DeleteNest handles DELETE /api/nests/:id (admin only).
// Nests that still contain eggs cannot be deleted to protect templates in use.
func (n *NestController) DeleteNest(c *gin.Context) {
	id := c.Param("id")
	var nest models.Nest
	if err := n.db.First(&nest, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Nest not found."})
		return
	}

	var eggCount int64
	n.db.Model(&models.Egg{}).Where("nest_id = ?", nest.ID).Count(&eggCount)
	if eggCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": fmt.Sprintf("Cannot delete nest: it still contains %d egg(s). Remove them first.", eggCount),
		})
		return
	}

	if err := n.db.Delete(&nest).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting nest."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Nest deleted."})
}

// ListEggs handles GET /api/nests/:id/eggs
// Returns every egg that belongs to the given nest.
func (n *NestController) ListEggs(c *gin.Context) {
	id := c.Param("id")
	var nest models.Nest
	if err := n.db.First(&nest, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Nest not found."})
		return
	}

	var eggs []models.Egg
	if err := n.db.Where("nest_id = ?", nest.ID).Order("name asc").Find(&eggs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying eggs."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": eggs, "eggs": eggs})
}

// ListAllEggs handles GET /api/eggs
// Returns every egg across all nests.
func (n *NestController) ListAllEggs(c *gin.Context) {
	var eggs []models.Egg
	if err := n.db.Preload("Nest").Order("name asc").Find(&eggs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying eggs."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": eggs, "eggs": eggs})
}

// eggPayload accepts partial egg updates. Nil pointers mean "leave unchanged".
type eggPayload struct {
	NestID          *uint               `json:"nest_id"`
	Name            *string             `json:"name"`
	Description     *string             `json:"description"`
	DockerImages    models.DockerImages `json:"docker_images"`
	StartupCommand  *string             `json:"startup_command"`
	ConfigStop      *string             `json:"config_stop"`
	ScriptInstall   *string             `json:"script_install"`
	ScriptContainer *string             `json:"script_container"`
	ScriptEntry     *string             `json:"script_entry"`
	Variables       models.EggVariables `json:"variables"`
}

// CreateEgg handles POST /api/eggs (admin only).
func (n *NestController) CreateEgg(c *gin.Context) {
	var payload struct {
		NestID          uint                `json:"nest_id" binding:"required"`
		Name            string              `json:"name" binding:"required"`
		Description     string              `json:"description"`
		DockerImages    models.DockerImages `json:"docker_images"`
		StartupCommand  string              `json:"startup_command"`
		ConfigStop      string              `json:"config_stop"`
		ScriptInstall   string              `json:"script_install"`
		ScriptContainer string              `json:"script_container"`
		ScriptEntry     string              `json:"script_entry"`
		Variables       models.EggVariables `json:"variables"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid egg payload: " + err.Error()})
		return
	}

	var nest models.Nest
	if err := n.db.First(&nest, payload.NestID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Specified nest not found."})
		return
	}

	if payload.DockerImages == nil || len(payload.DockerImages) == 0 {
		payload.DockerImages = models.DockerImages{"Default": "ghcr.io/pterodactyl/yolks:java_17"}
	}
	if payload.StartupCommand == "" {
		payload.StartupCommand = "java -jar server.jar"
	}
	if payload.ScriptContainer == "" {
		payload.ScriptContainer = "ghcr.io/pterodactyl/installers:alpine"
	}
	if payload.ScriptEntry == "" {
		payload.ScriptEntry = "ash"
	}

	egg := models.Egg{
		NestID:          payload.NestID,
		Name:            payload.Name,
		Description:     payload.Description,
		DockerImages:    payload.DockerImages,
		StartupCommand:  payload.StartupCommand,
		ConfigStop:      payload.ConfigStop,
		ScriptInstall:   payload.ScriptInstall,
		ScriptContainer: payload.ScriptContainer,
		ScriptEntry:     payload.ScriptEntry,
		Variables:       payload.Variables,
	}

	if err := n.db.Create(&egg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating egg: " + err.Error()})
		return
	}

	n.db.Preload("Nest").First(&egg, egg.ID)
	c.JSON(http.StatusCreated, gin.H{"data": egg, "egg": egg, "message": "Egg created successfully."})
}

// UpdateEgg handles PATCH /api/eggs/:id (admin only).
func (n *NestController) UpdateEgg(c *gin.Context) {
	id := c.Param("id")
	var egg models.Egg
	if err := n.db.First(&egg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Egg not found."})
		return
	}

	var payload eggPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid egg payload: " + err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if payload.NestID != nil {
		var nest models.Nest
		if err := n.db.First(&nest, *payload.NestID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Specified nest not found."})
			return
		}
		updates["nest_id"] = *payload.NestID
	}
	if payload.Name != nil && strings.TrimSpace(*payload.Name) != "" {
		updates["name"] = strings.TrimSpace(*payload.Name)
	}
	if payload.Description != nil {
		updates["description"] = *payload.Description
	}
	if payload.DockerImages != nil && len(payload.DockerImages) > 0 {
		updates["docker_images"] = payload.DockerImages
	}
	if payload.StartupCommand != nil {
		updates["startup_command"] = *payload.StartupCommand
	}
	if payload.ConfigStop != nil {
		updates["config_stop"] = *payload.ConfigStop
	}
	if payload.ScriptInstall != nil {
		updates["script_install"] = *payload.ScriptInstall
	}
	if payload.ScriptContainer != nil {
		updates["script_container"] = *payload.ScriptContainer
	}
	if payload.ScriptEntry != nil {
		updates["script_entry"] = *payload.ScriptEntry
	}
	if payload.Variables != nil {
		updates["variables"] = payload.Variables
	}

	if len(updates) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": egg, "egg": egg})
		return
	}

	if err := n.db.Model(&egg).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating egg: " + err.Error()})
		return
	}
	n.db.Preload("Nest").First(&egg, egg.ID)

	c.JSON(http.StatusOK, gin.H{"data": egg, "egg": egg, "message": "Egg updated."})
}

// DeleteEgg handles DELETE /api/eggs/:id (admin only).
// Eggs that are referenced by existing servers cannot be deleted.
func (n *NestController) DeleteEgg(c *gin.Context) {
	id := c.Param("id")
	var egg models.Egg
	if err := n.db.First(&egg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Egg not found."})
		return
	}

	var serverCount int64
	n.db.Model(&models.Server{}).Where("egg_id = ?", egg.ID).Count(&serverCount)
	if serverCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": fmt.Sprintf("Cannot delete egg: %d server(s) still use this template.", serverCount),
		})
		return
	}

	if err := n.db.Delete(&egg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting egg."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Egg deleted."})
}

// ImportEgg handles POST /api/eggs/import
// Accepts uploaded file or raw Pterodactyl Egg JSON (PTDL_v1 / PTDL_v2) and creates or updates an egg.
func (n *NestController) ImportEgg(c *gin.Context) {
	var rawData []byte
	var nestID uint

	// Check nest_id from query or form
	if qID := c.Query("nest_id"); qID != "" {
		if val, err := strconv.ParseUint(qID, 10, 32); err == nil {
			nestID = uint(val)
		}
	}
	if fID := c.PostForm("nest_id"); fID != "" && nestID == 0 {
		if val, err := strconv.ParseUint(fID, 10, 32); err == nil {
			nestID = uint(val)
		}
	}

	// 1. Check multipart file upload
	contentType := c.GetHeader("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		fileHeader, err := c.FormFile("file")
		if err != nil {
			fileHeader, err = c.FormFile("egg")
		}

		if err == nil && fileHeader != nil {
			file, err := fileHeader.Open()
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Failed reading uploaded egg file."})
				return
			}
			defer file.Close()
			rawData, err = io.ReadAll(file)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Failed reading file payload."})
				return
			}
		} else {
			// Check form field egg / content
			if content := c.PostForm("egg"); content != "" {
				rawData = []byte(content)
			} else if content := c.PostForm("content"); content != "" {
				rawData = []byte(content)
			}
		}
	}

	// 2. If not multipart or file was not found, read raw request body
	if len(rawData) == 0 {
		body, err := c.GetRawData()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed reading request payload."})
			return
		}
		rawData = body
	}

	if len(rawData) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No egg JSON payload provided."})
		return
	}

	// Parse JSON
	var importDTO models.PTDLEggImport
	if err := json.Unmarshal(rawData, &importDTO); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid egg JSON format: " + err.Error()})
		return
	}

	if importDTO.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Egg name is required."})
		return
	}

	// Determine Nest
	if nestID == 0 && importDTO.NestID > 0 {
		nestID = importDTO.NestID
	}

	var nest models.Nest
	if nestID > 0 {
		if err := n.db.First(&nest, nestID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Specified nest not found."})
			return
		}
	} else {
		// Default to imported nest or fallback nest
		if err := n.db.Where("slug = ?", "imported").First(&nest).Error; err != nil {
			nest = models.Nest{
				Name:        "Imported Eggs",
				Description: "User-imported Pterodactyl egg templates.",
				Slug:        "imported",
			}
			if err := n.db.Create(&nest).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating import nest."})
				return
			}
		}
		nestID = nest.ID
	}

	egg := importDTO.ToEgg()
	egg.NestID = nestID

	// Check if an egg with this name already exists in this nest
	var existing models.Egg
	isUpdate := false
	if err := n.db.Where("nest_id = ? AND name = ?", nestID, egg.Name).First(&existing).Error; err == nil {
		egg.ID = existing.ID
		egg.CreatedAt = existing.CreatedAt
		if err := n.db.Save(egg).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating existing egg: " + err.Error()})
			return
		}
		isUpdate = true
	} else {
		if err := n.db.Create(egg).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating egg: " + err.Error()})
			return
		}
	}

	// Reload with Nest
	n.db.Preload("Nest").First(egg, egg.ID)

	status := http.StatusCreated
	if isUpdate {
		status = http.StatusOK
	}

	c.JSON(status, gin.H{
		"data":    egg,
		"egg":     egg,
		"updated": isUpdate,
		"message": "Egg imported successfully.",
	})
}
