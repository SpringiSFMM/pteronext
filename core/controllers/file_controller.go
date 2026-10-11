package controllers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

type FileController struct {
	fileService *services.FileService
	db          *gorm.DB
}

func NewFileController(fileService *services.FileService, db *gorm.DB) *FileController {
	return &FileController{
		fileService: fileService,
		db:          db,
	}
}

func (fc *FileController) checkServerWritable(c *gin.Context) bool {
	server, _ := middleware.GetRequestServer(c)
	user, _ := middleware.GetRequestUser(c)
	if server != nil && server.Suspended && (user == nil || !user.RootAdmin) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Dieser Server ist administrativ suspendiert. Dateiänderungen, Uploads und Löschungen sind gesperrt.",
		})
		return false
	}
	return true
}

// ListFiles handles GET /api/servers/:uuid/files/list
func (fc *FileController) ListFiles(c *gin.Context) {
	uuid := c.Param("uuid")
	directory := c.DefaultQuery("directory", "/")

	files, err := fc.fileService.ListDirectory(uuid, directory)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Apply subuser Path-Rules: visually lock denied files/directories
	if subuserVal, exists := c.Get("subuser"); exists {
		if subuser, ok := subuserVal.(*models.Subuser); ok && subuser != nil {
			for i := range files {
				if !subuser.CheckPathAccess(files[i].Path) {
					files[i].IsLocked = true
					files[i].Editable = false
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": files})
}

// GetFileContent handles GET /api/servers/:uuid/files/contents
func (fc *FileController) GetFileContent(c *gin.Context) {
	uuid := c.Param("uuid")
	filePath := c.Query("file")
	if filePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query param 'file' is required."})
		return
	}

	// Check subuser Path-Rules
	if subuserVal, exists := c.Get("subuser"); exists {
		if subuser, ok := subuserVal.(*models.Subuser); ok && subuser != nil {
			if !subuser.CheckPathAccess(filePath) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Path is locked by server security policy."})
				return
			}
		}
	}

	content, err := fc.fileService.GetFileContent(uuid, filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"content": content})
}

// WriteFileContent handles POST /api/servers/:uuid/files/write
func (fc *FileController) WriteFileContent(c *gin.Context) {
	if !fc.checkServerWritable(c) {
		return
	}

	uuid := c.Param("uuid")

	var req struct {
		File    string `json:"file" binding:"required"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check subuser Path-Rules
	if subuserVal, exists := c.Get("subuser"); exists {
		if subuser, ok := subuserVal.(*models.Subuser); ok && subuser != nil {
			if !subuser.CheckPathAccess(req.File) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Write access denied by server security policy."})
				return
			}
		}
	}

	// File-Time-Machine: Snapshot previous content before saving new changes
	if fc.db != nil {
		if previousContent, err := fc.fileService.GetFileContent(uuid, req.File); err == nil && len(previousContent) > 0 && previousContent != req.Content && len(previousContent) < 1000000 {
			user, _ := middleware.GetRequestUser(c)
			author := "system"
			if user != nil {
				author = user.Username
			}
			fc.db.Create(&models.FileRevision{
				ServerUUID: uuid,
				FilePath:   req.File,
				Content:    previousContent,
				Size:       int64(len(previousContent)),
				CreatedBy:  author,
				CreatedAt:  time.Now(),
			})
		}
	}

	if err := fc.fileService.WriteFile(uuid, req.File, req.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListFileRevisions handles GET /api/servers/:uuid/files/revisions
func (fc *FileController) ListFileRevisions(c *gin.Context) {
	uuid := c.Param("uuid")
	file := c.Query("file")
	if file == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query param 'file' is required"})
		return
	}

	// Check subuser Path-Rules
	if subuserVal, exists := c.Get("subuser"); exists {
		if subuser, ok := subuserVal.(*models.Subuser); ok && subuser != nil {
			if !subuser.CheckPathAccess(file) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Path is locked by server security policy."})
				return
			}
		}
	}

	var revisions []models.FileRevision
	if fc.db != nil {
		fc.db.Where("server_uuid = ? AND file_path = ?", uuid, file).Order("created_at desc").Limit(30).Find(&revisions)
	}

	c.JSON(http.StatusOK, gin.H{
		"revisions": revisions,
		"file":      file,
		"count":     len(revisions),
	})
}

// GetFileRevision handles GET /api/servers/:uuid/files/revisions/:id
func (fc *FileController) GetFileRevision(c *gin.Context) {
	uuid := c.Param("uuid")
	idStr := c.Param("id")
	revID, _ := strconv.Atoi(idStr)

	var rev models.FileRevision
	if err := fc.db.Where("id = ? AND server_uuid = ?", revID, uuid).First(&rev).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Revision not found"})
		return
	}

	// Check subuser Path-Rules
	if subuserVal, exists := c.Get("subuser"); exists {
		if subuser, ok := subuserVal.(*models.Subuser); ok && subuser != nil {
			if !subuser.CheckPathAccess(rev.FilePath) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Path is locked by server security policy."})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"revision": rev})
}

// RestoreFileRevision handles POST /api/servers/:uuid/files/revisions/:id/restore
func (fc *FileController) RestoreFileRevision(c *gin.Context) {
	if !fc.checkServerWritable(c) {
		return
	}

	uuid := c.Param("uuid")
	idStr := c.Param("id")
	revID, _ := strconv.Atoi(idStr)

	var rev models.FileRevision
	if err := fc.db.Where("id = ? AND server_uuid = ?", revID, uuid).First(&rev).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Revision not found"})
		return
	}

	// Check subuser Path-Rules
	if subuserVal, exists := c.Get("subuser"); exists {
		if subuser, ok := subuserVal.(*models.Subuser); ok && subuser != nil {
			if !subuser.CheckPathAccess(rev.FilePath) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Write access denied by server security policy."})
				return
			}
		}
	}

	// Write restored content to file
	if err := fc.fileService.WriteFile(uuid, rev.FilePath, rev.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed restoring file revision: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Datei '%s' erfolgreich auf Revision vom %s zurückgesetzt!", rev.FilePath, rev.CreatedAt.Format("02.01. 15:04:05")),
		"content": rev.Content,
	})
}

// UploadFiles handles POST /api/servers/:uuid/files/upload
func (fc *FileController) UploadFiles(c *gin.Context) {
	if !fc.checkServerWritable(c) {
		return
	}

	uuid := c.Param("uuid")
	root := c.DefaultPostForm("root", "/")

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid multipart form."})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		// Also check single "file" field
		files = form.File["file"]
	}

	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files found in upload payload."})
		return
	}

	var uploaded []services.FileItem
	for _, fh := range files {
		f, err := fh.Open()
		if err != nil {
			continue
		}
		item, err := fc.fileService.SaveUploadedFile(uuid, root, fh.Filename, f)
		f.Close()
		if err == nil && item != nil {
			uploaded = append(uploaded, *item)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"uploaded": uploaded,
		"count":    len(uploaded),
	})
}

// DeleteFiles handles POST /api/servers/:uuid/files/delete
func (fc *FileController) DeleteFiles(c *gin.Context) {
	if !fc.checkServerWritable(c) {
		return
	}

	uuid := c.Param("uuid")

	var req struct {
		Root  string   `json:"root"`
		Files []string `json:"files" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Root == "" {
		req.Root = "/"
	}

	if err := fc.fileService.DeleteFiles(uuid, req.Root, req.Files); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// CreateDirectory handles POST /api/servers/:uuid/files/create-directory
func (fc *FileController) CreateDirectory(c *gin.Context) {
	if !fc.checkServerWritable(c) {
		return
	}

	uuid := c.Param("uuid")

	var req struct {
		Root string `json:"root"`
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Root == "" {
		req.Root = "/"
	}

	if err := fc.fileService.CreateDirectory(uuid, req.Root, req.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// RenameFile handles PUT /api/servers/:uuid/files/rename
func (fc *FileController) RenameFile(c *gin.Context) {
	if !fc.checkServerWritable(c) {
		return
	}

	uuid := c.Param("uuid")

	var req struct {
		Root string `json:"root"`
		From string `json:"from" binding:"required"`
		To   string `json:"to" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Root == "" {
		req.Root = "/"
	}

	if err := fc.fileService.Rename(uuid, req.Root, req.From, req.To); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// InstallVersion handles POST /api/servers/:uuid/files/install-version
func (fc *FileController) InstallVersion(c *gin.Context) {
	if !fc.checkServerWritable(c) {
		return
	}

	uuid := c.Param("uuid")

	var req struct {
		Version string `json:"version" binding:"required"`
		JarFile string `json:"jar_file"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := fc.fileService.InstallMinecraftVersion(uuid, req.Version, req.JarFile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Minecraft " + req.Version + " jar successfully installed.",
	})
}

// DownloadRemote handles POST /api/servers/:uuid/files/download-remote
func (fc *FileController) DownloadRemote(c *gin.Context) {
	if !fc.checkServerWritable(c) {
		return
	}

	uuid := c.Param("uuid")

	var req struct {
		URL       string `json:"url" binding:"required"`
		Directory string `json:"directory"`
		Filename  string `json:"filename"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Field 'url' is required: " + err.Error()})
		return
	}

	item, err := fc.fileService.DownloadRemoteFile(uuid, req.Directory, req.Filename, req.URL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"file":    item,
	})
}
