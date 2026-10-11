package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

type WebhookService struct {
	db     *gorm.DB
	client *http.Client
}

func NewWebhookService(db *gorm.DB) *WebhookService {
	return &WebhookService{
		db: db,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type DiscordEmbedField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline"`
}

type DiscordEmbed struct {
	Title       string              `json:"title"`
	Description string              `json:"description"`
	Color       int                 `json:"color"`
	Fields      []DiscordEmbedField `json:"fields,omitempty"`
	Timestamp   string              `json:"timestamp"`
	Footer      *struct {
		Text string `json:"text"`
	} `json:"footer,omitempty"`
}

type DiscordComponent struct {
	Type       int `json:"type"`       // 2 for button
	Style      int `json:"style"`      // 5 for link
	Label      string `json:"label"`
	URL        string `json:"url"`
}

type DiscordActionRow struct {
	Type       int                `json:"type"` // 1 for action row
	Components []DiscordComponent `json:"components"`
}

type DiscordPayload struct {
	Username   string             `json:"username"`
	AvatarURL  string             `json:"avatar_url,omitempty"`
	Embeds     []DiscordEmbed     `json:"embeds"`
	Components []DiscordActionRow `json:"components,omitempty"`
}

// TriggerEvent delivers an event notification to all registered webhooks for a server.
func (w *WebhookService) TriggerEvent(serverUUID, eventName, title, description string, fields map[string]string, actionURL string) {
	go func() {
		var server models.Server
		if err := w.db.Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
			return
		}

		var webhooks []models.Webhook
		// Match server-specific webhooks OR global webhooks (server_id IS NULL)
		err := w.db.Where("(server_id = ? OR server_id IS NULL) AND is_active = ?", server.ID, true).Find(&webhooks).Error
		if err != nil || len(webhooks) == 0 {
			return
		}

		now := time.Now()
		color := 0x10b981 // Emerald (default success)
		if strings.Contains(eventName, "crash") || strings.Contains(eventName, "fail") || strings.Contains(eventName, "stop") {
			color = 0xef4444 // Red
		} else if strings.Contains(eventName, "cpu") || strings.Contains(eventName, "warn") {
			color = 0xf59e0b // Amber
		}

		var embedFields []DiscordEmbedField
		embedFields = append(embedFields, DiscordEmbedField{
			Name:   "Server",
			Value:  server.Name,
			Inline: true,
		})
		for k, v := range fields {
			embedFields = append(embedFields, DiscordEmbedField{
				Name:   k,
				Value:  v,
				Inline: true,
			})
		}

		payload := DiscordPayload{
			Username:  "PteroNext Sentinel",
			AvatarURL: "https://panel.springisfm.de/favicon.ico",
			Embeds: []DiscordEmbed{
				{
					Title:       title,
					Description: description,
					Color:       color,
					Fields:      embedFields,
					Timestamp:   now.Format(time.RFC3339),
					Footer: &struct {
						Text string `json:"text"`
					}{
						Text: "PteroNext Cluster Automation • " + server.UUID[:8],
					},
				},
			},
		}

		if actionURL != "" {
			payload.Embeds[0].Description += fmt.Sprintf("\n\n[🔗 Open in Panel](%s)", actionURL)
		}

		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return
		}

		for _, hook := range webhooks {
			// Check if subscribed to event
			var subscribed []string
			_ = json.Unmarshal([]byte(hook.Events), &subscribed)
			isMatch := false
			for _, e := range subscribed {
				if e == "*" || e == eventName {
					isMatch = true
					break
				}
			}
			if !isMatch && len(subscribed) > 0 {
				continue
			}

			req, rErr := http.NewRequest(http.MethodPost, hook.URL, bytes.NewBuffer(bodyBytes))
			if rErr != nil {
				continue
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("User-Agent", "PteroNext-Webhook-Dispatcher/1.0")

			resp, doErr := w.client.Do(req)
			if doErr != nil {
				log.Printf("[Webhook] Failed dispatching to %s: %v", hook.Name, doErr)
				continue
			}
			resp.Body.Close()

			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				w.db.Model(&hook).Update("last_trigger", now)
				log.Printf("[Webhook] Successfully delivered event %s to %s", eventName, hook.Name)
			} else {
				log.Printf("[Webhook] Target %s responded with HTTP %d", hook.Name, resp.StatusCode)
			}
		}
	}()
}

// SendTestWebhook delivers a test ping embed to verify webhook connectivity.
func (w *WebhookService) SendTestWebhook(webhookID uint) error {
	var hook models.Webhook
	if err := w.db.First(&hook, webhookID).Error; err != nil {
		return fmt.Errorf("webhook not found: %w", err)
	}

	payload := DiscordPayload{
		Username:  "PteroNext Sentinel",
		AvatarURL: "https://panel.springisfm.de/favicon.ico",
		Embeds: []DiscordEmbed{
			{
				Title:       "🔔 Webhook Test Successful!",
				Description: "Your Discord / Slack webhook is configured properly and actively listening to cluster alerts.",
				Color:       0x10b981,
				Fields: []DiscordEmbedField{
					{Name: "Webhook Name", Value: hook.Name, Inline: true},
					{Name: "Status", Value: "Verified & Active", Inline: true},
					{Name: "Dispatched", Value: time.Now().Format("15:04:05 MST"), Inline: true},
				},
				Timestamp: time.Now().Format(time.RFC3339),
				Footer: &struct {
					Text string `json:"text"`
				}{Text: "PteroNext Automation Engine"},
			},
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, hook.URL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PteroNext-Webhook-Dispatcher/1.0")

	resp, err := w.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("remote server returned HTTP %d", resp.StatusCode)
	}

	now := time.Now()
	w.db.Model(&hook).Update("last_trigger", now)
	return nil
}
