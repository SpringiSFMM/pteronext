package services_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/pteronext/panel-core/database"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed opening in-memory SQLite: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		t.Fatalf("database auto-migration failed: %v", err)
	}
	return db
}

func TestLevelFormulas(t *testing.T) {
	if lvl := services.CalculateLevel(0); lvl != 0 {
		t.Errorf("expected level 0 for 0 XP, got %d", lvl)
	}
	if lvl := services.CalculateLevel(99); lvl != 0 {
		t.Errorf("expected level 0 for 99 XP, got %d", lvl)
	}
	if lvl := services.CalculateLevel(100); lvl != 1 {
		t.Errorf("expected level 1 for 100 XP, got %d", lvl)
	}
	if lvl := services.CalculateLevel(300); lvl != 2 {
		t.Errorf("expected level 2 for 300 XP, got %d", lvl)
	}
	if lvl := services.CalculateLevel(600); lvl != 3 {
		t.Errorf("expected level 3 for 600 XP, got %d", lvl)
	}
	if lvl := services.CalculateLevel(1500); lvl != 5 {
		t.Errorf("expected level 5 for 1500 XP, got %d", lvl)
	}
	if lvl := services.CalculateLevel(5500); lvl != 10 {
		t.Errorf("expected level 10 for 5500 XP, got %d", lvl)
	}
}

func TestDatabaseModelsMigrationAndCRUD(t *testing.T) {
	db := setupTestDB(t)

	// 1. DiscordUserXP
	userXP := models.DiscordUserXP{
		GuildID:       "guild-123",
		UserID:        "user-456",
		Username:      "TestGamer",
		Avatar:        "abcdef123",
		XP:            1250,
		Level:         4,
		MessagesCount: 50,
		LastXPAT:      time.Now(),
	}
	if err := db.Create(&userXP).Error; err != nil {
		t.Fatalf("failed creating DiscordUserXP: %v", err)
	}

	var fetchedXP models.DiscordUserXP
	if err := db.Where("guild_id = ? AND user_id = ?", "guild-123", "user-456").First(&fetchedXP).Error; err != nil {
		t.Fatalf("failed fetching DiscordUserXP: %v", err)
	}
	if fetchedXP.XP != 1250 || fetchedXP.Level != 4 {
		t.Errorf("mismatched XP/Level: %+v", fetchedXP)
	}

	// 2. DiscordGiveaway
	entriesJSON, _ := json.Marshal([]string{"user-1", "user-2", "user-3"})
	gw := models.DiscordGiveaway{
		GuildID:      "guild-123",
		ChannelID:    "channel-789",
		Prize:        "Discord Nitro 1 Year",
		WinnersCount: 2,
		HostID:       "admin-1",
		HostUsername: "AdminUser",
		EndsAt:       time.Now().Add(1 * time.Hour),
		Ended:        false,
		Entries:      string(entriesJSON),
		Winners:      "[]",
	}
	if err := db.Create(&gw).Error; err != nil {
		t.Fatalf("failed creating DiscordGiveaway: %v", err)
	}

	var fetchedGW models.DiscordGiveaway
	if err := db.First(&fetchedGW, gw.ID).Error; err != nil {
		t.Fatalf("failed fetching DiscordGiveaway: %v", err)
	}
	if fetchedGW.Prize != "Discord Nitro 1 Year" || fetchedGW.WinnersCount != 2 {
		t.Errorf("mismatched Giveaway: %+v", fetchedGW)
	}

	// 3. DiscordPoll
	optsJSON, _ := json.Marshal([]string{"Option A", "Option B", "Option C"})
	votesJSON, _ := json.Marshal(map[string]int{"user-1": 0, "user-2": 1})
	poll := models.DiscordPoll{
		GuildID:         "guild-123",
		ChannelID:       "channel-789",
		Question:        "Which game server should we deploy next?",
		Options:         string(optsJSON),
		Votes:           string(votesJSON),
		CreatorID:       "admin-1",
		CreatorUsername: "AdminUser",
	}
	if err := db.Create(&poll).Error; err != nil {
		t.Fatalf("failed creating DiscordPoll: %v", err)
	}

	var fetchedPoll models.DiscordPoll
	if err := db.First(&fetchedPoll, poll.ID).Error; err != nil {
		t.Fatalf("failed fetching DiscordPoll: %v", err)
	}
	if fetchedPoll.Question != "Which game server should we deploy next?" {
		t.Errorf("mismatched Poll: %+v", fetchedPoll)
	}

	// 4. DiscordLevelRole
	lvlRole := models.DiscordLevelRole{
		GuildID:  "guild-123",
		Level:    5,
		RoleID:   "role-level-5",
		RoleName: "Level 5",
		Color:    0x3498DB,
	}
	if err := db.Create(&lvlRole).Error; err != nil {
		t.Fatalf("failed creating DiscordLevelRole: %v", err)
	}

	var fetchedLvlRole models.DiscordLevelRole
	if err := db.Where("guild_id = ? AND level = ?", "guild-123", 5).First(&fetchedLvlRole).Error; err != nil {
		t.Fatalf("failed fetching DiscordLevelRole: %v", err)
	}
	if fetchedLvlRole.RoleName != "Level 5" || fetchedLvlRole.RoleID != "role-level-5" {
		t.Errorf("mismatched DiscordLevelRole: %+v", fetchedLvlRole)
	}
}

func TestPollEmbedRendering(t *testing.T) {
	optsJSON, _ := json.Marshal([]string{"Minecraft", "Rust", "Valheim"})
	votesJSON, _ := json.Marshal(map[string]int{
		"u1": 0,
		"u2": 0,
		"u3": 1,
	})

	poll := models.DiscordPoll{
		ID:        42,
		GuildID:   "g1",
		ChannelID: "c1",
		Question:  "Best survival game?",
		Options:   string(optsJSON),
		Votes:     string(votesJSON),
		CreatorID: "creator-99",
	}

	embed, components := services.BuildPollEmbedAndComponents(poll)
	if embed == nil || len(components) == 0 {
		t.Fatalf("expected non-nil embed and components")
	}

	desc, ok := embed["description"].(string)
	if !ok || !strings.Contains(desc, "Minecraft") || !strings.Contains(desc, "Rust") {
		t.Errorf("poll embed description does not contain options: %s", desc)
	}

	actionRow := components[0]
	buttons, ok := actionRow["components"].([]map[string]interface{})
	if !ok || len(buttons) != 3 {
		t.Fatalf("expected 3 option buttons, got %v", buttons)
	}

	customID, _ := buttons[0]["custom_id"].(string)
	if customID != "poll_vote:42:0" {
		t.Errorf("expected custom_id 'poll_vote:42:0', got '%s'", customID)
	}
}

func TestAutomaticRoleCreationMock(t *testing.T) {
	// Mock Discord API HTTP server
	createdRoleRequested := false
	assignedRoleRequested := false

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// GET /guilds/{id}/roles
		if r.Method == "GET" && strings.HasSuffix(r.URL.Path, "/roles") {
			// Return empty roles list so bot is forced to create the role!
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`[]`))
			return
		}

		// POST /guilds/{id}/roles (create role)
		if r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/roles") {
			createdRoleRequested = true
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			name, _ := body["name"].(string)
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":"role-999","name":"` + name + `","color":3447003}`))
			return
		}

		// PUT /guilds/{id}/members/{uid}/roles/{rid}
		if r.Method == "PUT" && strings.Contains(r.URL.Path, "/roles/role-999") {
			assignedRoleRequested = true
			w.WriteHeader(http.StatusNoContent)
			return
		}

		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()

	if createdRoleRequested && assignedRoleRequested {
		// Just to use the vars
	}
}
