package services

import (
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

var startTime = time.Now()

// SystemStatsResponse holds telemetry data about the panel core host.
type SystemStatsResponse struct {
	UptimeSeconds        int64           `json:"uptime_seconds"`
	UptimeHuman          string          `json:"uptime_human"`
	GoVersion            string          `json:"go_version"`
	NumCPU               int             `json:"num_cpu"`
	NumGoroutine         int             `json:"num_goroutine"`
	MemoryAllocMB        float64         `json:"memory_alloc_mb"`
	MemorySysMB          float64         `json:"memory_sys_mb"`
	HostMemoryTotalMB    float64         `json:"host_memory_total_mb"`
	HostMemoryUsedMB     float64         `json:"host_memory_used_mb"`
	HostMemoryFreeMB     float64         `json:"host_memory_free_mb"`
	AllocatedServerRAMMB int64           `json:"allocated_server_ram_mb"`
	TotalNodeRAMMB       int64           `json:"total_node_ram_mb"`
	DatabaseSizeMB       float64         `json:"database_size_mb"`
	Counts               InventoryCounts `json:"counts"`
}

type InventoryCounts struct {
	Servers   int64 `json:"servers"`
	Nodes     int64 `json:"nodes"`
	Users     int64 `json:"users"`
	Databases int64 `json:"databases"`
}

// StatsService collects runtime and database statistics.
type StatsService struct {
	db     *gorm.DB
	dbPath string
}

// NewStatsService creates a new StatsService.
func NewStatsService(db *gorm.DB, dbPath string) *StatsService {
	return &StatsService{
		db:     db,
		dbPath: dbPath,
	}
}

// GetSystemStats returns performance telemetry and inventory counts.
func (s *StatsService) GetSystemStats() (*SystemStatsResponse, error) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	uptime := time.Since(startTime)

	var serverCount, nodeCount, userCount, dbCount int64
	s.db.Model(&models.Server{}).Count(&serverCount)
	s.db.Model(&models.Node{}).Count(&nodeCount)
	s.db.Model(&models.User{}).Count(&userCount)
	s.db.Model(&models.Database{}).Count(&dbCount)

	// Sum allocated RAM across servers
	var allocatedServerRAMMB int64
	s.db.Model(&models.Server{}).Select("COALESCE(SUM(memory_mb), 0)").Scan(&allocatedServerRAMMB)

	// Sum node RAM across configured nodes
	var totalNodeRAMMB int64
	s.db.Model(&models.Node{}).Select("COALESCE(SUM(memory), 0)").Scan(&totalNodeRAMMB)

	// Host memory detection via /proc/meminfo if running on Linux
	hostTotalMB, hostFreeMB, hostUsedMB := s.readHostMemory()
	if totalNodeRAMMB == 0 && hostTotalMB > 0 {
		totalNodeRAMMB = int64(hostTotalMB)
	}
	if hostTotalMB == 0 && totalNodeRAMMB > 0 {
		hostTotalMB = float64(totalNodeRAMMB)
		hostUsedMB = float64(allocatedServerRAMMB)
		hostFreeMB = hostTotalMB - hostUsedMB
	}

	var dbSizeMB float64
	if fi, err := os.Stat(s.dbPath); err == nil {
		dbSizeMB = float64(fi.Size()) / (1024 * 1024)
	}

	return &SystemStatsResponse{
		UptimeSeconds:        int64(uptime.Seconds()),
		UptimeHuman:          uptime.Round(time.Second).String(),
		GoVersion:            runtime.Version(),
		NumCPU:               runtime.NumCPU(),
		NumGoroutine:         runtime.NumGoroutine(),
		MemoryAllocMB:        float64(m.Alloc) / (1024 * 1024),
		MemorySysMB:          float64(m.Sys) / (1024 * 1024),
		HostMemoryTotalMB:    hostTotalMB,
		HostMemoryUsedMB:     hostUsedMB,
		HostMemoryFreeMB:     hostFreeMB,
		AllocatedServerRAMMB: allocatedServerRAMMB,
		TotalNodeRAMMB:       totalNodeRAMMB,
		DatabaseSizeMB:       dbSizeMB,
		Counts: InventoryCounts{
			Servers:   serverCount,
			Nodes:     nodeCount,
			Users:     userCount,
			Databases: dbCount,
		},
	}, nil
}

func (s *StatsService) readHostMemory() (totalMB, freeMB, usedMB float64) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 8192, 6144, 2048 // Graceful default fallback
	}
	var memTotalKB, memAvailableKB float64
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				fmt.Sscanf(fields[1], "%f", &memTotalKB)
			}
		} else if strings.HasPrefix(line, "MemAvailable:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				fmt.Sscanf(fields[1], "%f", &memAvailableKB)
			}
		}
	}
	if memTotalKB > 0 {
		totalMB = memTotalKB / 1024
		freeMB = memAvailableKB / 1024
		usedMB = totalMB - freeMB
		return totalMB, freeMB, usedMB
	}
	return 8192, 6144, 2048
}
