package services

import (
	"fmt"
	"strings"

	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// WingsServerSettings matches Wings daemon's exact configuration structure.
type WingsServerSettings struct {
	UUID           string                 `json:"uuid"`
	Meta           WingsMeta              `json:"meta"`
	Suspended      bool                   `json:"suspended"`
	Environment    map[string]interface{} `json:"environment"`
	Invocation     string                 `json:"invocation"`
	SkipEggScripts bool                   `json:"skip_egg_scripts"`
	Build          WingsBuild             `json:"build"`
	Container      WingsContainer         `json:"container"`
	Allocations    WingsAllocations       `json:"allocations"`
	Mounts         []WingsMount           `json:"mounts"`
	Egg            WingsEgg               `json:"egg"`
}

type WingsMeta struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type WingsBuild struct {
	MemoryLimit int64  `json:"memory_limit"`
	Swap        int64  `json:"swap"`
	IOWeight    int64  `json:"io_weight"`
	CPULimit    int64  `json:"cpu_limit"`
	Threads     string `json:"threads"`
	DiskSpace   int64  `json:"disk_space"`
	OOMDisabled bool   `json:"oom_disabled"`
}

type WingsContainer struct {
	Image           string `json:"image"`
	OOMDisabled     bool   `json:"oom_disabled"`
	RequiresRebuild bool   `json:"requires_rebuild"`
}

type WingsAllocations struct {
	ForceOutgoingIP bool                 `json:"force_outgoing_ip"`
	Default         WingsDefaultAlloc    `json:"default"`
	Mappings        map[string][]int     `json:"mappings"`
}

type WingsDefaultAlloc struct {
	IP   string `json:"ip"`
	Port int    `json:"port"`
}

type WingsMount struct {
	Source   string `json:"source"`
	Target   string `json:"target"`
	ReadOnly bool   `json:"read_only"`
}

type WingsEgg struct {
	ID           string   `json:"id"`
	FileDenylist []string `json:"file_denylist"`
}

// WingsProcessConfiguration matches Wings daemon's process management configuration.
type WingsProcessConfiguration struct {
	Startup WingsProcessStartup `json:"startup"`
	Stop    WingsProcessStop    `json:"stop"`
	Configs []interface{}       `json:"configs"`
}

type WingsProcessStartup struct {
	Done            []string `json:"done"`
	UserInteraction []string `json:"user_interaction"`
	StripAnsi       bool     `json:"strip_ansi"`
}

type WingsProcessStop struct {
	Type  string `json:"type"`  // "command" or "signal"
	Value string `json:"value"` // e.g. "stop" or "SIGINT"
}

// WingsServerData represents the complete Wings-compatible server package.
type WingsServerData struct {
	UUID                 string                    `json:"uuid"`
	Settings             WingsServerSettings       `json:"settings"`
	ProcessConfiguration WingsProcessConfiguration `json:"process_configuration"`
}

// ServerService manages server configurations and Wings schema mapping.
type ServerService struct {
	db *gorm.DB
}

// NewServerService creates a new ServerService instance.
func NewServerService(db *gorm.DB) *ServerService {
	return &ServerService{db: db}
}

// BuildWingsConfiguration transforms a Server model into Wings-compliant configuration structures.
func (s *ServerService) BuildWingsConfiguration(server *models.Server) WingsServerData {
	// Build environment map
	envMap := make(map[string]interface{})
	for _, v := range server.Variables {
		envMap[v.EnvVariable] = v.DefaultValue
	}

	// Default standard environment variables
	if server.Allocation != nil {
		envMap["SERVER_PORT"] = fmt.Sprintf("%d", server.Allocation.Port)
		envMap["SERVER_IP"] = server.Allocation.IP
	}
	envMap["SERVER_MEMORY"] = fmt.Sprintf("%d", server.MemoryMB)

	// Build allocation mappings with deduplication to prevent duplicate Docker port bindings
	mappings := make(map[string][]int)
	defaultAlloc := WingsDefaultAlloc{
		IP:   "0.0.0.0",
		Port: 25565,
	}

	seenPorts := make(map[string]map[int]bool)
	addMapping := func(ip string, port int) {
		if ip == "" {
			ip = "0.0.0.0"
		}
		if seenPorts[ip] == nil {
			seenPorts[ip] = make(map[int]bool)
		}
		if !seenPorts[ip][port] && port > 0 && port <= 65535 {
			seenPorts[ip][port] = true
			mappings[ip] = append(mappings[ip], port)
		}
	}

	if server.Allocation != nil {
		defaultAlloc.IP = server.Allocation.IP
		defaultAlloc.Port = server.Allocation.Port
		addMapping(server.Allocation.IP, server.Allocation.Port)
	}

	for _, a := range server.Allocations {
		addMapping(a.IP, a.Port)
	}

	settings := WingsServerSettings{
		UUID: server.UUID,
		Meta: WingsMeta{
			Name:        server.Name,
			Description: server.Description,
		},
		Suspended:      server.Suspended,
		Environment:    envMap,
		Invocation:     server.Startup,
		SkipEggScripts: server.SkipScripts,
		Build: WingsBuild{
			MemoryLimit: server.MemoryMB,
			Swap:        server.SwapMB,
			IOWeight:    server.IO,
			CPULimit:    server.CPU,
			Threads:     server.Threads,
			DiskSpace:   server.DiskMB,
			OOMDisabled: server.OOMDisabled,
		},
		Container: WingsContainer{
			Image:           server.Image,
			OOMDisabled:     server.OOMDisabled,
			RequiresRebuild: false,
		},
		Allocations: WingsAllocations{
			ForceOutgoingIP: false,
			Default:         defaultAlloc,
			Mappings:        mappings,
		},
		Mounts: []WingsMount{},
		Egg: WingsEgg{
			ID:           eggIDStr(server),
			FileDenylist: []string{},
		},
	}

	stopCmd := "stop"
	if server.Egg != nil && server.Egg.ConfigStop != "" {
		stopCmd = server.Egg.ConfigStop
	}

	doneTriggers := []string{
		")! For help, type ",
		"Done (",
		"Done in ",
		"server started",
		"Listening on",
		"Done!",
		"Bot is ready",
		"Logged in as",
		"ready",
		"Ready",
		"Started",
		"started",
		"online",
		"Application started",
		"regex:^(?i).*(ready|logged in as|started|listening|online|bot is ready|app listening).*",
	}
	stripAnsi := false
	if server.Egg != nil && server.Egg.ConfigStartup != nil {
		if rawDone, ok := server.Egg.ConfigStartup["done"]; ok {
			switch v := rawDone.(type) {
			case string:
				if v != "" && v != "change this part" && v != "Server marked as running" {
					doneTriggers = append(doneTriggers, v)
				}
			case []interface{}:
				for _, item := range v {
					if str, ok := item.(string); ok && str != "" && str != "change this part" && str != "Server marked as running" {
						doneTriggers = append(doneTriggers, str)
					}
				}
			case []string:
				for _, str := range v {
					if str != "" && str != "change this part" && str != "Server marked as running" {
						doneTriggers = append(doneTriggers, str)
					}
				}
			}
		}
		if rawStrip, ok := server.Egg.ConfigStartup["strip_ansi"]; ok {
			if b, ok := rawStrip.(bool); ok {
				stripAnsi = b
			}
		}
	}

	// Deduplicate triggers preserving order
	seenTrigger := make(map[string]bool)
	uniqueDoneTriggers := make([]string, 0, len(doneTriggers))
	for _, t := range doneTriggers {
		if t != "" && !seenTrigger[t] {
			seenTrigger[t] = true
			uniqueDoneTriggers = append(uniqueDoneTriggers, t)
		}
	}

	processConfig := WingsProcessConfiguration{
		Startup: WingsProcessStartup{
			Done:            uniqueDoneTriggers,
			UserInteraction: []string{},
			StripAnsi:       stripAnsi,
		},
		Stop: WingsProcessStop{
			Type:  "command",
			Value: stopCmd,
		},
		Configs: []interface{}{},
	}

	return WingsServerData{
		UUID:                 server.UUID,
		Settings:             settings,
		ProcessConfiguration: processConfig,
	}
}

func eggIDStr(server *models.Server) string {
	if server.EggID != nil {
		return fmt.Sprintf("%d", *server.EggID)
	}
	return "00000000-0000-0000-0000-000000000000"
}

// GetServerWithRelations loads a server with all related records (Node, Allocations, Variables, Owner, Nest, Egg).
func (s *ServerService) GetServerWithRelations(uuidOrID string) (*models.Server, error) {
	var server models.Server
	err := s.db.Preload("Node").
		Preload("Allocation").
		Preload("Allocations").
		Preload("Variables").
		Preload("Owner").
		Preload("Nest").
		Preload("Egg").
		Where("uuid = ? OR identifier = ?", uuidOrID, uuidOrID).
		First(&server).Error

	if err != nil {
		return nil, err
	}
	return &server, nil
}

// ResolveStartupCommand substitutes variables in startup command string.
func (s *ServerService) ResolveStartupCommand(server *models.Server) string {
	cmd := server.Startup
	cmd = strings.ReplaceAll(cmd, "{{SERVER_MEMORY}}", fmt.Sprintf("%d", server.MemoryMB))
	if server.Allocation != nil {
		cmd = strings.ReplaceAll(cmd, "{{SERVER_PORT}}", fmt.Sprintf("%d", server.Allocation.Port))
		cmd = strings.ReplaceAll(cmd, "{{SERVER_IP}}", server.Allocation.IP)
	}
	for _, v := range server.Variables {
		placeholder := fmt.Sprintf("{{%s}}", v.EnvVariable)
		cmd = strings.ReplaceAll(cmd, placeholder, v.DefaultValue)
	}
	return cmd
}
