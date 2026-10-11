package tests

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/pkg/security"
)

func TestAccountEndpoints(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// 1. Unauthenticated requests to account endpoints must return 401 Unauthorized
	unauthEndpoints := []struct {
		method string
		path   string
	}{
		{"POST", "/api/account/2fa/setup"},
		{"POST", "/api/account/2fa/enable"},
		{"POST", "/api/account/2fa/disable"},
		{"PUT", "/api/account/password"},
		{"PUT", "/api/account/profile"},
		{"GET", "/api/account/activity"},
	}

	for _, ep := range unauthEndpoints {
		w := env.performRequest(ep.method, ep.path, nil, nil)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401 Unauthorized for unauth %s %s, got %d", ep.method, ep.path, w.Code)
		}
	}

	// 2. Register and login a test user
	regResp := env.performRequest("POST", "/api/auth/register", map[string]string{
		"username":   "accounttestuser",
		"email":      "accountuser@example.com",
		"password":   "originalpass123",
		"name_first": "Original",
		"name_last":  "User",
	}, nil)
	if regResp.Code != http.StatusCreated {
		t.Fatalf("Failed registering user: %s", regResp.Body.String())
	}

	var regData struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(regResp.Body.Bytes(), &regData)
	token := regData.Token
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	// 3. Test PUT /api/account/profile
	profResp := env.performRequest("PUT", "/api/account/profile", map[string]string{
		"email":      "updateduser@example.com",
		"name_first": "UpdatedFirst",
		"name_last":  "UpdatedLast",
	}, headers)
	if profResp.Code != http.StatusOK {
		t.Fatalf("Expected 200 for update profile, got %d: %s", profResp.Code, profResp.Body.String())
	}

	var profData struct {
		User struct {
			Email     string `json:"email"`
			NameFirst string `json:"name_first"`
			NameLast  string `json:"name_last"`
		} `json:"user"`
	}
	_ = json.Unmarshal(profResp.Body.Bytes(), &profData)
	if profData.User.Email != "updateduser@example.com" {
		t.Errorf("Expected email to be updated, got %s", profData.User.Email)
	}
	if profData.User.NameFirst != "UpdatedFirst" || profData.User.NameLast != "UpdatedLast" {
		t.Errorf("Expected names to be updated, got %s %s", profData.User.NameFirst, profData.User.NameLast)
	}

	// 4. Test PUT /api/account/password (Incorrect current password -> 400)
	badPassResp := env.performRequest("PUT", "/api/account/password", map[string]string{
		"current_password": "wrongpassword",
		"new_password":     "newsuperpassword123",
	}, headers)
	if badPassResp.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for incorrect current password, got %d", badPassResp.Code)
	}

	// 5. Test PUT /api/account/password (Update to new password with Argon2id)
	goodPassResp := env.performRequest("PUT", "/api/account/password", map[string]string{
		"current_password": "originalpass123",
		"new_password":     "newsuperpassword123",
		"algorithm":        "argon2id",
	}, headers)
	if goodPassResp.Code != http.StatusOK {
		t.Fatalf("Expected 200 for password update, got %d: %s", goodPassResp.Code, goodPassResp.Body.String())
	}

	// Verify login with new password works
	loginNewResp := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "accounttestuser",
		"password": "newsuperpassword123",
	}, nil)
	if loginNewResp.Code != http.StatusOK {
		t.Fatalf("Expected login to succeed with new password, got %d: %s", loginNewResp.Code, loginNewResp.Body.String())
	}

	// 6. Test POST /api/account/2fa/setup
	setupResp := env.performRequest("POST", "/api/account/2fa/setup", nil, headers)
	if setupResp.Code != http.StatusOK {
		t.Fatalf("Expected 200 for 2FA setup, got %d: %s", setupResp.Code, setupResp.Body.String())
	}

	var setupData struct {
		Secret     string `json:"secret"`
		OtpauthURL string `json:"otpauth_url"`
		QRCode     string `json:"qr_code"`
	}
	_ = json.Unmarshal(setupResp.Body.Bytes(), &setupData)
	if setupData.Secret == "" {
		t.Fatal("Expected secret in 2FA setup response")
	}
	if setupData.OtpauthURL == "" {
		t.Fatal("Expected otpauth_url in 2FA setup response")
	}
	if setupData.QRCode == "" {
		t.Fatal("Expected qr_code data URL in 2FA setup response")
	}

	// 7. Test POST /api/account/2fa/enable (Bad TOTP code -> 400)
	badEnableResp := env.performRequest("POST", "/api/account/2fa/enable", map[string]string{
		"secret": setupData.Secret,
		"code":   "000000",
	}, headers)
	if badEnableResp.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for invalid TOTP code, got %d", badEnableResp.Code)
	}

	// Generate valid TOTP code
	totpHelper := security.NewTOTPHelper("PteroNext")
	validCode, err := totpHelper.GenerateCodeAtTime(setupData.Secret, time.Now().UTC())
	if err != nil {
		t.Fatalf("Failed generating TOTP code: %v", err)
	}

	// Enable 2FA with valid TOTP code
	goodEnableResp := env.performRequest("POST", "/api/account/2fa/enable", map[string]string{
		"secret": setupData.Secret,
		"code":   validCode,
	}, headers)
	if goodEnableResp.Code != http.StatusOK {
		t.Fatalf("Expected 200 for valid 2FA enable, got %d: %s", goodEnableResp.Code, goodEnableResp.Body.String())
	}

	var enableData struct {
		TwoFactorEnabled bool     `json:"two_factor_enabled"`
		BackupCodes      []string `json:"backup_codes"`
	}
	_ = json.Unmarshal(goodEnableResp.Body.Bytes(), &enableData)
	if !enableData.TwoFactorEnabled {
		t.Error("Expected two_factor_enabled to be true")
	}
	if len(enableData.BackupCodes) == 0 {
		t.Error("Expected backup codes to be returned")
	}

	// Verify database record has two_factor_enabled = true
	var dbUser models.User
	env.db.Where("username = ?", "accounttestuser").First(&dbUser)
	if !dbUser.TwoFactorEnabled {
		t.Error("Expected user.TwoFactorEnabled in database to be true")
	}

	// 8. Test Login with 2FA required
	// 8a. Login without TOTP code -> 200 with two_factor_required: true
	loginNo2FAResp := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "accounttestuser",
		"password": "newsuperpassword123",
	}, nil)
	var no2FAData map[string]interface{}
	_ = json.Unmarshal(loginNo2FAResp.Body.Bytes(), &no2FAData)
	if no2FAData["two_factor_required"] != true {
		t.Errorf("Expected two_factor_required: true when logging in without 2FA code, got %v", no2FAData)
	}

	// 8b. Login with valid TOTP code -> 200 OK
	currentCode, _ := totpHelper.GenerateCodeAtTime(setupData.Secret, time.Now().UTC())
	loginWith2FAResp := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "accounttestuser",
		"password": "newsuperpassword123",
		"code":     currentCode,
	}, nil)
	if loginWith2FAResp.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK when logging in with valid TOTP code, got %d: %s", loginWith2FAResp.Code, loginWith2FAResp.Body.String())
	}

	// 9. Test POST /api/account/2fa/disable with TOTP code
	disableCode, _ := totpHelper.GenerateCodeAtTime(setupData.Secret, time.Now().UTC())
	disableResp := env.performRequest("POST", "/api/account/2fa/disable", map[string]string{
		"code": disableCode,
	}, headers)
	if disableResp.Code != http.StatusOK {
		t.Fatalf("Expected 200 for 2FA disable with TOTP code, got %d: %s", disableResp.Code, disableResp.Body.String())
	}

	// Verify 2FA is disabled on user
	env.db.Where("username = ?", "accounttestuser").First(&dbUser)
	if dbUser.TwoFactorEnabled {
		t.Error("Expected user.TwoFactorEnabled to be false after disabling")
	}

	// 10. Enable 2FA again, then test disable with password
	setupResp2 := env.performRequest("POST", "/api/account/2fa/setup", nil, headers)
	var setupData2 struct {
		Secret string `json:"secret"`
	}
	_ = json.Unmarshal(setupResp2.Body.Bytes(), &setupData2)
	code2, _ := totpHelper.GenerateCodeAtTime(setupData2.Secret, time.Now().UTC())
	env.performRequest("POST", "/api/account/2fa/enable", map[string]string{
		"secret": setupData2.Secret,
		"code":   code2,
	}, headers)

	// Disable using password
	disablePassResp := env.performRequest("POST", "/api/account/2fa/disable", map[string]string{
		"password": "newsuperpassword123",
	}, headers)
	if disablePassResp.Code != http.StatusOK {
		t.Fatalf("Expected 200 for 2FA disable with password, got %d: %s", disablePassResp.Code, disablePassResp.Body.String())
	}

	// 11. Test GET /api/account/activity
	actResp := env.performRequest("GET", "/api/account/activity", nil, headers)
	if actResp.Code != http.StatusOK {
		t.Fatalf("Expected 200 for activity logs, got %d: %s", actResp.Code, actResp.Body.String())
	}

	var actData struct {
		Data  []models.AuditLog `json:"data"`
		Total int64             `json:"total"`
	}
	_ = json.Unmarshal(actResp.Body.Bytes(), &actData)
	if actData.Total == 0 || len(actData.Data) == 0 {
		t.Error("Expected non-empty activity logs for user")
	}
}
