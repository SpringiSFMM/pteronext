package database

import (
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// SeedDatabase inserts initial roles, default admin user, default node, allocation and demo server.
func SeedDatabase(db *gorm.DB) error {
	var userCount int64
	db.Model(&models.User{}).Count(&userCount)
	if userCount > 0 {
		// Already seeded
		return nil
	}

	log.Printf("[DB] Seeding initial database data...")

	// 1. Roles & Permissions
	adminRole := models.Role{
		Name:        "Administrator",
		Description: "Full administrative access to the entire panel ecosystem",
	}
	db.FirstOrCreate(&adminRole, models.Role{Name: "Administrator"})

	memberRole := models.Role{
		Name:        "Member",
		Description: "Standard server management permissions",
	}
	db.FirstOrCreate(&memberRole, models.Role{Name: "Member"})

	permissions := []models.Permission{
		{RoleID: adminRole.ID, Resource: "*", Action: "*"},
		{RoleID: memberRole.ID, Resource: "servers", Action: "control"},
		{RoleID: memberRole.ID, Resource: "servers", Action: "console"},
		{RoleID: memberRole.ID, Resource: "servers", Action: "files"},
	}
	for _, perm := range permissions {
		db.FirstOrCreate(&perm, models.Permission{RoleID: perm.RoleID, Resource: perm.Resource, Action: perm.Action})
	}

	// 2. Default Admin User
	adminUser := models.User{
		UUID:             uuid.New().String(),
		Username:         "admin",
		Email:            "admin@pteronext.internal",
		NameFirst:        "Panel",
		NameLast:         "Admin",
		RootAdmin:        true,
		TwoFactorEnabled: false,
		RoleID:           &adminRole.ID,
	}
	if err := adminUser.SetPassword("admin123456"); err != nil {
		return err
	}
	if err := db.Create(&adminUser).Error; err != nil {
		return err
	}

	// 3. Default Node
	nodeUUID := uuid.New().String()
	node := models.Node{
		UUID:               nodeUUID,
		Name:               "Local Wings Node",
		Description:        "Default local daemon node for container execution",
		Public:             true,
		FQDN:               "wings.springisfm.de",
		Scheme:             "https",
		BehindProxy:        false,
		MaintenanceMode:    false,
		MemoryMB:           8192,
		MemoryOverallocate: 0,
		DiskMB:             51200,
		DiskOverallocate:   0,
		UploadSizeMB:       100,
		DaemonListenPort:   8080,
		DaemonSFTPPort:     2022,
		DaemonBaseDir:      "/var/lib/pterodactyl/volumes",
		DaemonTokenID:      "daemon_node_default",
		DaemonToken:        "secret_token_pteronext_wings_daemon_key",
	}
	if err := db.Create(&node).Error; err != nil {
		return err
	}

	// 4. Default Allocations
	alloc1 := models.Allocation{
		NodeID: node.ID,
		IP:     "0.0.0.0",
		Port:   25565,
		Notes:  "Primary Port",
	}
	if err := db.Create(&alloc1).Error; err != nil {
		return err
	}

	alloc2 := models.Allocation{
		NodeID: node.ID,
		IP:     "0.0.0.0",
		Port:   25566,
		Notes:  "Secondary Port",
	}
	db.Create(&alloc2)

	// 5. Official Nests & Eggs Seeding
	if err := LoadOfficialEggs(db); err != nil {
		log.Printf("[WARN] Error loading eggs in SeedDatabase: %v", err)
	}

	// 6. Default Server
	var defaultEgg models.Egg
	db.Where("name LIKE ?", "%Paper%").First(&defaultEgg)
	eggID := defaultEgg.ID
	if eggID == 0 {
		eggID = 1
	}

	now := time.Now()
	var eggIDPtr *uint
	if defaultEgg.ID != 0 {
		eggIDPtr = &defaultEgg.ID
	}

	demoServer := models.Server{
		UUID:         uuid.New().String(),
		Name:         "Survival Minecraft",
		Description:  "Production Minecraft SMP server on PaperMC",
		OwnerID:      adminUser.ID,
		NodeID:       node.ID,
		AllocationID: alloc1.ID,
		MemoryMB:     4096,
		SwapMB:       0,
		DiskMB:       20480,
		CPU:          200,
		IO:           500,
		Startup:      "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar server.jar",
		Image:        "ghcr.io/pterodactyl/yolks:java_21",
		EggID:        eggIDPtr,
		InstalledAt:  &now,
	}
	db.FirstOrCreate(&demoServer, models.Server{Name: "Survival Minecraft"})

	// 7. Default API Key for admin
	apiKey, rawKey, _ := models.GenerateNewAPIKey(adminUser.ID, models.KeyTypeAccount, "Initial Admin CLI Key", nil)
	db.Create(apiKey)

	log.Printf("[DB] Database seeded successfully.")
	log.Printf("[DB] Default Admin: %s (%s) / Password: admin123456", adminUser.Username, adminUser.Email)
	log.Printf("[DB] Default API Key: %s", rawKey)
	log.Printf("[DB] Default Node Daemon Token: %s.%s", node.DaemonTokenID, node.DaemonToken)

	return nil
}
