package web

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

// DistFS contains the embedded single-binary frontend distribution assets.
//
//go:embed all:dist
var DistFS embed.FS

// FS returns an io/fs.FS rooted at the "dist" directory.
func FS() (fs.FS, error) {
	return fs.Sub(DistFS, "dist")
}

// RegisterRoutes configures a Gin engine to serve embedded frontend assets
// and handle single-page application (SPA) client-side routing.
func RegisterRoutes(router *gin.Engine) {
	sub, err := FS()
	if err != nil {
		router.NoRoute(func(c *gin.Context) {
			if strings.HasPrefix(c.Request.URL.Path, "/api") || strings.HasPrefix(c.Request.URL.Path, "/ws") {
				c.JSON(http.StatusNotFound, gin.H{"error": "Endpoint not found"})
				return
			}
			c.String(http.StatusInternalServerError, "Embedded asset error: %v", err)
		})
		return
	}

	httpFS := http.FS(sub)
	fileServer := http.FileServer(httpFS)

	router.NoRoute(func(c *gin.Context) {
		reqPath := strings.TrimPrefix(path.Clean(c.Request.URL.Path), "/")

		// Never intercept API, remote daemon, or WebSocket routes
		if strings.HasPrefix(c.Request.URL.Path, "/api") ||
			strings.HasPrefix(c.Request.URL.Path, "/ws") ||
			strings.HasPrefix(c.Request.URL.Path, "/sanctum") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Endpoint not found"})
			return
		}

		// Check if the requested file exists in embedded assets
		if reqPath != "" && reqPath != "." {
			if f, err := sub.Open(reqPath); err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(c.Writer, c.Request)
				return
			}
		}

		// Fallback to index.html for SPA client-side routes (e.g. /server/xyz, /nodes)
		indexBytes, err := fs.ReadFile(sub, "index.html")
		if err != nil {
			c.String(http.StatusNotFound, "Frontend index.html not found")
			return
		}

		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexBytes)
	})
}
