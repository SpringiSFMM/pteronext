package controllers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetInstalledVersion(t *testing.T) {
	// Test environment variable override
	os.Setenv("PTERONEXT_VERSION", "v2.9.5")
	if v := GetInstalledVersion(); v != "v2.9.5" {
		t.Fatalf("expected v2.9.5, got %s", v)
	}

	os.Setenv("PTERONEXT_VERSION", "2.9.5")
	if v := GetInstalledVersion(); v != "v2.9.5" {
		t.Fatalf("expected v2.9.5 with 'v' prefix added, got %s", v)
	}

	os.Unsetenv("PTERONEXT_VERSION")
	// From VERSION file (created in root)
	v := GetInstalledVersion()
	if v != "v2.9.3" {
		t.Fatalf("expected v2.9.3 from VERSION file or fallback, got %s", v)
	}
}

func TestIsVersionGreater(t *testing.T) {
	cases := []struct {
		v1       string
		v2       string
		expected bool
	}{
		{"v2.9.0", "v2.8.8", true},
		{"v2.8.8", "v2.9.0", false},
		{"v2.9.0", "v2.9.0", false},
		{"v2.9.1", "v2.9.0", true},
		{"v3.0.0", "v2.9.9", true},
		{"v1.14.0", "v2.8.8", false},
		{"2.9.0", "2.8.8", true},
	}

	for _, tc := range cases {
		actual := isVersionGreater(tc.v1, tc.v2)
		if actual != tc.expected {
			t.Errorf("isVersionGreater(%s, %s): expected %v, got %v", tc.v1, tc.v2, tc.expected, actual)
		}
	}
}

func TestCheckUpdateEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	controller := NewSystemUpdateController()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	controller.CheckUpdate(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	currentVer, ok := response["current_version"].(string)
	if !ok || currentVer != "v2.9.3" {
		t.Fatalf("expected current_version to be 'v2.9.3', got %v", response["current_version"])
	}

	// Because GitHub latest tag is v2.8.8 and installed is v2.9.3, update_available must be false
	updateAvail, ok := response["update_available"].(bool)
	if !ok || updateAvail != false {
		t.Fatalf("expected update_available to be false for v2.9.3 >= v2.8.8, got %v", response["update_available"])
	}
}
