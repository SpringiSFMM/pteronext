package security_test

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/pteronext/panel-core/pkg/security"
)

func TestTOTPSetup(t *testing.T) {
	totp := security.NewTOTPHelper("PteroNext-Test")

	setup, err := totp.GenerateSetup("admin@pteronext.test", 10)
	if err != nil {
		t.Fatalf("failed to generate TOTP setup: %v", err)
	}

	if setup.Secret == "" {
		t.Errorf("expected non-empty secret")
	}

	if !strings.HasPrefix(setup.KeyURI, "otpauth://totp/") {
		t.Errorf("expected otpauth URI, got: %s", setup.KeyURI)
	}
	if !strings.Contains(setup.KeyURI, "issuer=PteroNext-Test") {
		t.Errorf("expected issuer in KeyURI, got: %s", setup.KeyURI)
	}

	// Verify QR PNG header (89 50 4E 47 0D 0A 1A 0A)
	pngHeader := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	if !bytes.HasPrefix(setup.QRCodePNG, pngHeader) {
		t.Errorf("QRCodePNG does not have valid PNG magic bytes header")
	}

	// Verify Data URL
	if !strings.HasPrefix(setup.QRCodeDataURL, "data:image/png;base64,") {
		t.Errorf("expected data URL format, got: %s", setup.QRCodeDataURL)
	}

	// Backup codes
	if len(setup.BackupCodes) != 10 {
		t.Errorf("expected 10 backup codes, got %d", len(setup.BackupCodes))
	}
	if len(setup.HashedBackupCodes) != 10 {
		t.Errorf("expected 10 hashed backup codes, got %d", len(setup.HashedBackupCodes))
	}
}

func TestTOTPVerificationAndSkew(t *testing.T) {
	totp := security.NewTOTPHelper("PteroNext-Test")

	secret := "JBSWY3DPEHPK3PXP" // Standard RFC base32 test secret
	now := time.Now().UTC()

	// Compute code for current time
	currentCode, err := totp.GenerateCodeAtTime(secret, now)
	if err != nil {
		t.Fatalf("failed to generate code at time: %v", err)
	}

	if len(currentCode) != 6 {
		t.Fatalf("expected 6 digit code, got %s", currentCode)
	}

	// Verify current code
	valid := totp.VerifyCode(secret, currentCode)
	if !valid {
		t.Errorf("expected current code to verify successfully")
	}

	// Test Skew tolerance: 30 seconds ago (previous step)
	pastTime := now.Add(-30 * time.Second)
	pastCode, _ := totp.GenerateCodeAtTime(secret, pastTime)
	validPast, stepPast := totp.VerifyCodeWithTimestamp(secret, pastCode, now, 1)
	if !validPast {
		t.Errorf("expected past code (-30s) to be accepted within 1 step skew")
	}
	if stepPast != pastTime.Unix()/30 {
		t.Errorf("expected step %d, got %d", pastTime.Unix()/30, stepPast)
	}

	// Test Skew tolerance: 30 seconds in the future (next step)
	futureTime := now.Add(30 * time.Second)
	futureCode, _ := totp.GenerateCodeAtTime(secret, futureTime)
	validFuture, _ := totp.VerifyCodeWithTimestamp(secret, futureCode, now, 1)
	if !validFuture {
		t.Errorf("expected future code (+30s) to be accepted within 1 step skew")
	}

	// Test out-of-bounds skew (e.g. 90 seconds ago with skew=1)
	tooOldTime := now.Add(-90 * time.Second)
	tooOldCode, _ := totp.GenerateCodeAtTime(secret, tooOldTime)
	validTooOld, _ := totp.VerifyCodeWithTimestamp(secret, tooOldCode, now, 1)
	if validTooOld {
		t.Errorf("expected 90s expired code to fail verification")
	}

	// Test invalid code format
	if totp.VerifyCode(secret, "00000") {
		t.Errorf("5-digit code should fail")
	}
	if totp.VerifyCode(secret, "abcdef") {
		t.Errorf("non-numeric code should fail")
	}
}

func TestBackupCodes(t *testing.T) {
	plain, hashed, err := security.GenerateBackupCodes(5, 8)
	if err != nil {
		t.Fatalf("failed to generate backup codes: %v", err)
	}

	if len(plain) != 5 || len(hashed) != 5 {
		t.Fatalf("expected 5 plain and hashed codes")
	}

	testCode := plain[2]
	// Verify matching backup code
	idx, ok := security.VerifyBackupCode(testCode, hashed)
	if !ok || idx != 2 {
		t.Errorf("expected index 2 to match, got idx=%d, ok=%v", idx, ok)
	}

	// Verify case and dash tolerance (e.g. lowercase without hyphens)
	cleanInput := strings.ToLower(strings.ReplaceAll(testCode, "-", ""))
	idx, ok = security.VerifyBackupCode(cleanInput, hashed)
	if !ok || idx != 2 {
		t.Errorf("expected case-insensitive unhyphenated code to match")
	}

	// Verify fake code fails
	_, fakeOk := security.VerifyBackupCode("ZZZZ-9999", hashed)
	if fakeOk {
		t.Errorf("expected fake code to fail")
	}

	// Simulate single-use consumption
	// Removing matched code from user's active list
	hashed = append(hashed[:idx], hashed[idx+1:]...)

	// Attempting to reuse consumed code must fail
	_, reusedOk := security.VerifyBackupCode(testCode, hashed)
	if reusedOk {
		t.Errorf("expected already consumed backup code to fail verification")
	}
}
