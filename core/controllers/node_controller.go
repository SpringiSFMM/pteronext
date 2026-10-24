package controllers

import (
	"bytes"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/config"
	"github.com/pteronext/panel-core/models"
	"golang.org/x/crypto/ssh"
	"gorm.io/gorm"
)

// NodeController manages daemon node records and configuration generation.
type NodeController struct {
	db  *gorm.DB
	cfg *config.Config
}

// NewNodeController creates a new NodeController.
func NewNodeController(db *gorm.DB, cfg *config.Config) *NodeController {
	return &NodeController{
		db:  db,
		cfg: cfg,
	}
}

// ListNodes handles GET /api/nodes
func (n *NodeController) ListNodes(c *gin.Context) {
	var nodes []models.Node
	if err := n.db.Preload("Allocations").Find(&nodes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying nodes."})
		return
	}

	for i := range nodes {
		var stat struct {
			Count         int64
			AllocatedMem  int64
			AllocatedDisk int64
		}
		n.db.Model(&models.Server{}).
			Where("node_id = ? AND deleted_at IS NULL", nodes[i].ID).
			Select("COUNT(id) as count, COALESCE(SUM(memory_mb), 0) as allocated_mem, COALESCE(SUM(disk_mb), 0) as allocated_disk").
			Scan(&stat)

		nodes[i].ServersCount = stat.Count
		nodes[i].AllocatedMemory = stat.AllocatedMem
		nodes[i].AllocatedDisk = stat.AllocatedDisk
	}

	c.JSON(http.StatusOK, gin.H{"data": nodes})
}

// GetNode handles GET /api/nodes/:id
func (n *NodeController) GetNode(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.Preload("Allocations").Preload("Servers").First(&node, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found."})
		return
	}

	var stat struct {
		Count         int64
		AllocatedMem  int64
		AllocatedDisk int64
	}
	n.db.Model(&models.Server{}).
		Where("node_id = ? AND deleted_at IS NULL", node.ID).
		Select("COUNT(id) as count, COALESCE(SUM(memory_mb), 0) as allocated_mem, COALESCE(SUM(disk_mb), 0) as allocated_disk").
		Scan(&stat)

	node.ServersCount = stat.Count
	node.AllocatedMemory = stat.AllocatedMem
	node.AllocatedDisk = stat.AllocatedDisk

	c.JSON(http.StatusOK, gin.H{"node": node, "data": node})
}

// CreateNode handles POST /api/nodes
func (n *NodeController) CreateNode(c *gin.Context) {
	var node models.Node
	if err := c.ShouldBindJSON(&node); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := n.db.Create(&node).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating node: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"node": node, "data": node})
}

// UpdateNode handles PATCH /api/nodes/:id
func (n *NodeController) UpdateNode(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.First(&node, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found."})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload."})
		return
	}

	// Do not overwrite primary key, uuid, or relation fields
	delete(updates, "id")
	delete(updates, "uuid")
	delete(updates, "allocations")
	delete(updates, "servers")

	// Remap frontend JSON field names to DB column names
	fieldMap := map[string]string{
		"memory":        "memory_mb",
		"disk":          "disk_mb",
		"upload_size":   "upload_size_mb",
		"daemon_listen": "daemon_listen_port",
		"daemon_sftp":   "daemon_sftp_port",
		"daemon_base":   "daemon_base_dir",
	}
	for jsonKey, colName := range fieldMap {
		if val, ok := updates[jsonKey]; ok {
			updates[colName] = val
			delete(updates, jsonKey)
		}
	}

	if err := n.db.Model(&node).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating node: " + err.Error()})
		return
	}

	// Reload updated node with relations
	n.db.Preload("Allocations").Preload("Servers").First(&node, id)
	c.JSON(http.StatusOK, gin.H{"node": node, "data": node})
}

// DeleteNode handles DELETE /api/nodes/:id
func (n *NodeController) DeleteNode(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.First(&node, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found."})
		return
	}

	// Check if any servers are assigned
	var serverCount int64
	n.db.Model(&models.Server{}).Where("node_id = ?", node.ID).Count(&serverCount)
	if serverCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete node with active servers assigned to it."})
		return
	}

	if err := n.db.Delete(&node).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting node."})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetConfiguration handles GET /api/nodes/:id/configuration
// Generates the Wings daemon config.yml YAML string.
func (n *NodeController) GetConfiguration(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.First(&node, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found."})
		return
	}

	panelURL := n.cfg.AppURL
	yamlContent := node.GenerateWingsConfiguration(panelURL)

	c.JSON(http.StatusOK, gin.H{
		"node_id":   node.ID,
		"uuid":      node.UUID,
		"token_id":  node.DaemonTokenID,
		"token":     node.DaemonToken,
		"yaml":      yamlContent,
	})
}

// GenerateInstallScriptContent builds the universal bash installation script for a node.
func (n *NodeController) GenerateInstallScriptContent(node *models.Node) string {
	panelURL := n.cfg.AppURL
	if panelURL == "" {
		panelURL = "https://panel.pteronext.com"
	}
	yamlContent := node.GenerateWingsConfiguration(panelURL)

	return fmt.Sprintf(`#!/usr/bin/env bash
# ==============================================================================
# PteroNext Wings Automated Universal Installer
# Node: %s (UUID: %s)
# ==============================================================================
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     PTERONEXT WINGS AUTOMATED NODE INSTALLER     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this installer as root (e.g. sudo bash).${NC}"
  exit 1
fi

echo -e "${YELLOW}[1/5] Verifying dependencies & architecture...${NC}"
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
  WINGS_ARCH="wings_linux_amd64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  WINGS_ARCH="wings_linux_arm64"
else
  echo -e "${RED}[ERROR] Unsupported architecture: $ARCH${NC}"
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq || true
  apt-get install -y -qq curl tar >/dev/null 2>&1 || true
elif command -v yum >/dev/null 2>&1; then
  yum install -y -q curl tar >/dev/null 2>&1 || true
fi

echo -e "${YELLOW}[2/5] Checking Docker installation...${NC}"
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${CYAN}Installing Docker via official get.docker.com script...${NC}"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo -e "${GREEN}[✓] Docker is already installed: $(docker --version)${NC}"
  systemctl enable --now docker || true
fi

echo -e "${YELLOW}[3/5] Installing Wings Daemon binary...${NC}"
mkdir -p /etc/pterodactyl /var/log/pterodactyl /var/lib/pterodactyl
curl -fsSL -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/${WINGS_ARCH}"
chmod u+x /usr/local/bin/wings
echo -e "${GREEN}[✓] Wings binary installed.${NC}"

echo -e "${YELLOW}[4/5] Writing /etc/pterodactyl/config.yml...${NC}"
cat << 'EOF' > /etc/pterodactyl/config.yml
%s
EOF
chmod 600 /etc/pterodactyl/config.yml
echo -e "${GREEN}[✓] Configuration written.${NC}"

echo -e "${YELLOW}[5/5] Configuring and starting wings.service...${NC}"
cat << 'EOF' > /etc/systemd/system/wings.service
[Unit]
Description=PteroNext Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now wings

sleep 2
if systemctl is-active --quiet wings; then
  echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  [✓] WINGS SUCCESSFULLY INSTALLED AND RUNNING!   ║${NC}"
  echo -e "${GREEN}║  Node is now connected to PteroNext Panel.      ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
else
  echo -e "${YELLOW}[WARNING] Wings service started but status check returned inactive.${NC}"
  echo -e "Check logs with: journalctl -u wings -n 20 --no-pager"
fi
`, node.Name, node.UUID, yamlContent)
}

// GetInstallScript handles GET /api/nodes/:id/install-script
// Generates and returns the universal bash installation script.
func (n *NodeController) GetInstallScript(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.First(&node, id).Error; err != nil {
		c.String(http.StatusNotFound, "echo '[ERROR] Node not found'")
		return
	}

	// Security: allow if token query matches node DaemonToken OR if user is authenticated admin
	tokenParam := c.Query("token")
	if tokenParam != "" && tokenParam != node.DaemonToken {
		c.String(http.StatusUnauthorized, "echo '[ERROR] Invalid node installation token'")
		return
	}

	script := n.GenerateInstallScriptContent(&node)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"install-wings-node-%d.sh\"", node.ID))
	c.Data(http.StatusOK, "text/x-shellscript; charset=utf-8", []byte(script))
}

// AutoProvisionRequest holds SSH connection details for 1-click provisioning
type AutoProvisionRequest struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	PrivateKey string `json:"private_key"`
}

// AutoProvision handles POST /api/nodes/:id/auto-provision
// Connects via SSH and executes automated Docker + Wings setup.
func (n *NodeController) AutoProvision(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.First(&node, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found."})
		return
	}

	var req AutoProvisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid SSH credentials provided."})
		return
	}

	host := strings.TrimSpace(req.Host)
	if host == "" {
		host = node.FQDN
	}
	port := req.Port
	if port <= 0 {
		port = 22
	}
	username := strings.TrimSpace(req.Username)
	if username == "" {
		username = "root"
	}

	var authMethods []ssh.AuthMethod
	if req.Password != "" {
		authMethods = append(authMethods, ssh.Password(req.Password))
	}
	if req.PrivateKey != "" {
		signer, err := ssh.ParsePrivateKey([]byte(req.PrivateKey))
		if err == nil {
			authMethods = append(authMethods, ssh.PublicKeys(signer))
		}
	}

	if len(authMethods) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Either SSH password or private key is required."})
		return
	}

	sshConfig := &ssh.ClientConfig{
		User:            username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}

	addr := net.JoinHostPort(host, fmt.Sprintf("%d", port))
	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"error":   fmt.Sprintf("Failed to connect via SSH to %s: %v", addr, err),
			"success": false,
		})
		return
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   fmt.Sprintf("Failed creating SSH session: %v", err),
			"success": false,
		})
		return
	}
	defer session.Close()

	script := n.GenerateInstallScriptContent(&node)
	var stdoutBuf, stderrBuf bytes.Buffer
	session.Stdout = &stdoutBuf
	session.Stderr = &stderrBuf

	// Run script on remote server
	cmd := fmt.Sprintf("bash -c %q", script)
	runErr := session.Run(cmd)

	allLogs := stdoutBuf.String()
	if stderrBuf.Len() > 0 {
		allLogs += "\n[STDERR]\n" + stderrBuf.String()
	}

	if runErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Installation failed: %v", runErr),
			"logs":    allLogs,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Wings daemon was successfully installed and started on remote server!",
		"logs":    allLogs,
	})
}
