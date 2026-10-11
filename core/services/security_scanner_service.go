package services

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
)

type Threat struct {
	Rule        string `json:"rule"`
	Severity    string `json:"severity"` // "CRITICAL", "HIGH", "MEDIUM", "LOW"
	FileInJar   string `json:"file_in_jar"`
	Description string `json:"description"`
	Snippet     string `json:"snippet,omitempty"`
}

type ScanReport struct {
	FileName     string   `json:"file_name"`
	SHA256       string   `json:"sha256"`
	SizeBytes    int64    `json:"size_bytes"`
	RiskScore    int      `json:"risk_score"` // 0 to 100
	ThreatLevel  string   `json:"threat_level"` // "clean", "low", "medium", "high", "critical"
	IsSafe       bool     `json:"is_safe"`
	TotalFiles   int      `json:"total_files"`
	TotalClasses int      `json:"total_classes"`
	Threats      []Threat `json:"threats"`
	Violations   []Threat `json:"violations"`
	Summary      string   `json:"summary"`
}

type SecurityScannerService struct{}

func NewSecurityScannerService() *SecurityScannerService {
	return &SecurityScannerService{}
}

// Regex patterns for sensitive data masking in console logs & webhooks
var (
	tokenRegex    = regexp.MustCompile(`(?i)(token|password|passwd|secret|api_key|apikey|private_key|auth)\s*[=:]\s*['"]?([a-zA-Z0-9_\-\.\$]{6,})['"]?`)
	discordToken  = regexp.MustCompile(`(https?://(?:canary\.|ptb\.)?discord(?:app)?\.com/api/webhooks/\d+/)([a-zA-Z0-9_\-]{20,})`)
	bearerRegex   = regexp.MustCompile(`(?i)Bearer\s+([a-zA-Z0-9_\-\.]{16,})`)
	rconPassRegex = regexp.MustCompile(`(?i)(rcon\.password)\s*=\s*(.+)`)
)

// MaskSensitiveLog censors credentials, API keys, tokens and passwords in console text.
func (s *SecurityScannerService) MaskSensitiveLog(line string) string {
	res := discordToken.ReplaceAllString(line, `$1••••••••••••`)
	res = bearerRegex.ReplaceAllString(res, `Bearer ••••••••••••`)
	res = rconPassRegex.ReplaceAllString(res, `$1=••••••••••••`)
	res = tokenRegex.ReplaceAllStringFunc(res, func(m string) string {
		parts := strings.SplitN(m, "=", 2)
		if len(parts) == 2 {
			return parts[0] + "=••••••••••••"
		}
		parts = strings.SplitN(m, ":", 2)
		if len(parts) == 2 {
			return parts[0] + ": ••••••••••••"
		}
		return m
	})
	return res
}

// ScanJarFile scans a .jar archive on disk for backdoors, RCE, malicious webhooks, and suspicious bytecode.
func (s *SecurityScannerService) ScanJarFile(filePath string) (*ScanReport, error) {
	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("file not found: %w", err)
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed reading file: %w", err)
	}

	h := sha256.Sum256(data)
	checksum := hex.EncodeToString(h[:])

	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("invalid jar/zip archive format: %w", err)
	}

	report := &ScanReport{
		FileName:  info.Name(),
		SHA256:    checksum,
		SizeBytes: info.Size(),
		Threats:   make([]Threat, 0),
	}

	classCount := 0
	riskScore := 0

	for _, f := range zr.File {
		report.TotalFiles++
		if strings.HasSuffix(strings.ToLower(f.Name), ".class") {
			classCount++
		}

		// Inspect files under 1MB inside the archive
		if f.UncompressedSize64 > 1024*1024 {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			continue
		}
		content, _ := io.ReadAll(rc)
		_ = rc.Close()

		// 1. Check for Runtime.getRuntime().exec() or ProcessBuilder
		if bytes.Contains(content, []byte("getRuntime().exec")) || bytes.Contains(content, []byte("java/lang/Runtime;exec")) {
			riskScore += 35
			report.Threats = append(report.Threats, Threat{
				Rule:        "RCE_EXEC_FOUND",
				Severity:    "CRITICAL",
				FileInJar:   f.Name,
				Description: "Discovered native operating system execution invocation (Runtime.exec). Highly dangerous.",
				Snippet:     "Runtime.getRuntime().exec(...)",
			})
		}

		if bytes.Contains(content, []byte("java/lang/ProcessBuilder")) || bytes.Contains(content, []byte("ProcessBuilder;start")) {
			riskScore += 25
			report.Threats = append(report.Threats, Threat{
				Rule:        "PROCESS_BUILDER_SPAWN",
				Severity:    "HIGH",
				FileInJar:   f.Name,
				Description: "Spawns external operating system subprocesses via ProcessBuilder.",
			})
		}

		// 2. Outbound Discord Webhook (Token Grabber / Exfiltration)
		if bytes.Contains(content, []byte("discord.com/api/webhooks")) || bytes.Contains(content, []byte("discordapp.com/api/webhooks")) {
			riskScore += 40
			report.Threats = append(report.Threats, Threat{
				Rule:        "DISCORD_WEBHOOK_EXFILTRATION",
				Severity:    "CRITICAL",
				FileInJar:   f.Name,
				Description: "Embedded Discord webhook endpoint detected. Often used for exfiltrating server tokens or IP lists.",
			})
		}

		// 3. Force-OP backdoor pattern
		if bytes.Contains(content, []byte("setOp(true)")) || bytes.Contains(content, []byte("setOp(Z)")) {
			riskScore += 30
			report.Threats = append(report.Threats, Threat{
				Rule:        "FORCE_OP_INJECTION",
				Severity:    "HIGH",
				FileInJar:   f.Name,
				Description: "Attempts to grant operator/admin privileges unconditionally (Force-OP).",
			})
		}

		// 4. Base64 payload decoding (Obfuscated loader)
		if bytes.Contains(content, []byte("Base64;getDecoder")) && bytes.Contains(content, []byte("defineClass")) {
			riskScore += 35
			report.Threats = append(report.Threats, Threat{
				Rule:        "OBFUSCATED_CLASS_LOADER",
				Severity:    "HIGH",
				FileInJar:   f.Name,
				Description: "Dynamically decodes and loads Base64 bytecode at runtime to evade static detection.",
			})
		}
	}

	report.TotalClasses = classCount
	if riskScore > 100 {
		riskScore = 100
	}
	report.RiskScore = riskScore
	report.IsSafe = riskScore < 20

	if riskScore >= 70 {
		report.ThreatLevel = "critical"
	} else if riskScore >= 40 {
		report.ThreatLevel = "high"
	} else if riskScore >= 20 {
		report.ThreatLevel = "medium"
	} else if riskScore > 0 {
		report.ThreatLevel = "low"
	} else {
		report.ThreatLevel = "clean"
	}
	report.Violations = report.Threats

	if report.IsSafe {
		report.Summary = "No malicious backdoors or unauthorized system execution signatures detected. Archive verified."
	} else if riskScore >= 60 {
		report.Summary = "CRITICAL: High risk detected! This plugin contains signatures consistent with remote code execution or data theft."
	} else {
		report.Summary = "WARNING: Suspicious calls found. Review the reported bytecode entries before executing."
	}

	return report, nil
}
