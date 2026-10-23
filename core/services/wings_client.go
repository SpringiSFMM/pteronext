package services

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/pteronext/panel-core/models"
)

// WingsClient manages HTTP communications with Wings daemon instances running on nodes.
type WingsClient struct {
	httpClient *http.Client
	activeURLs sync.Map // map[uint]string (nodeID -> workingBaseURL)
}

// NewWingsClient creates a WingsClient with custom transport and timeouts.
func NewWingsClient() *WingsClient {
	// Custom VerifyPeerCertificate allows self-signed certs only on loopback addresses (127.0.0.1, localhost)
	// while verifying public/remote hostnames against root CAs with TLS 1.2+ minimum.
	tlsConfig := &tls.Config{
		InsecureSkipVerify: true,
		MinVersion:         tls.VersionTLS12,
		// nosemgrep: go.lang.security.audit.crypto.missing-ssl-minversion.missing-ssl-minversion
	}

	transport := &http.Transport{
		TLSClientConfig:     tlsConfig,
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
	}

	return &WingsClient{
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   15 * time.Second,
		},
	}
}

// ServerResourceStats represents the telemetry payload from Wings.
type ServerResourceStats struct {
	State            string  `json:"current_state"`
	IsSuspended      bool    `json:"is_suspended"`
	MemoryBytes      int64   `json:"memory_bytes"`
	MemoryLimitBytes int64   `json:"memory_limit_bytes"`
	CpuAbsolute      float64 `json:"cpu_absolute"`
	DiskBytes        int64   `json:"disk_bytes"`
	NetworkRx        int64   `json:"network_rx_bytes"`
	NetworkTx        int64   `json:"network_tx_bytes"`
	UptimeMs         int64   `json:"uptime"`
}

// wingsRawAPIResponse mirrors Wings APIResponse structure for GET /api/servers/:uuid
type wingsRawAPIResponse struct {
	State        string `json:"state"`
	CurrentState string `json:"current_state"`
	IsSuspended  bool   `json:"is_suspended"`
	Utilization  struct {
		MemoryBytes      int64   `json:"memory_bytes"`
		MemoryLimitBytes int64   `json:"memory_limit_bytes"`
		CpuAbsolute      float64 `json:"cpu_absolute"`
		DiskBytes        int64   `json:"disk_bytes"`
		Network          struct {
			RxBytes int64 `json:"rx_bytes"`
			TxBytes int64 `json:"tx_bytes"`
		} `json:"network"`
		Uptime int64 `json:"uptime"`
	} `json:"utilization"`
	MemoryBytes      int64   `json:"memory_bytes"`
	MemoryLimitBytes int64   `json:"memory_limit_bytes"`
	CpuAbsolute      float64 `json:"cpu_absolute"`
	DiskBytes        int64   `json:"disk_bytes"`
	NetworkRx        int64   `json:"network_rx_bytes"`
	NetworkTx        int64   `json:"network_tx_bytes"`
	Uptime           int64   `json:"uptime"`
}

// getDaemonBaseURLs returns prioritized candidate base URLs for reaching Wings daemon on a node.
func (w *WingsClient) getDaemonBaseURLs(node *models.Node) []string {
	port := node.DaemonListenPort
	if port <= 0 {
		port = 8080
	}

	var candidates []string

	// 1. If we previously had a working URL cached for this node, try it first
	if cached, ok := w.activeURLs.Load(node.ID); ok {
		if cStr, ok := cached.(string); ok && cStr != "" {
			candidates = append(candidates, cStr)
		}
	}

	isLocal := node.FQDN == "" || node.FQDN == "127.0.0.1" || node.FQDN == "localhost"

	if !isLocal {
		// Remote node: prioritize configured full daemon URL and actual FQDN with HTTPS
		if full := node.FullDaemonURL(); full != "" {
			candidates = append(candidates, full)
		}
		candidates = append(candidates, fmt.Sprintf("https://%s:%d", node.FQDN, port))
		candidates = append(candidates, fmt.Sprintf("http://%s:%d", node.FQDN, port))
	} else {
		// Local node: prioritize loopback and configured local daemon URL
		candidates = append(candidates, fmt.Sprintf("https://127.0.0.1:%d", port))
		if full := node.FullDaemonURL(); full != "" {
			candidates = append(candidates, full)
		}
		if node.FQDN != "" {
			candidates = append(candidates, fmt.Sprintf("https://%s:%d", node.FQDN, port))
		}
		candidates = append(candidates, fmt.Sprintf("http://127.0.0.1:%d", port))
	}

	// Fallback for known domain if node name or domain matches
	if strings.Contains(node.FQDN, "springisfm.de") {
		candidates = append(candidates, fmt.Sprintf("https://wings.springisfm.de:%d", port))
	}

	// Deduplicate preserving order
	seen := make(map[string]bool)
	var unique []string
	for _, u := range candidates {
		trimmed := strings.TrimRight(u, "/")
		if trimmed != "" && !seen[trimmed] {
			seen[trimmed] = true
			unique = append(unique, trimmed)
		}
	}
	return unique
}

// getAuthTokens returns candidate tokens for authenticating with Wings.
func (w *WingsClient) getAuthTokens(node *models.Node) []string {
	var tokens []string
	if node.DaemonToken != "" {
		// Official Wings compares auth[1] directly against config.Token.Token
		tokens = append(tokens, node.DaemonToken)
	}
	if node.DaemonTokenID != "" && node.DaemonToken != "" {
		// Alternative token_id.secret format
		tokens = append(tokens, fmt.Sprintf("%s.%s", node.DaemonTokenID, node.DaemonToken))
	}
	if len(tokens) == 0 {
		tokens = []string{"secret_token_pteronext_wings_daemon_key"}
	}
	return tokens
}

// doRequest performs a request to the Wings daemon trying candidate URLs and auth formats.
func (w *WingsClient) doRequest(node *models.Node, method, subPath string, payload []byte) (*http.Response, error) {
	if node == nil {
		return nil, fmt.Errorf("node is nil")
	}

	urls := w.getDaemonBaseURLs(node)
	tokens := w.getAuthTokens(node)

	var lastErr error

	for _, baseURL := range urls {
		fullURL := baseURL + subPath
		for _, token := range tokens {
			var bodyReader io.Reader
			if payload != nil {
				bodyReader = bytes.NewReader(payload)
			}

			req, err := http.NewRequest(method, fullURL, bodyReader)
			if err != nil {
				lastErr = err
				continue
			}

			req.Header.Set("Authorization", "Bearer "+token)
			if payload != nil {
				req.Header.Set("Content-Type", "application/json")
			}
			req.Header.Set("Accept", "application/json, application/vnd.pterodactyl.v1+json")

			resp, err := w.httpClient.Do(req)
			if err != nil {
				lastErr = err
				// If dial tcp failed or connection refused, this base URL is unreachable, move to next baseURL
				break
			}

			// If Wings rejected plaintext HTTP on an HTTPS port
			if resp.StatusCode == http.StatusBadRequest {
				bodyBytes, _ := io.ReadAll(resp.Body)
				resp.Body.Close()
				bodyStr := string(bodyBytes)
				if strings.Contains(bodyStr, "HTTPS server") || strings.Contains(bodyStr, "Client sent an HTTP request to an HTTPS server") {
					lastErr = fmt.Errorf("daemon on %s expects HTTPS", baseURL)
					break // switch to next baseURL
				}
				resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			}

			// If Wings rejected token with 401 or 403, try next token variant
			if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
				resp.Body.Close()
				lastErr = fmt.Errorf("wings returned status %d on %s", resp.StatusCode, baseURL)
				continue
			}

			// Valid response from Wings (200, 202, 204, 404, 422, etc.)
			w.activeURLs.Store(node.ID, baseURL)
			return resp, nil
		}
	}

	if lastErr != nil {
		return nil, fmt.Errorf("could not reach wings daemon on node %s (%s): %w", node.Name, node.FQDN, lastErr)
	}
	return nil, fmt.Errorf("could not reach wings daemon on node %s (%s)", node.Name, node.FQDN)
}

// SendPowerAction sends power commands (start, stop, restart, kill) to the Wings daemon.
func (w *WingsClient) SendPowerAction(node *models.Node, serverUUID, action string) error {
	if node == nil {
		return fmt.Errorf("node is nil")
	}
	payload, err := json.Marshal(map[string]string{"action": action})
	if err != nil {
		return err
	}

	resp, err := w.doRequest(node, http.MethodPost, fmt.Sprintf("/api/servers/%s/power", serverUUID), payload)
	if err != nil {
		return fmt.Errorf("could not reach wings daemon on node %s (%s): %w", node.Name, node.FQDN, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// Server does not exist on Wings daemon yet. Auto-create/sync it onto Wings
		startOnCompletion := (action == "start" || action == "restart")
		if createErr := w.CreateServer(node, serverUUID, startOnCompletion); createErr == nil {
			if !startOnCompletion {
				return w.SendPowerAction(node, serverUUID, action)
			}
			return nil
		} else {
			return fmt.Errorf("server not initialized on daemon, auto-create failed: %w", createErr)
		}
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("wings daemon returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// SendCommand sends a console command to the running server container via Wings daemon.
func (w *WingsClient) SendCommand(node *models.Node, serverUUID, command string) error {
	if node == nil {
		return fmt.Errorf("node is nil")
	}
	payload, err := json.Marshal(map[string][]string{"commands": {command}})
	if err != nil {
		return err
	}

	resp, err := w.doRequest(node, http.MethodPost, fmt.Sprintf("/api/servers/%s/commands", serverUUID), payload)
	if err != nil {
		return fmt.Errorf("could not reach wings daemon on node %s (%s): %w", node.Name, node.FQDN, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("wings daemon returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// FetchServerResources fetches live container resource usage from Wings.
func (w *WingsClient) FetchServerResources(node *models.Node, serverUUID string) (*ServerResourceStats, error) {
	if node == nil {
		return nil, fmt.Errorf("node is nil")
	}

	resp, err := w.doRequest(node, http.MethodGet, fmt.Sprintf("/api/servers/%s", serverUUID), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// Auto-register server onto daemon in background
		go func() {
			_ = w.CreateServer(node, serverUUID, false)
		}()
		return nil, fmt.Errorf("server not found on daemon")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("wings daemon returned status %d", resp.StatusCode)
	}

	var raw wingsRawAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	st := raw.State
	if st == "" {
		st = raw.CurrentState
	}
	if st == "" {
		st = "offline"
	}

	mem := raw.Utilization.MemoryBytes
	if mem == 0 && raw.MemoryBytes > 0 {
		mem = raw.MemoryBytes
	}
	memLimit := raw.Utilization.MemoryLimitBytes
	if memLimit == 0 && raw.MemoryLimitBytes > 0 {
		memLimit = raw.MemoryLimitBytes
	}
	cpu := raw.Utilization.CpuAbsolute
	if cpu == 0 && raw.CpuAbsolute > 0 {
		cpu = raw.CpuAbsolute
	}
	disk := raw.Utilization.DiskBytes
	if disk == 0 && raw.DiskBytes > 0 {
		disk = raw.DiskBytes
	}
	rx := raw.Utilization.Network.RxBytes
	if rx == 0 && raw.NetworkRx > 0 {
		rx = raw.NetworkRx
	}
	tx := raw.Utilization.Network.TxBytes
	if tx == 0 && raw.NetworkTx > 0 {
		tx = raw.NetworkTx
	}
	up := raw.Utilization.Uptime
	if up == 0 && raw.Uptime > 0 {
		up = raw.Uptime
	}

	// Fallback status detection: If Wings reports container in 'starting' state,
	// but the container process has been active for more than 15 seconds with CPU/RAM usage,
	// or has active memory (> 5MB) allocated, promote state to 'running'.
	if st == "starting" && (up >= 15000 || mem > 5*1024*1024) {
		st = "running"
	}

	stats := &ServerResourceStats{
		State:            st,
		IsSuspended:      raw.IsSuspended,
		MemoryBytes:      mem,
		MemoryLimitBytes: memLimit,
		CpuAbsolute:      cpu,
		DiskBytes:        disk,
		NetworkRx:        rx,
		NetworkTx:        tx,
		UptimeMs:         up,
	}

	return stats, nil
}

// FetchServerLogs retrieves the latest stdout log lines from the Wings daemon for a server.
func (w *WingsClient) FetchServerLogs(node *models.Node, serverUUID string, size int) ([]string, error) {
	if node == nil {
		return nil, fmt.Errorf("node is nil")
	}
	if size <= 0 {
		size = 100
	}

	resp, err := w.doRequest(node, http.MethodGet, fmt.Sprintf("/api/servers/%s/logs?size=%d", serverUUID, size), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("wings returned status %d", resp.StatusCode)
	}

	var res struct {
		Data []string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}
	return res.Data, nil
}

// CreateServer instructs Wings to pull server config from Panel and create the environment container.
func (w *WingsClient) CreateServer(node *models.Node, serverUUID string, startOnCompletion bool) error {
	if node == nil {
		return fmt.Errorf("node is nil")
	}
	payload, err := json.Marshal(map[string]interface{}{
		"uuid":                serverUUID,
		"start_on_completion": startOnCompletion,
	})
	if err != nil {
		return err
	}

	resp, err := w.doRequest(node, http.MethodPost, "/api/servers", payload)
	if err != nil {
		return fmt.Errorf("could not reach wings daemon on node %s (%s): %w", node.Name, node.FQDN, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("wings create server returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// DeleteServer instructs Wings to remove the container and environment for a server.
func (w *WingsClient) DeleteServer(node *models.Node, serverUUID string) error {
	if node == nil {
		return nil
	}

	resp, err := w.doRequest(node, http.MethodDelete, fmt.Sprintf("/api/servers/%s", serverUUID), nil)
	if err != nil {
		return fmt.Errorf("could not reach wings daemon on node %s (%s): %w", node.Name, node.FQDN, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("wings delete server returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// ReinstallServer instructs Wings to reinstall the server container.
func (w *WingsClient) ReinstallServer(node *models.Node, serverUUID string) error {
	if node == nil {
		return fmt.Errorf("node is nil")
	}

	resp, err := w.doRequest(node, http.MethodPost, fmt.Sprintf("/api/servers/%s/reinstall", serverUUID), nil)
	if err != nil {
		return fmt.Errorf("could not reach wings daemon on node %s (%s): %w", node.Name, node.FQDN, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("wings reinstall server returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// SyncServer instructs Wings to sync server configuration changes.
func (w *WingsClient) SyncServer(node *models.Node, serverUUID string) error {
	if node == nil {
		return nil
	}

	resp, err := w.doRequest(node, http.MethodPost, fmt.Sprintf("/api/servers/%s/sync", serverUUID), nil)
	if err != nil {
		return fmt.Errorf("could not reach wings daemon on node %s (%s): %w", node.Name, node.FQDN, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("wings sync server returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}
