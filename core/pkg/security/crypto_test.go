package security_test

import (
	"strings"
	"testing"

	"github.com/pteronext/panel-core/pkg/security"
	"golang.org/x/crypto/bcrypt"
)

func TestArgon2idHashing(t *testing.T) {
	// Use fast params for fast unit testing
	pm := security.NewPasswordManagerWithOptions(
		security.AlgorithmArgon2id,
		security.FastArgon2idParams(),
		bcrypt.MinCost,
	)

	password := "SecretSuperPteroPass123!#"

	hash, err := pm.HashArgon2id(password)
	if err != nil {
		t.Fatalf("failed to hash with Argon2id: %v", err)
	}

	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("expected $argon2id$ prefix, got: %s", hash)
	}

	// Verify correct password
	match, err := pm.VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("verification returned error: %v", err)
	}
	if !match {
		t.Errorf("expected password to match hash")
	}

	// Verify incorrect password
	match, err = pm.VerifyPassword("WrongPassword123!", hash)
	if err != nil {
		t.Fatalf("verification returned error on mismatch: %v", err)
	}
	if match {
		t.Errorf("expected wrong password to fail verification")
	}
}

func TestBcryptHashing(t *testing.T) {
	pm := security.NewPasswordManagerWithOptions(
		security.AlgorithmBcrypt,
		security.FastArgon2idParams(),
		bcrypt.MinCost,
	)

	password := "AnotherSecurePassword987!"

	hash, err := pm.HashBcrypt(password)
	if err != nil {
		t.Fatalf("failed to hash with bcrypt: %v", err)
	}

	if !strings.HasPrefix(hash, "$2a$") {
		t.Fatalf("expected $2a$ prefix, got: %s", hash)
	}

	// Verify correct password
	match, err := pm.VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("verification returned error: %v", err)
	}
	if !match {
		t.Errorf("expected password to match bcrypt hash")
	}

	// Verify wrong password
	match, err = pm.VerifyPassword("IncorrectPass", hash)
	if err != nil {
		t.Fatalf("verification returned error: %v", err)
	}
	if match {
		t.Errorf("expected wrong password to fail")
	}
}

func TestCrossAlgorithmVerificationAndRehash(t *testing.T) {
	pmArgon := security.NewPasswordManagerWithOptions(
		security.AlgorithmArgon2id,
		security.FastArgon2idParams(),
		bcrypt.MinCost,
	)

	password := "MigratedUserPassword2026$"

	// Create legacy bcrypt hash
	legacyBcryptHash, err := pmArgon.HashBcrypt(password)
	if err != nil {
		t.Fatalf("failed to generate bcrypt hash: %v", err)
	}

	// Password manager preferred algorithm is Argon2id, but verifying bcrypt hash must work seamlessly
	valid, err := pmArgon.VerifyPassword(password, legacyBcryptHash)
	if err != nil || !valid {
		t.Fatalf("failed to verify legacy bcrypt hash in argon-preferred manager: %v", err)
	}

	// NeedsRehash must indicate true so caller knows to upgrade to Argon2id
	if !pmArgon.NeedsRehash(legacyBcryptHash) {
		t.Errorf("expected legacy bcrypt hash to flag NeedsRehash = true")
	}

	// Create new Argon2id hash
	newArgonHash, err := pmArgon.HashPassword(password)
	if err != nil {
		t.Fatalf("failed to hash with preferred argon2id: %v", err)
	}

	// New hash should not need rehash
	if pmArgon.NeedsRehash(newArgonHash) {
		t.Errorf("expected new argon hash to not need rehash")
	}
}

func TestTokenGeneration(t *testing.T) {
	// Random bytes
	b, err := security.GenerateRandomBytes(16)
	if err != nil || len(b) != 16 {
		t.Fatalf("unexpected result from GenerateRandomBytes: %v", err)
	}

	// Random hex
	hexStr, err := security.GenerateRandomHex(16)
	if err != nil || len(hexStr) != 32 {
		t.Fatalf("expected 32 hex chars, got %d: %v", len(hexStr), err)
	}

	// Prefixed token
	token, err := security.GenerateToken("ptero_test_", 32)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}
	if !strings.HasPrefix(token, "ptero_test_") {
		t.Errorf("expected token to start with prefix, got: %s", token)
	}

	// Wings daemon token pair
	daemonToken, err := security.GenerateDaemonTokenPair()
	if err != nil {
		t.Fatalf("failed to generate daemon token pair: %v", err)
	}
	if daemonToken.ID == "" || daemonToken.Secret == "" {
		t.Errorf("empty ID or secret in daemon token pair")
	}
	expectedFull := daemonToken.ID + "." + daemonToken.Secret
	if daemonToken.FullToken != expectedFull {
		t.Errorf("expected full token %s, got %s", expectedFull, daemonToken.FullToken)
	}

	// Token SHA256 hashing and verification
	hash := security.HashTokenSHA256(token)
	if !security.VerifyTokenSHA256(token, hash) {
		t.Errorf("token verification failed")
	}
	if security.VerifyTokenSHA256("tampered_token", hash) {
		t.Errorf("tampered token should not verify")
	}

	// Constant time string comparison
	if !security.ConstantTimeCompareString("testString123", "testString123") {
		t.Errorf("constant time comparison failed on match")
	}
	if security.ConstantTimeCompareString("testString123", "testString456") {
		t.Errorf("constant time comparison should fail on mismatch")
	}
}
