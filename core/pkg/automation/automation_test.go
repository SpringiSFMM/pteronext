package automation_test

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pteronext/panel-core/pkg/automation"
)

func TestCronEvaluator_ValidationAndNextRun(t *testing.T) {
	eval := automation.NewCronEvaluator()

	tests := []struct {
		name    string
		expr    string
		wantErr bool
	}{
		{"every 5 minutes", "*/5 * * * *", false},
		{"at midnight", "0 0 * * *", false},
		{"weekdays at 4am", "0 4 * * 1-5", false},
		{"descriptor daily", "@daily", false},
		{"descriptor hourly", "@hourly", false},
		{"invalid empty", "", true},
		{"invalid tokens", "not a cron", true},
		{"invalid out of range minute", "61 * * * *", true},
		{"invalid 6 fields for standard parser", "* * * * * *", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := eval.Validate(tt.expr)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Validate(%q) err = %v, wantErr = %v", tt.expr, err, tt.wantErr)
			}

			if !tt.wantErr {
				ref := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
				next, err := eval.NextRun(tt.expr, ref)
				if err != nil {
					t.Fatalf("NextRun(%q) failed: %v", tt.expr, err)
				}
				if !next.After(ref) {
					t.Fatalf("NextRun(%q) returned %v, expected after %v", tt.expr, next, ref)
				}
			}
		})
	}
}

func TestVisualCron_DecomposeAndCompose(t *testing.T) {
	eval := automation.NewCronEvaluator()

	expr := "15 2 1 * 5"
	visual, err := eval.Decompose(expr)
	if err != nil {
		t.Fatalf("Decompose(%q) failed: %v", expr, err)
	}

	if visual.Minute != "15" || visual.Hour != "2" || visual.DayOfMonth != "1" || visual.Month != "*" || visual.DayOfWeek != "5" {
		t.Fatalf("Unexpected decomposed fields: %+v", visual)
	}

	composed, err := eval.Compose(visual)
	if err != nil {
		t.Fatalf("Compose() failed: %v", err)
	}

	if composed != expr {
		t.Fatalf("Compose() = %q, want %q", composed, expr)
	}

	desc := eval.Describe("*/5 * * * *")
	if !strings.Contains(desc, "Every 5 minutes") {
		t.Fatalf("Describe() = %q, expected 'Every 5 minutes'", desc)
	}
}

func TestActionPipeline_SequenceExecution(t *testing.T) {
	ctx := context.Background()
	mockExec := automation.NewMockServerExecutor()
	store := automation.NewMemoryHistoryStore()
	pipeline := automation.NewPipelineExecutor(mockExec, store)

	schedule := &automation.Schedule{
		ID:       "sched-1",
		ServerID: "srv-alpha",
		Name:     "Maintenance Routine",
		CronExpr: "0 4 * * *",
		Steps: []automation.ActionStep{
			{
				ID:         "step-1",
				Sequence:   1,
				Action:     automation.ActionCommand,
				Payload:    "say Server reboot in 10s",
				TimeOffset: 0,
			},
			{
				ID:       "step-2",
				Sequence: 2,
				Action:   automation.ActionSleep,
				Payload:  "50ms",
			},
			{
				ID:       "step-3",
				Sequence: 3,
				Action:   automation.ActionPower,
				Payload:  "restart",
			},
			{
				ID:       "step-4",
				Sequence: 4,
				Action:   automation.ActionBackup,
				Payload:  "*.log\ncache/*",
			},
		},
	}

	log, err := pipeline.Execute(ctx, schedule, automation.TriggerManual)
	if err != nil {
		t.Fatalf("Execute() unexpected error: %v", err)
	}

	if log.Status != automation.StatusCompleted {
		t.Fatalf("Expected StatusCompleted, got %v", log.Status)
	}
	if log.ExitStatus != 0 {
		t.Fatalf("Expected ExitStatus 0, got %d", log.ExitStatus)
	}
	if len(log.StepResults) != 4 {
		t.Fatalf("Expected 4 step results, got %d", len(log.StepResults))
	}

	// Verify command sent
	if len(mockExec.CommandsSent) != 1 || !strings.Contains(mockExec.CommandsSent[0], "say Server reboot") {
		t.Fatalf("CommandsSent mismatch: %v", mockExec.CommandsSent)
	}
	// Verify power action
	if len(mockExec.PowerActions) != 1 || mockExec.PowerActions[0] != automation.PowerRestart {
		t.Fatalf("PowerActions mismatch: %v", mockExec.PowerActions)
	}
	// Verify backup made
	if len(mockExec.BackupsMade) != 1 {
		t.Fatalf("Expected 1 backup, got %d", len(mockExec.BackupsMade))
	}
	ignored := mockExec.BackupsMade[0]
	if len(ignored) != 2 || ignored[0] != "*.log" || ignored[1] != "cache/*" {
		t.Fatalf("Unexpected ignored files: %v", ignored)
	}

	// Verify log in store
	fetched, err := store.Get(ctx, log.ID)
	if err != nil {
		t.Fatalf("store.Get(%q) failed: %v", log.ID, err)
	}
	if fetched.Duration <= 0 {
		t.Fatalf("Expected non-zero duration, got %v", fetched.Duration)
	}
}

func TestActionPipeline_FailureAndContinuePolicy(t *testing.T) {
	ctx := context.Background()

	t.Run("HaltOnFailure", func(t *testing.T) {
		mockExec := automation.NewMockServerExecutor()
		mockExec.CommandError = errors.New("daemon connection timeout")
		store := automation.NewMemoryHistoryStore()
		pipeline := automation.NewPipelineExecutor(mockExec, store)

		schedule := &automation.Schedule{
			ID:       "sched-fail-1",
			ServerID: "srv-fail",
			Steps: []automation.ActionStep{
				{
					ID:                "step-1",
					Sequence:          1,
					Action:            automation.ActionCommand,
					Payload:           "save-all",
					ContinueOnFailure: false, // Should halt
				},
				{
					ID:       "step-2",
					Sequence: 2,
					Action:   automation.ActionPower,
					Payload:  "restart",
				},
			},
		}

		log, err := pipeline.Execute(ctx, schedule, automation.TriggerCron)
		if err == nil {
			t.Fatalf("Expected pipeline execution to return error")
		}
		if log.Status != automation.StatusFailed {
			t.Fatalf("Expected StatusFailed, got %v", log.Status)
		}
		if log.ExitStatus != 1 {
			t.Fatalf("Expected ExitStatus 1, got %d", log.ExitStatus)
		}
		if len(log.StepResults) != 1 {
			t.Fatalf("Expected pipeline to stop at step 1, but ran %d steps", len(log.StepResults))
		}
		if log.StepResults[0].Status != automation.StatusFailed {
			t.Fatalf("Expected step 1 to have StatusFailed, got %v", log.StepResults[0].Status)
		}
	})

	t.Run("ContinueOnFailure", func(t *testing.T) {
		mockExec := automation.NewMockServerExecutor()
		mockExec.CommandError = errors.New("command failed")
		store := automation.NewMemoryHistoryStore()
		pipeline := automation.NewPipelineExecutor(mockExec, store)

		schedule := &automation.Schedule{
			ID:       "sched-cont-1",
			ServerID: "srv-cont",
			Steps: []automation.ActionStep{
				{
					ID:                "step-1",
					Sequence:          1,
					Action:            automation.ActionCommand,
					Payload:           "save-all",
					ContinueOnFailure: true, // Should continue
				},
				{
					ID:       "step-2",
					Sequence: 2,
					Action:   automation.ActionPower,
					Payload:  "restart",
				},
			},
		}

		log, err := pipeline.Execute(ctx, schedule, automation.TriggerManual)
		if err != nil {
			t.Fatalf("Execute() returned error despite ContinueOnFailure: %v", err)
		}
		if log.Status != automation.StatusPartialFailure {
			t.Fatalf("Expected StatusPartialFailure, got %v", log.Status)
		}
		if len(log.StepResults) != 2 {
			t.Fatalf("Expected 2 steps executed, got %d", len(log.StepResults))
		}
		if log.StepResults[0].Status != automation.StatusFailed {
			t.Fatalf("Step 1 should be failed")
		}
		if log.StepResults[1].Status != automation.StatusCompleted {
			t.Fatalf("Step 2 should be completed")
		}
	})
}

func TestActionPipeline_OnlyWhenOnlinePolicy(t *testing.T) {
	ctx := context.Background()
	mockExec := automation.NewMockServerExecutor()
	mockExec.SetServerOnline("srv-offline", false)
	store := automation.NewMemoryHistoryStore()
	pipeline := automation.NewPipelineExecutor(mockExec, store)

	schedule := &automation.Schedule{
		ID:             "sched-online-check",
		ServerID:       "srv-offline",
		OnlyWhenOnline: true,
		Steps: []automation.ActionStep{
			{
				ID:       "step-1",
				Sequence: 1,
				Action:   automation.ActionCommand,
				Payload:  "broadcast hi",
			},
		},
	}

	log, err := pipeline.Execute(ctx, schedule, automation.TriggerCron)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if log.Status != automation.StatusCancelled {
		t.Fatalf("Expected StatusCancelled when server offline, got %v", log.Status)
	}
	if len(mockExec.CommandsSent) != 0 {
		t.Fatalf("No commands should have been sent to offline server")
	}
}

func TestEngine_ConcurrencyAndTrigger(t *testing.T) {
	ctx := context.Background()
	mockExec := automation.NewMockServerExecutor()
	store := automation.NewMemoryHistoryStore()
	eng := automation.NewEngine(automation.Config{CheckInterval: 50 * time.Millisecond}, mockExec, store)

	sched := &automation.Schedule{
		ID:       "sched-engine-1",
		ServerID: "srv-eng",
		Name:     "Long running task",
		CronExpr: "*/5 * * * *",
		IsActive: true,
		Steps: []automation.ActionStep{
			{
				ID:       "step-1",
				Sequence: 1,
				Action:   automation.ActionSleep,
				Payload:  "100ms",
			},
		},
	}

	err := eng.AddSchedule(sched)
	if err != nil {
		t.Fatalf("AddSchedule() failed: %v", err)
	}

	// Trigger concurrently to verify locking
	var wg sync.WaitGroup
	var errLock error
	var lockOnce sync.Once

	wg.Add(2)
	go func() {
		defer wg.Done()
		_, _ = eng.Trigger(ctx, sched.ID)
	}()

	go func() {
		defer wg.Done()
		time.Sleep(10 * time.Millisecond) // Let first one acquire lock
		_, err := eng.Trigger(ctx, sched.ID)
		if err != nil {
			lockOnce.Do(func() {
				errLock = err
			})
		}
	}()

	wg.Wait()

	if errLock == nil || !strings.Contains(errLock.Error(), "already running") {
		t.Fatalf("Expected schedule overlap prevention error, got: %v", errLock)
	}

	// Verify history stored
	logs, total, err := store.ListBySchedule(ctx, sched.ID, 10, 0)
	if err != nil {
		t.Fatalf("ListBySchedule failed: %v", err)
	}
	if total < 1 || len(logs) < 1 {
		t.Fatalf("Expected at least 1 log recorded, got %d", total)
	}
}
