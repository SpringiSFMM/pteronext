package database

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// NestDefinition defines metadata for standard Pterodactyl nests.
type NestDefinition struct {
	Name        string
	Description string
	Slug        string
}

var defaultNestDefinitions = map[string]NestDefinition{
	"minecraft": {
		Name:        "Minecraft",
		Description: "Minecraft - the smash hit game from Mojang, with support for Vanilla, Paper, Forge, Sponge, and BungeeCord.",
		Slug:        "minecraft",
	},
	"rust": {
		Name:        "Rust",
		Description: "Rust is a multiplayer-only survival video game developed by Facepunch Studios.",
		Slug:        "rust",
	},
	"source-engine": {
		Name:        "Source Engine",
		Description: "Valve Source Engine dedicated server games such as CS:GO, Team Fortress 2, and Garry's Mod.",
		Slug:        "source-engine",
	},
	"voice-servers": {
		Name:        "Voice Servers",
		Description: "Voice communication software including TeamSpeak 3 and Mumble.",
		Slug:        "voice-servers",
	},
}

// FindEggsDirectory resolves the absolute or relative location of the seed eggs folder.
func FindEggsDirectory() string {
	candidates := []string{
		os.Getenv("PTERONEXT_EGGS_PATH"),
		"/opt/pteronext/eggs",
		"/var/lib/pteronext/eggs",
		"./eggs",
		"eggs",
		"/Users/springi_sfm/panel/database/Seeders/eggs",
		"../database/Seeders/eggs",
		"../../database/Seeders/eggs",
		"database/Seeders/eggs",
	}

	for _, c := range candidates {
		if c == "" {
			continue
		}
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			abs, err := filepath.Abs(c)
			if err == nil {
				return abs
			}
			return c
		}
	}
	return ""
}

// LoadOfficialEggs loads all official Pterodactyl eggs from disk into the database.
func LoadOfficialEggs(db *gorm.DB) error {
	dir := FindEggsDirectory()
	if dir == "" {
		log.Printf("[WARN] Official eggs directory not found. Skipping auto-seeding of eggs.")
		return nil
	}

	return LoadOfficialEggsFromDir(db, dir)
}

// LoadOfficialEggsFromDir scans the given root directory and imports all egg JSON files into their respective nests.
func LoadOfficialEggsFromDir(db *gorm.DB, rootDir string) error {
	log.Printf("[DB] Scanning official eggs from: %s", rootDir)

	entries, err := os.ReadDir(rootDir)
	if err != nil {
		return fmt.Errorf("failed reading egg root directory %s: %w", rootDir, err)
	}

	var loadedCount int
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		folderSlug := strings.ToLower(entry.Name())
		nestDef, exists := defaultNestDefinitions[folderSlug]
		if !exists {
			// Generate fallback nest definition
			friendlyName := strings.Title(strings.ReplaceAll(folderSlug, "-", " "))
			nestDef = NestDefinition{
				Name:        friendlyName,
				Description: friendlyName + " game and application templates.",
				Slug:        folderSlug,
			}
		}

		// Find or create Nest
		var nest models.Nest
		if err := db.Where("slug = ?", nestDef.Slug).First(&nest).Error; err != nil {
			nest = models.Nest{
				Name:        nestDef.Name,
				Description: nestDef.Description,
				Slug:        nestDef.Slug,
			}
			if err := db.Create(&nest).Error; err != nil {
				return fmt.Errorf("failed creating nest %s: %w", nestDef.Slug, err)
			}
			log.Printf("[DB] Created nest: '%s' (%s)", nest.Name, nest.Slug)
		}

		// Read egg JSON files in this nest directory
		subDirPath := filepath.Join(rootDir, entry.Name())
		eggFiles, err := os.ReadDir(subDirPath)
		if err != nil {
			log.Printf("[WARN] Could not read nest folder %s: %v", subDirPath, err)
			continue
		}

		for _, eggFile := range eggFiles {
			if eggFile.IsDir() || !strings.HasSuffix(strings.ToLower(eggFile.Name()), ".json") {
				continue
			}

			fullPath := filepath.Join(subDirPath, eggFile.Name())
			content, err := os.ReadFile(fullPath)
			if err != nil {
				log.Printf("[WARN] Failed reading egg file %s: %v", fullPath, err)
				continue
			}

			var importDTO models.PTDLEggImport
			if err := json.Unmarshal(content, &importDTO); err != nil {
				log.Printf("[WARN] Failed parsing egg JSON %s: %v", fullPath, err)
				continue
			}

			egg := importDTO.ToEgg()
			egg.NestID = nest.ID

			// Upsert egg: find existing by NestID and Name
			var existing models.Egg
			if err := db.Where("nest_id = ? AND name = ?", nest.ID, egg.Name).First(&existing).Error; err != nil {
				if err := db.Create(egg).Error; err != nil {
					log.Printf("[WARN] Failed inserting egg '%s': %v", egg.Name, err)
					continue
				}
				log.Printf("[DB] Loaded egg '%s' into nest '%s' (Variables: %d)", egg.Name, nest.Name, len(egg.Variables))
				loadedCount++
			} else {
				// Update existing egg with latest seed definition
				egg.ID = existing.ID
				egg.CreatedAt = existing.CreatedAt
				if err := db.Save(egg).Error; err != nil {
					log.Printf("[WARN] Failed updating egg '%s': %v", egg.Name, err)
					continue
				}
				loadedCount++
			}
		}
	}

	log.Printf("[DB] Successfully seeded/verified %d official egg templates.", loadedCount)
	return nil
}
