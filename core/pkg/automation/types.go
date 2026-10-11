package automation

import (
	"fmt"
	"strings"
	"time"
)

// ActionType defines the category of action performed in a step.
type ActionType string

const (
	ActionCommand ActionType = "command"
	ActionSleep   ActionType = "sleep"
	ActionPower   ActionType = "power"
	ActionBackup  ActionType = "backup"
	ActionWebhook ActionType = "webhook"
)

// PowerAction represents valid power state changes on a server.
type PowerAction string

const (
	PowerStart   PowerAction = "start"
	PowerStop    PowerAction = "stop"
	PowerRestart PowerAction = "restart"
	PowerKill    PowerAction = "kill"
)

// ExecutionStatus represents the lifecycle state of a schedule execution or step.
type ExecutionStatus string

const (
	StatusPending        ExecutionStatus = "pending"
	StatusRunning        ExecutionStatus = "running"
	StatusCompleted      ExecutionStatus = "completed"
	StatusFailed         ExecutionStatus = "failed"
	StatusCancelled      ExecutionStatus = "cancelled"
	StatusPartialFailure ExecutionStatus = "partial_failure"
)

// TriggerType indicates how an automation execution was initiated.
type TriggerType string

const (
	TriggerCron    TriggerType = "cron"
	TriggerManual  TriggerType = "manual"
	TriggerAPI     TriggerType = "api"
	TriggerWebhook TriggerType = "webhook"
)

// VisualCron represents the decomposed visual fields of a standard 5-part cron job.
// This allows panel UI visual builders (sliders, checkboxes, dropdowns) to bind cleanly.
type VisualCron struct {
	Minute     string `json:"minute"`      // e.g. "*/5", "0", "15,45"
	Hour       string `json:"hour"`        // e.g. "*", "0", "12-14"
	DayOfMonth string `json:"day_of_month"`// e.g. "*", "1", "1,15"
	Month      string `json:"month"`       // e.g. "*", "1-12", "JAN"
	DayOfWeek  string `json:"day_of_week"` // e.g. "*", "1-5", "MON-FRI"
}

// Expression converts the VisualCron fields into a standard 5-part cron string.
func (v VisualCron) Expression() string {
	min := fallback(v.Minute, "*")
	hour := fallback(v.Hour, "*")
	dom := fallback(v.DayOfMonth, "*")
	mon := fallback(v.Month, "*")
	dow := fallback(v.DayOfWeek, "*")
	return fmt.Sprintf("%s %s %s %s %s", min, hour, dom, mon, dow)
}

func fallback(val, def string) string {
	val = strings.TrimSpace(val)
	if val == "" {
		return def
	}
	return val
}

// ActionStep defines a single sequential action inside an automation pipeline.
type ActionStep struct {
	ID                string        `json:"id"`
	ScheduleID        string        `json:"schedule_id"`
	Sequence          int           `json:"sequence"`            // 1-based order
	Action            ActionType    `json:"action"`              // command, sleep, power, backup
	Payload           string        `json:"payload"`             // command to send, sleep duration, power action, or ignored files
	TimeOffset        time.Duration `json:"time_offset"`         // wait delay before running this step
	ContinueOnFailure bool          `json:"continue_on_failure"` // if true, pipeline proceeds even if this step errors
	Timeout           time.Duration `json:"timeout"`             // optional step execution timeout
}

// StepResult captures the output and status of an individual executed step.
type StepResult struct {
	StepID      string          `json:"step_id"`
	Sequence    int             `json:"sequence"`
	Action      ActionType      `json:"action"`
	Payload     string          `json:"payload"`
	Status      ExecutionStatus `json:"status"`
	StartedAt   time.Time       `json:"started_at"`
	CompletedAt time.Time       `json:"completed_at"`
	Duration    time.Duration   `json:"duration"`
	Output      string          `json:"output,omitempty"`
	Error       string          `json:"error,omitempty"`
}

// ExecutionLog holds the comprehensive audit trail and history of a schedule run.
type ExecutionLog struct {
	ID          string          `json:"id"`
	ScheduleID  string          `json:"schedule_id"`
	ServerID    string          `json:"server_id"`
	Trigger     TriggerType     `json:"trigger"`
	Status      ExecutionStatus `json:"status"`
	StartedAt   time.Time       `json:"started_at"`
	CompletedAt time.Time       `json:"completed_at"`
	Duration    time.Duration   `json:"duration"`
	ExitStatus  int             `json:"exit_status"`  // 0 for success, non-zero for failure
	ErrorOutput string          `json:"error_output,omitempty"`
	StepResults []StepResult    `json:"step_results"`
}

// Schedule models an automation schedule configured for a game server.
type Schedule struct {
	ID              string        `json:"id"`
	ServerID        string        `json:"server_id"`
	Name            string        `json:"name"`
	CronExpr        string        `json:"cron_expr"`
	VisualFields    VisualCron    `json:"visual_fields"`
	IsActive        bool          `json:"is_active"`
	OnlyWhenOnline  bool          `json:"only_when_online"`
	Steps           []ActionStep  `json:"steps"`
	LastRunAt       *time.Time    `json:"last_run_at,omitempty"`
	NextRunAt       *time.Time    `json:"next_run_at,omitempty"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}
