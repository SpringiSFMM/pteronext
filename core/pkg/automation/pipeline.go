package automation

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ActionHandler defines the function signature for executing a custom action step.
type ActionHandler func(ctx context.Context, serverID string, payload string, executor ServerExecutor) (string, error)

// ActionRegistry manages registered handlers for different action types.
type ActionRegistry struct {
	mu       sync.RWMutex
	handlers map[ActionType]ActionHandler
}

// NewActionRegistry creates an ActionRegistry initialized with default handlers.
func NewActionRegistry() *ActionRegistry {
	r := &ActionRegistry{
		handlers: make(map[ActionType]ActionHandler),
	}
	r.registerDefaults()
	return r
}

func (r *ActionRegistry) registerDefaults() {
	// Command handler
	r.Register(ActionCommand, func(ctx context.Context, serverID string, payload string, exec ServerExecutor) (string, error) {
		cmd := strings.TrimSpace(payload)
		if cmd == "" {
			return "", fmt.Errorf("command payload cannot be empty")
		}
		return exec.SendCommand(ctx, serverID, cmd)
	})

	// Sleep / Wait handler
	r.Register(ActionSleep, func(ctx context.Context, serverID string, payload string, exec ServerExecutor) (string, error) {
		duration, err := parseDuration(payload)
		if err != nil {
			return "", fmt.Errorf("invalid sleep payload %q: %w", payload, err)
		}
		select {
		case <-time.After(duration):
			return fmt.Sprintf("Waited for %s", duration), nil
		case <-ctx.Done():
			return "", ctx.Err()
		}
	})

	// Power handler
	r.Register(ActionPower, func(ctx context.Context, serverID string, payload string, exec ServerExecutor) (string, error) {
		action := PowerAction(strings.ToLower(strings.TrimSpace(payload)))
		switch action {
		case PowerStart, PowerStop, PowerRestart, PowerKill:
			err := exec.SendPowerAction(ctx, serverID, action)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("Power action %s sent successfully", action), nil
		default:
			return "", fmt.Errorf("invalid power action %q (expected start, stop, restart, or kill)", payload)
		}
	})

	// Backup handler
	r.Register(ActionBackup, func(ctx context.Context, serverID string, payload string, exec ServerExecutor) (string, error) {
		var ignoredFiles []string
		lines := strings.Split(payload, "\n")
		for _, l := range lines {
			trimmed := strings.TrimSpace(l)
			if trimmed != "" {
				ignoredFiles = append(ignoredFiles, trimmed)
			}
		}
		backupID, err := exec.CreateBackup(ctx, serverID, ignoredFiles)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("Backup initiated (ID: %s)", backupID), nil
	})
}

// Register adds or overrides a handler for a given ActionType.
func (r *ActionRegistry) Register(action ActionType, handler ActionHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[action] = handler
}

// Get retrieves the handler for an ActionType.
func (r *ActionRegistry) Get(action ActionType) (ActionHandler, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	h, ok := r.handlers[action]
	return h, ok
}

// PipelineExecutor manages running sequences of actions defined on a schedule.
type PipelineExecutor struct {
	registry     *ActionRegistry
	executor     ServerExecutor
	historyStore HistoryStore
}

// NewPipelineExecutor constructs a new PipelineExecutor.
func NewPipelineExecutor(executor ServerExecutor, historyStore HistoryStore, registry ...*ActionRegistry) *PipelineExecutor {
	reg := NewActionRegistry()
	if len(registry) > 0 && registry[0] != nil {
		reg = registry[0]
	}
	return &PipelineExecutor{
		registry:     reg,
		executor:     executor,
		historyStore: historyStore,
	}
}

// Execute runs the action pipeline for a schedule and produces an ExecutionLog.
func (p *PipelineExecutor) Execute(ctx context.Context, schedule *Schedule, trigger TriggerType) (*ExecutionLog, error) {
	now := time.Now()
	log := &ExecutionLog{
		ID:          uuid.New().String(),
		ScheduleID:  schedule.ID,
		ServerID:    schedule.ServerID,
		Trigger:     trigger,
		Status:      StatusRunning,
		StartedAt:   now,
		StepResults: make([]StepResult, 0, len(schedule.Steps)),
	}

	// Persist initial running state
	_ = p.historyStore.Save(ctx, log)

	// Check if server must be online
	if schedule.OnlyWhenOnline {
		online, err := p.executor.IsServerOnline(ctx, schedule.ServerID)
		if err != nil || !online {
			log.Status = StatusCancelled
			log.CompletedAt = time.Now()
			log.Duration = log.CompletedAt.Sub(log.StartedAt)
			log.ExitStatus = 0
			if err != nil {
				log.ErrorOutput = fmt.Sprintf("Failed to check server online state: %v", err)
			} else {
				log.ErrorOutput = "Server is offline; schedule skipped per OnlyWhenOnline policy."
			}
			_ = p.historyStore.Save(ctx, log)
			return log, nil
		}
	}

	// Sort steps by Sequence ascending
	orderedSteps := make([]ActionStep, len(schedule.Steps))
	copy(orderedSteps, schedule.Steps)
	sort.Slice(orderedSteps, func(i, j int) bool {
		return orderedSteps[i].Sequence < orderedSteps[j].Sequence
	})

	hasPartialFailure := false
	pipelineFailed := false
	var finalErr error

	for _, step := range orderedSteps {
		// Check for parent cancellation
		if err := ctx.Err(); err != nil {
			log.Status = StatusCancelled
			log.ExitStatus = 130
			log.ErrorOutput = fmt.Sprintf("Pipeline execution cancelled: %v", err)
			break
		}

		// Apply step time offset if specified
		if step.TimeOffset > 0 {
			select {
			case <-time.After(step.TimeOffset):
			case <-ctx.Done():
				log.Status = StatusCancelled
				log.ExitStatus = 130
				log.ErrorOutput = fmt.Sprintf("Pipeline cancelled during step offset: %v", ctx.Err())
				pipelineFailed = true
				break
			}
			if pipelineFailed {
				break
			}
		}

		stepStart := time.Now()
		result := StepResult{
			StepID:    step.ID,
			Sequence:  step.Sequence,
			Action:    step.Action,
			Payload:   step.Payload,
			Status:    StatusRunning,
			StartedAt: stepStart,
		}

		// Resolve handler
		handler, exists := p.registry.Get(step.Action)
		if !exists {
			result.Status = StatusFailed
			result.CompletedAt = time.Now()
			result.Duration = result.CompletedAt.Sub(stepStart)
			result.Error = fmt.Sprintf("unsupported action type %q", step.Action)
			log.StepResults = append(log.StepResults, result)

			if !step.ContinueOnFailure {
				pipelineFailed = true
				finalErr = fmt.Errorf("step %d failed: unsupported action %q", step.Sequence, step.Action)
				break
			}
			hasPartialFailure = true
			continue
		}

		// Prepare step context (with timeout if specified)
		stepCtx := ctx
		var cancel context.CancelFunc
		if step.Timeout > 0 {
			stepCtx, cancel = context.WithTimeout(ctx, step.Timeout)
		}

		output, stepErr := handler(stepCtx, schedule.ServerID, step.Payload, p.executor)
		if cancel != nil {
			cancel()
		}

		result.CompletedAt = time.Now()
		result.Duration = result.CompletedAt.Sub(stepStart)
		result.Output = output

		if stepErr != nil {
			result.Status = StatusFailed
			result.Error = stepErr.Error()
			log.StepResults = append(log.StepResults, result)

			if !step.ContinueOnFailure {
				pipelineFailed = true
				finalErr = fmt.Errorf("step %d (%s) failed: %w", step.Sequence, step.Action, stepErr)
				break
			}
			hasPartialFailure = true
		} else {
			result.Status = StatusCompleted
			log.StepResults = append(log.StepResults, result)
		}
	}

	// Finalize log
	log.CompletedAt = time.Now()
	log.Duration = log.CompletedAt.Sub(log.StartedAt)

	if log.Status != StatusCancelled {
		if pipelineFailed {
			log.Status = StatusFailed
			log.ExitStatus = 1
			if finalErr != nil {
				log.ErrorOutput = finalErr.Error()
			}
		} else if hasPartialFailure {
			log.Status = StatusPartialFailure
			log.ExitStatus = 0 // Finished all steps, but noted failures
			log.ErrorOutput = "One or more steps failed, but continued due to ContinueOnFailure policy."
		} else {
			log.Status = StatusCompleted
			log.ExitStatus = 0
		}
	}

	_ = p.historyStore.Save(ctx, log)
	return log, finalErr
}

func parseDuration(payload string) (time.Duration, error) {
	trimmed := strings.TrimSpace(payload)
	if trimmed == "" {
		return 0, fmt.Errorf("duration cannot be empty")
	}

	// Try standard Go duration string first (e.g. "10s", "2m", "500ms")
	if d, err := time.ParseDuration(trimmed); err == nil {
		return d, nil
	}

	// Try numeric seconds (e.g. "10" -> 10 seconds)
	if sec, err := strconv.Atoi(trimmed); err == nil {
		return time.Duration(sec) * time.Second, nil
	}

	return 0, fmt.Errorf("could not parse duration %q", payload)
}
