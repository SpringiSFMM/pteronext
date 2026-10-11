package automation

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Engine manages schedules, visual cron evaluation, background execution, and history logging.
type Engine struct {
	mu               sync.RWMutex
	schedules        map[string]*Schedule
	runningSchedules map[string]bool
	evaluator        *CronEvaluator
	pipeline         *PipelineExecutor
	historyStore     HistoryStore
	executor         ServerExecutor

	checkInterval time.Duration
	stopCh        chan struct{}
	runningWg     sync.WaitGroup
	started       bool
}

// Config provides configuration options for the Automation Engine.
type Config struct {
	CheckInterval time.Duration // Interval to evaluate cron schedules (defaults to 30s)
}

// NewEngine creates and initializes a new Automation Engine.
func NewEngine(cfg Config, executor ServerExecutor, historyStore HistoryStore) *Engine {
	interval := cfg.CheckInterval
	if interval <= 0 {
		interval = 30 * time.Second
	}

	evaluator := NewCronEvaluator()
	pipeline := NewPipelineExecutor(executor, historyStore)

	return &Engine{
		schedules:        make(map[string]*Schedule),
		runningSchedules: make(map[string]bool),
		evaluator:        evaluator,
		pipeline:         pipeline,
		historyStore:     historyStore,
		executor:         executor,
		checkInterval:    interval,
		stopCh:           make(chan struct{}),
	}
}

// Evaluator returns the CronEvaluator instance.
func (e *Engine) Evaluator() *CronEvaluator {
	return e.evaluator
}

// History returns the HistoryStore instance.
func (e *Engine) History() HistoryStore {
	return e.historyStore
}

// Pipeline returns the PipelineExecutor instance.
func (e *Engine) Pipeline() *PipelineExecutor {
	return e.pipeline
}

// AddSchedule registers a new schedule with the engine.
func (e *Engine) AddSchedule(schedule *Schedule) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if schedule.ID == "" {
		schedule.ID = uuid.New().String()
	}

	// Validate expression or compile visual fields
	if schedule.CronExpr == "" {
		compiled, err := e.evaluator.Compose(schedule.VisualFields)
		if err != nil {
			return fmt.Errorf("failed to compile visual cron fields: %w", err)
		}
		schedule.CronExpr = compiled
	} else {
		if err := e.evaluator.Validate(schedule.CronExpr); err != nil {
			return fmt.Errorf("invalid cron expression: %w", err)
		}
		// Populate visual fields if empty
		if schedule.VisualFields == (VisualCron{}) {
			visual, err := e.evaluator.Decompose(schedule.CronExpr)
			if err == nil {
				schedule.VisualFields = visual
			}
		}
	}

	now := time.Now()
	schedule.CreatedAt = now
	schedule.UpdatedAt = now

	// Calculate initial next run
	if schedule.IsActive {
		next, err := e.evaluator.NextRun(schedule.CronExpr, now)
		if err == nil {
			schedule.NextRunAt = &next
		}
	}

	// Clone to avoid external mutation
	e.schedules[schedule.ID] = cloneSchedule(schedule)
	return nil
}

// UpdateSchedule updates an existing schedule.
func (e *Engine) UpdateSchedule(schedule *Schedule) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	existing, ok := e.schedules[schedule.ID]
	if !ok {
		return fmt.Errorf("schedule with ID %q does not exist", schedule.ID)
	}

	// Validate expression
	if schedule.CronExpr == "" {
		compiled, err := e.evaluator.Compose(schedule.VisualFields)
		if err != nil {
			return fmt.Errorf("failed to compile visual cron fields: %w", err)
		}
		schedule.CronExpr = compiled
	} else {
		if err := e.evaluator.Validate(schedule.CronExpr); err != nil {
			return fmt.Errorf("invalid cron expression: %w", err)
		}
		if schedule.VisualFields == (VisualCron{}) {
			visual, err := e.evaluator.Decompose(schedule.CronExpr)
			if err == nil {
				schedule.VisualFields = visual
			}
		}
	}

	now := time.Now()
	schedule.CreatedAt = existing.CreatedAt
	schedule.UpdatedAt = now

	if schedule.IsActive {
		next, err := e.evaluator.NextRun(schedule.CronExpr, now)
		if err == nil {
			schedule.NextRunAt = &next
		}
	} else {
		schedule.NextRunAt = nil
	}

	e.schedules[schedule.ID] = cloneSchedule(schedule)
	return nil
}

// RemoveSchedule deletes a schedule from the engine.
func (e *Engine) RemoveSchedule(scheduleID string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if _, ok := e.schedules[scheduleID]; !ok {
		return fmt.Errorf("schedule %q not found", scheduleID)
	}
	delete(e.schedules, scheduleID)
	return nil
}

// GetSchedule retrieves a registered schedule by ID.
func (e *Engine) GetSchedule(scheduleID string) (*Schedule, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	s, ok := e.schedules[scheduleID]
	if !ok {
		return nil, fmt.Errorf("schedule %q not found", scheduleID)
	}
	return cloneSchedule(s), nil
}

// ListSchedules returns all registered schedules, optionally filtered by serverID.
func (e *Engine) ListSchedules(serverID ...string) []*Schedule {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var res []*Schedule
	targetServer := ""
	if len(serverID) > 0 {
		targetServer = serverID[0]
	}

	for _, s := range e.schedules {
		if targetServer == "" || s.ServerID == targetServer {
			res = append(res, cloneSchedule(s))
		}
	}
	return res
}

// IsRunning reports whether a schedule pipeline is currently executing.
func (e *Engine) IsRunning(scheduleID string) bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.runningSchedules[scheduleID]
}

// Trigger runs a schedule immediately (e.g. manual trigger or webhook).
func (e *Engine) Trigger(ctx context.Context, scheduleID string, trigger ...TriggerType) (*ExecutionLog, error) {
	trig := TriggerManual
	if len(trigger) > 0 {
		trig = trigger[0]
	}

	schedule, err := e.GetSchedule(scheduleID)
	if err != nil {
		return nil, err
	}

	// Acquire execution lock for this schedule
	if !e.acquireLock(scheduleID) {
		return nil, fmt.Errorf("schedule %q is already running", scheduleID)
	}
	defer e.releaseLock(scheduleID)

	e.runningWg.Add(1)
	defer e.runningWg.Done()

	log, err := e.pipeline.Execute(ctx, schedule, trig)

	// Update schedule run timestamps
	now := time.Now()
	e.mu.Lock()
	if s, ok := e.schedules[scheduleID]; ok {
		s.LastRunAt = &now
		if s.IsActive {
			next, nErr := e.evaluator.NextRun(s.CronExpr, now)
			if nErr == nil {
				s.NextRunAt = &next
			}
		}
	}
	e.mu.Unlock()

	return log, err
}

// Start launches the background scheduler loop.
func (e *Engine) Start(ctx context.Context) {
	e.mu.Lock()
	if e.started {
		e.mu.Unlock()
		return
	}
	e.started = true
	e.stopCh = make(chan struct{})
	e.mu.Unlock()

	go e.runLoop(ctx)
}

// Stop gracefully terminates the background loop and waits for active jobs to complete.
func (e *Engine) Stop() {
	e.mu.Lock()
	if !e.started {
		e.mu.Unlock()
		return
	}
	e.started = false
	close(e.stopCh)
	e.mu.Unlock()

	e.runningWg.Wait()
}

func (e *Engine) runLoop(ctx context.Context) {
	ticker := time.NewTicker(e.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-e.stopCh:
			return
		case now := <-ticker.C:
			e.evaluateDueSchedules(ctx, now)
		}
	}
}

func (e *Engine) evaluateDueSchedules(ctx context.Context, now time.Time) {
	e.mu.RLock()
	var dueSchedules []*Schedule
	for _, s := range e.schedules {
		if !s.IsActive {
			continue
		}
		if s.NextRunAt != nil && now.After(*s.NextRunAt) {
			dueSchedules = append(dueSchedules, cloneSchedule(s))
			continue
		}
		// Also check standard cron match
		matches, err := e.evaluator.Matches(s.CronExpr, now)
		if err == nil && matches {
			dueSchedules = append(dueSchedules, cloneSchedule(s))
		}
	}
	e.mu.RUnlock()

	for _, s := range dueSchedules {
		scheduleID := s.ID
		if e.acquireLock(scheduleID) {
			e.runningWg.Add(1)
			go func(sched *Schedule) {
				defer e.releaseLock(sched.ID)
				defer e.runningWg.Done()

				_, _ = e.pipeline.Execute(ctx, sched, TriggerCron)

				runTime := time.Now()
				e.mu.Lock()
				if existing, ok := e.schedules[sched.ID]; ok {
					existing.LastRunAt = &runTime
					next, err := e.evaluator.NextRun(existing.CronExpr, runTime)
					if err == nil {
						existing.NextRunAt = &next
					}
				}
				e.mu.Unlock()
			}(s)
		}
	}
}

func (e *Engine) acquireLock(scheduleID string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.runningSchedules[scheduleID] {
		return false
	}
	e.runningSchedules[scheduleID] = true
	return true
}

func (e *Engine) releaseLock(scheduleID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.runningSchedules, scheduleID)
}

func cloneSchedule(s *Schedule) *Schedule {
	dst := *s
	dst.Steps = make([]ActionStep, len(s.Steps))
	copy(dst.Steps, s.Steps)
	return &dst
}
