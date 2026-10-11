package databasemgr

import (
	"fmt"
	"strconv"

	"github.com/pteronext/panel-core/models"
)

// HostFromModel converts a GORM models.DatabaseHost into a databasemgr.DatabaseHost.
func HostFromModel(m *models.DatabaseHost) *DatabaseHost {
	if m == nil {
		return nil
	}

	dbType := DatabaseTypeMySQL
	if m.Port == 5432 {
		dbType = DatabaseTypePostgres
	}

	var affinity []string
	if m.NodeID != nil {
		affinity = []string{fmt.Sprintf("%d", *m.NodeID)}
	}

	maxDB := 0
	if m.MaxDatabases != nil {
		maxDB = *m.MaxDatabases
	}

	return &DatabaseHost{
		ID:            fmt.Sprintf("%d", m.ID),
		Name:          m.Name,
		Type:          dbType,
		Host:          m.Host,
		Port:          m.Port,
		AdminUsername: m.Username,
		AdminPassword: m.Password,
		NodeAffinity:  affinity,
		MaxDatabases:  maxDB,
		IsActive:      true,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}

// HostToModel converts a databasemgr.DatabaseHost to a GORM models.DatabaseHost.
func HostToModel(h *DatabaseHost) *models.DatabaseHost {
	if h == nil {
		return nil
	}

	id, _ := strconv.ParseUint(h.ID, 10, 64)
	var nodeID *uint
	if len(h.NodeAffinity) > 0 {
		if n, err := strconv.ParseUint(h.NodeAffinity[0], 10, 64); err == nil {
			uNode := uint(n)
			nodeID = &uNode
		}
	}

	maxDB := h.MaxDatabases

	return &models.DatabaseHost{
		ID:           uint(id),
		Name:         h.Name,
		Host:         h.Host,
		Port:         h.Port,
		Username:     h.AdminUsername,
		Password:     h.AdminPassword,
		NodeID:       nodeID,
		MaxDatabases: &maxDB,
		CreatedAt:    h.CreatedAt,
		UpdatedAt:    h.UpdatedAt,
	}
}

// DatabaseFromModel converts a GORM models.Database into a databasemgr.ServerDatabase.
func DatabaseFromModel(m *models.Database) *ServerDatabase {
	if m == nil {
		return nil
	}

	var host *DatabaseHost
	if m.DatabaseHost != nil {
		host = HostFromModel(m.DatabaseHost)
	}

	return &ServerDatabase{
		ID:             fmt.Sprintf("%d", m.ID),
		ServerID:       fmt.Sprintf("%d", m.ServerID),
		DatabaseHostID: fmt.Sprintf("%d", m.DatabaseHostID),
		Host:           host,
		Database:       m.Database,
		Username:       m.Username,
		Password:       m.Password,
		Remote:         m.Remote,
		MaxConnections: m.MaxConnections,
		CreatedAt:      m.CreatedAt,
		UpdatedAt:      m.UpdatedAt,
	}
}

// DatabaseToModel converts a databasemgr.ServerDatabase to a GORM models.Database.
func DatabaseToModel(d *ServerDatabase) *models.Database {
	if d == nil {
		return nil
	}

	id, _ := strconv.ParseUint(d.ID, 10, 64)
	serverID, _ := strconv.ParseUint(d.ServerID, 10, 64)
	hostID, _ := strconv.ParseUint(d.DatabaseHostID, 10, 64)

	return &models.Database{
		ID:             uint(id),
		ServerID:       uint(serverID),
		DatabaseHostID: uint(hostID),
		Database:       d.Database,
		Username:       d.Username,
		Password:       d.Password,
		Remote:         d.Remote,
		MaxConnections: d.MaxConnections,
		CreatedAt:      d.CreatedAt,
		UpdatedAt:      d.UpdatedAt,
	}
}
