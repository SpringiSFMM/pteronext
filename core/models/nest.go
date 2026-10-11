package models

import (
	"time"

	"gorm.io/gorm"
)

// Nest represents a top-level grouping of game or application server templates (eggs).
type Nest struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"type:varchar(191);not null" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	Slug        string         `gorm:"type:varchar(191);uniqueIndex;not null" json:"slug"`
	Eggs        []Egg          `gorm:"foreignKey:NestID;constraint:OnDelete:CASCADE" json:"eggs,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
