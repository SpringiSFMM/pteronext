package models

import "time"

// SystemSetting represents a persistent key-value configuration in the panel database.
type SystemSetting struct {
	Key       string    `gorm:"primaryKey;type:varchar(191)" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

// DiscordLinkVerification stores pending Discord bot DM verification codes.
type DiscordLinkVerification struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	UserID          uint      `gorm:"index" json:"user_id"`
	DiscordID       string    `gorm:"type:varchar(64)" json:"discord_id"`
	DiscordUsername string    `gorm:"type:varchar(128)" json:"discord_username"`
	Code            string    `gorm:"type:varchar(16)" json:"code"`
	DMChannelID     string    `gorm:"type:varchar(64)" json:"dm_channel_id"`
	Attempts        int       `gorm:"default:0" json:"attempts"`
	Language        string    `gorm:"type:varchar(8);default:'de'" json:"language"`
	ExpiresAt       time.Time `json:"expires_at"`
	CreatedAt       time.Time `json:"created_at"`
}

