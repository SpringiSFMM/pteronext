package models

import (
	"time"
)

// DiscordUserXP tracks chat experience points, levels, and chat activity per guild member.
type DiscordUserXP struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	GuildID       string    `gorm:"type:varchar(64);index:idx_guild_user,unique;not null" json:"guild_id"`
	UserID        string    `gorm:"type:varchar(64);index:idx_guild_user,unique;not null" json:"user_id"`
	Username      string    `gorm:"type:varchar(128)" json:"username"`
	Avatar        string    `gorm:"type:varchar(128)" json:"avatar"`
	XP            int64     `gorm:"default:0;index" json:"xp"`
	Level         int       `gorm:"default:0;index" json:"level"`
	MessagesCount int64     `gorm:"default:0" json:"messages_count"`
	LastXPAT      time.Time `json:"last_xp_at"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// DiscordGiveaway represents an interactive giveaway with timer, entry buttons, and winner selection.
type DiscordGiveaway struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	GuildID      string    `gorm:"type:varchar(64);index;not null" json:"guild_id"`
	ChannelID    string    `gorm:"type:varchar(64);not null" json:"channel_id"`
	MessageID    string    `gorm:"type:varchar(64);index" json:"message_id"`
	Prize        string    `gorm:"type:varchar(255);not null" json:"prize"`
	WinnersCount int       `gorm:"default:1" json:"winners_count"`
	HostID       string    `gorm:"type:varchar(64)" json:"host_id"`
	HostUsername string    `gorm:"type:varchar(128)" json:"host_username"`
	EndsAt       time.Time `gorm:"index;not null" json:"ends_at"`
	Ended        bool      `gorm:"default:false;index" json:"ended"`
	Entries      string    `gorm:"type:text" json:"entries"` // JSON string array of User IDs
	Winners      string    `gorm:"type:text" json:"winners"` // JSON string array of winner User IDs
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// DiscordPoll represents an interactive voting poll with buttons and live vote tally.
type DiscordPoll struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	GuildID         string    `gorm:"type:varchar(64);index;not null" json:"guild_id"`
	ChannelID       string    `gorm:"type:varchar(64);not null" json:"channel_id"`
	MessageID       string    `gorm:"type:varchar(64);index" json:"message_id"`
	Question        string    `gorm:"type:varchar(500);not null" json:"question"`
	Options         string    `gorm:"type:text;not null" json:"options"` // JSON string array of options
	Votes           string    `gorm:"type:text" json:"votes"`           // JSON object mapping UserID -> OptionIndex
	CreatorID       string    `gorm:"type:varchar(64)" json:"creator_id"`
	CreatorUsername string    `gorm:"type:varchar(128)" json:"creator_username"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// DiscordLevelRole maps a required level milestone to a Discord guild role.
type DiscordLevelRole struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	GuildID   string    `gorm:"type:varchar(64);index:idx_guild_lvl,unique;not null" json:"guild_id"`
	Level     int       `gorm:"index:idx_guild_lvl,unique;not null" json:"level"`
	RoleID    string    `gorm:"type:varchar(64);not null" json:"role_id"`
	RoleName  string    `gorm:"type:varchar(128);not null" json:"role_name"`
	Color     int       `gorm:"default:0" json:"color"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
