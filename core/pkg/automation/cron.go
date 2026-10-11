package automation

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/robfig/cron/v3"
)

// StandardParser is configured for standard 5-field cron syntax:
// minute (0-59), hour (0-23), day of month (1-31), month (1-12 or JAN-DEC), day of week (0-6 or SUN-SAT).
// It also accepts descriptors like @hourly, @daily, @weekly, @monthly, @yearly.
var StandardParser = cron.NewParser(
	cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
)

// CronEvaluator handles evaluation, validation, and human-readable translation of cron expressions.
type CronEvaluator struct {
	parser cron.Parser
}

// NewCronEvaluator creates a new CronEvaluator instance.
func NewCronEvaluator() *CronEvaluator {
	return &CronEvaluator{
		parser: StandardParser,
	}
}

// Validate checks whether the given cron expression is valid according to standard 5-part cron syntax.
func (e *CronEvaluator) Validate(expr string) error {
	trimmed := strings.TrimSpace(expr)
	if trimmed == "" {
		return fmt.Errorf("cron expression cannot be empty")
	}

	_, err := e.parser.Parse(trimmed)
	if err != nil {
		return fmt.Errorf("invalid cron expression %q: %w", expr, err)
	}
	return nil
}

// NextRun calculates the next occurrence after the specified reference time.
func (e *CronEvaluator) NextRun(expr string, from time.Time) (time.Time, error) {
	schedule, err := e.parser.Parse(strings.TrimSpace(expr))
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to parse cron expression %q: %w", expr, err)
	}

	next := schedule.Next(from)
	if next.IsZero() {
		return time.Time{}, fmt.Errorf("could not compute next run time for %q from %s", expr, from.Format(time.RFC3339))
	}
	return next, nil
}

// Matches checks whether the given timestamp aligns with the cron schedule (within the same minute).
func (e *CronEvaluator) Matches(expr string, t time.Time) (bool, error) {
	schedule, err := e.parser.Parse(strings.TrimSpace(expr))
	if err != nil {
		return false, fmt.Errorf("failed to parse cron expression %q: %w", expr, err)
	}

	// Truncate to the start of the current minute
	currentMinute := t.Truncate(time.Minute)
	// Check if a run was scheduled starting 1 second prior
	prevSecond := currentMinute.Add(-time.Second)
	next := schedule.Next(prevSecond)

	return next.Truncate(time.Minute).Equal(currentMinute), nil
}

// Decompose decomposes a 5-part cron expression into VisualCron fields.
func (e *CronEvaluator) Decompose(expr string) (VisualCron, error) {
	trimmed := strings.TrimSpace(expr)
	if err := e.Validate(trimmed); err != nil {
		return VisualCron{}, err
	}

	// Handle descriptors
	switch strings.ToLower(trimmed) {
	case "@hourly":
		return VisualCron{Minute: "0", Hour: "*", DayOfMonth: "*", Month: "*", DayOfWeek: "*"}, nil
	case "@daily", "@midnight":
		return VisualCron{Minute: "0", Hour: "0", DayOfMonth: "*", Month: "*", DayOfWeek: "*"}, nil
	case "@weekly":
		return VisualCron{Minute: "0", Hour: "0", DayOfMonth: "*", Month: "*", DayOfWeek: "0"}, nil
	case "@monthly":
		return VisualCron{Minute: "0", Hour: "0", DayOfMonth: "1", Month: "*", DayOfWeek: "*"}, nil
	case "@yearly", "@annually":
		return VisualCron{Minute: "0", Hour: "0", DayOfMonth: "1", Month: "1", DayOfWeek: "*"}, nil
	}

	parts := strings.Fields(trimmed)
	if len(parts) != 5 {
		return VisualCron{}, fmt.Errorf("expression %q must have 5 fields, got %d", expr, len(parts))
	}

	return VisualCron{
		Minute:     parts[0],
		Hour:       parts[1],
		DayOfMonth: parts[2],
		Month:      parts[3],
		DayOfWeek:  parts[4],
	}, nil
}

// Compose compiles VisualCron fields into a validated standard cron expression.
func (e *CronEvaluator) Compose(v VisualCron) (string, error) {
	expr := v.Expression()
	if err := e.Validate(expr); err != nil {
		return "", fmt.Errorf("invalid visual cron configuration: %w", err)
	}
	return expr, nil
}

// Describe produces a human-friendly visual summary for common cron patterns.
func (e *CronEvaluator) Describe(expr string) string {
	trimmed := strings.TrimSpace(expr)
	switch strings.ToLower(trimmed) {
	case "* * * * *":
		return "Every minute"
	case "@hourly", "0 * * * *":
		return "Every hour at minute 0"
	case "@daily", "@midnight", "0 0 * * *":
		return "Every day at midnight (00:00)"
	case "@weekly":
		return "Every week on Sunday at midnight"
	case "@monthly":
		return "Every month on the 1st at midnight"
	}

	parts := strings.Fields(trimmed)
	if len(parts) == 5 {
		min, hour, dom, mon, dow := parts[0], parts[1], parts[2], parts[3], parts[4]

		if strings.HasPrefix(min, "*/") && hour == "*" && dom == "*" && mon == "*" && dow == "*" {
			step := strings.TrimPrefix(min, "*/")
			return fmt.Sprintf("Every %s minutes", step)
		}

		if min == "0" && strings.HasPrefix(hour, "*/") && dom == "*" && mon == "*" && dow == "*" {
			step := strings.TrimPrefix(hour, "*/")
			return fmt.Sprintf("Every %s hours", step)
		}

		if dom == "*" && mon == "*" && dow == "1-5" {
			return fmt.Sprintf("Weekdays (Monday-Friday) at %s:%s", pad(hour), pad(min))
		}

		if dom == "*" && mon == "*" && dow == "*" {
			if _, err := strconv.Atoi(hour); err == nil {
				if _, err2 := strconv.Atoi(min); err2 == nil {
					return fmt.Sprintf("Every day at %s:%s", pad(hour), pad(min))
				}
			}
		}

		if dom == "*" && mon == "*" && dow != "*" {
			dayName := formatDayOfWeek(dow)
			return fmt.Sprintf("Every %s at %s:%s", dayName, pad(hour), pad(min))
		}
	}

	return fmt.Sprintf("Custom schedule (%s)", expr)
}

func pad(val string) string {
	if len(val) == 1 {
		return "0" + val
	}
	return val
}

func formatDayOfWeek(dow string) string {
	switch strings.ToUpper(dow) {
	case "0", "7", "SUN":
		return "Sunday"
	case "1", "MON":
		return "Monday"
	case "2", "TUE":
		return "Tuesday"
	case "3", "WED":
		return "Wednesday"
	case "4", "THU":
		return "Thursday"
	case "5", "FRI":
		return "Friday"
	case "6", "SAT":
		return "Saturday"
	default:
		return "day " + dow
	}
}
