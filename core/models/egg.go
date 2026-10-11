package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// DockerImages represents a mapping of friendly image names/descriptions to Docker image tags.
type DockerImages map[string]string

func (d DockerImages) Value() (driver.Value, error) {
	if d == nil {
		return "{}", nil
	}
	b, err := json.Marshal(d)
	return string(b), err
}

func (d *DockerImages) Scan(src interface{}) error {
	if src == nil {
		*d = make(DockerImages)
		return nil
	}
	var data []byte
	switch s := src.(type) {
	case string:
		data = []byte(s)
	case []byte:
		data = s
	default:
		return fmt.Errorf("unsupported type for DockerImages: %T", src)
	}
	if len(data) == 0 {
		*d = make(DockerImages)
		return nil
	}
	return json.Unmarshal(data, d)
}

func (d *DockerImages) UnmarshalJSON(b []byte) error {
	if len(b) == 0 || string(b) == "null" {
		*d = make(DockerImages)
		return nil
	}
	// Try standard map[string]string
	var m map[string]string
	if err := json.Unmarshal(b, &m); err == nil {
		*d = m
		return nil
	}
	// Try slice of string tags (PTDL_v1 format)
	var list []string
	if err := json.Unmarshal(b, &list); err == nil {
		res := make(DockerImages, len(list))
		for _, img := range list {
			res[img] = img
		}
		*d = res
		return nil
	}
	// Try single string
	var single string
	if err := json.Unmarshal(b, &single); err == nil && single != "" {
		*d = DockerImages{single: single}
		return nil
	}
	*d = make(DockerImages)
	return nil
}

// JSONMap represents a generic key-value map stored as a JSON string in SQLite.
type JSONMap map[string]interface{}

func (m JSONMap) Value() (driver.Value, error) {
	if m == nil {
		return "{}", nil
	}
	b, err := json.Marshal(m)
	return string(b), err
}

func (m *JSONMap) Scan(src interface{}) error {
	if src == nil {
		*m = make(JSONMap)
		return nil
	}
	var data []byte
	switch s := src.(type) {
	case string:
		data = []byte(s)
	case []byte:
		data = s
	default:
		return fmt.Errorf("unsupported type for JSONMap: %T", src)
	}
	if len(data) == 0 {
		*m = make(JSONMap)
		return nil
	}
	return json.Unmarshal(data, m)
}

func (m *JSONMap) UnmarshalJSON(b []byte) error {
	if len(b) == 0 || string(b) == "null" {
		*m = make(JSONMap)
		return nil
	}
	// If incoming JSON is an escaped JSON string (common in PTDL export files), unescape and parse
	if b[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		if s == "" || s == "{}" {
			*m = make(JSONMap)
			return nil
		}
		var temp map[string]interface{}
		if err := json.Unmarshal([]byte(s), &temp); err != nil {
			*m = JSONMap{"raw": s}
			return nil
		}
		*m = temp
		return nil
	}
	var temp map[string]interface{}
	if err := json.Unmarshal(b, &temp); err != nil {
		*m = make(JSONMap)
		return nil
	}
	*m = temp
	return nil
}

// EggVariable represents a customizable configuration environment variable for an Egg.
type EggVariable struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	EnvVariable  string `json:"env_variable"`
	DefaultValue string `json:"default_value"`
	UserViewable bool   `json:"user_viewable"`
	UserEditable bool   `json:"user_editable"`
	Rules        string `json:"rules"`
	FieldType    string `json:"field_type,omitempty"`
}

// EggVariables represents a slice of EggVariable stored as a JSON array string in SQLite.
type EggVariables []EggVariable

func (v EggVariables) Value() (driver.Value, error) {
	if v == nil {
		return "[]", nil
	}
	b, err := json.Marshal(v)
	return string(b), err
}

func (v *EggVariables) Scan(src interface{}) error {
	if src == nil {
		*v = []EggVariable{}
		return nil
	}
	var data []byte
	switch s := src.(type) {
	case string:
		data = []byte(s)
	case []byte:
		data = s
	default:
		return fmt.Errorf("unsupported type for EggVariables: %T", src)
	}
	if len(data) == 0 {
		*v = []EggVariable{}
		return nil
	}
	return json.Unmarshal(data, v)
}

func (v *EggVariables) UnmarshalJSON(b []byte) error {
	if len(b) == 0 || string(b) == "null" {
		*v = []EggVariable{}
		return nil
	}
	if b[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		if s == "" || s == "[]" {
			*v = []EggVariable{}
			return nil
		}
		var list []EggVariable
		if err := json.Unmarshal([]byte(s), &list); err != nil {
			*v = []EggVariable{}
			return nil
		}
		*v = list
		return nil
	}
	var list []EggVariable
	if err := json.Unmarshal(b, &list); err != nil {
		*v = []EggVariable{}
		return nil
	}
	*v = list
	return nil
}

// Egg represents a server configuration template providing scripts, startup commands, docker images, and variables.
type Egg struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	NestID          uint           `gorm:"index;not null" json:"nest_id"`
	Nest            *Nest          `gorm:"foreignKey:NestID" json:"nest,omitempty"`
	Name            string         `gorm:"type:varchar(191);not null" json:"name"`
	Description     string         `gorm:"type:text" json:"description"`
	DockerImages    DockerImages   `gorm:"type:text" json:"docker_images"`
	StartupCommand  string         `gorm:"type:text;not null" json:"startup_command"`
	ConfigFiles     JSONMap        `gorm:"type:text" json:"config_files"`
	ConfigStartup   JSONMap        `gorm:"type:text" json:"config_startup"`
	ConfigStop      string         `gorm:"type:varchar(255)" json:"config_stop"`
	ScriptInstall   string         `gorm:"type:text" json:"script_install"`
	ScriptContainer string         `gorm:"type:varchar(255)" json:"script_container"`
	ScriptEntry     string         `gorm:"type:varchar(255)" json:"script_entry"`
	Variables       EggVariables   `gorm:"type:text" json:"variables"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// PTDLEggImport provides a deserialization model for Pterodactyl export formats (PTDL_v1, PTDL_v2).
type PTDLEggImport struct {
	Meta struct {
		Version string `json:"version"`
	} `json:"meta"`
	NestID          uint              `json:"nest_id,omitempty"`
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	DockerImages    DockerImages      `json:"docker_images"`
	Images          []string          `json:"images"`
	Image           string            `json:"image"`
	Startup         string            `json:"startup"`
	StartupCommand  string            `json:"startup_command"`
	Config          struct {
		Files   JSONMap `json:"files"`
		Startup JSONMap `json:"startup"`
		Stop    string  `json:"stop"`
	} `json:"config"`
	ConfigFiles     JSONMap           `json:"config_files"`
	ConfigStartup   JSONMap           `json:"config_startup"`
	ConfigStop      string            `json:"config_stop"`
	Scripts         struct {
		Installation struct {
			Script     string `json:"script"`
			Container  string `json:"container"`
			Entrypoint string `json:"entrypoint"`
		} `json:"installation"`
	} `json:"scripts"`
	ScriptInstall   string            `json:"script_install"`
	ScriptContainer string            `json:"script_container"`
	ScriptEntry     string            `json:"script_entry"`
	Variables       EggVariables      `json:"variables"`
}

// ToEgg converts a parsed PTDLEggImport struct into a canonical Egg model.
func (p *PTDLEggImport) ToEgg() *Egg {
	egg := &Egg{
		NestID:      p.NestID,
		Name:        p.Name,
		Description: p.Description,
	}

	// Startup command
	if p.StartupCommand != "" {
		egg.StartupCommand = p.StartupCommand
	} else {
		egg.StartupCommand = p.Startup
	}

	// Docker images
	egg.DockerImages = make(DockerImages)
	if len(p.DockerImages) > 0 {
		for k, v := range p.DockerImages {
			egg.DockerImages[k] = v
		}
	} else if len(p.Images) > 0 {
		for _, img := range p.Images {
			egg.DockerImages[img] = img
		}
	} else if p.Image != "" {
		egg.DockerImages[p.Image] = p.Image
	}

	// Config
	if len(p.ConfigFiles) > 0 {
		egg.ConfigFiles = p.ConfigFiles
	} else if len(p.Config.Files) > 0 {
		egg.ConfigFiles = p.Config.Files
	} else {
		egg.ConfigFiles = make(JSONMap)
	}

	if len(p.ConfigStartup) > 0 {
		egg.ConfigStartup = p.ConfigStartup
	} else if len(p.Config.Startup) > 0 {
		egg.ConfigStartup = p.Config.Startup
	} else {
		egg.ConfigStartup = make(JSONMap)
	}

	if p.ConfigStop != "" {
		egg.ConfigStop = p.ConfigStop
	} else {
		egg.ConfigStop = p.Config.Stop
	}

	// Scripts
	if p.ScriptInstall != "" {
		egg.ScriptInstall = p.ScriptInstall
	} else {
		egg.ScriptInstall = p.Scripts.Installation.Script
	}

	if p.ScriptContainer != "" {
		egg.ScriptContainer = p.ScriptContainer
	} else {
		egg.ScriptContainer = p.Scripts.Installation.Container
	}

	if p.ScriptEntry != "" {
		egg.ScriptEntry = p.ScriptEntry
	} else {
		egg.ScriptEntry = p.Scripts.Installation.Entrypoint
	}

	// Variables
	if p.Variables != nil {
		egg.Variables = p.Variables
	} else {
		egg.Variables = make(EggVariables, 0)
	}

	return egg
}
