package security

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidHash         = errors.New("invalid or unsupported password hash format")
	ErrIncompatibleVersion = errors.New("incompatible argon2 version")
	ErrPasswordMismatch    = errors.New("password does not match hash")
)

// HashAlgorithm represents the preferred password hashing scheme.
type HashAlgorithm string

const (
	AlgorithmArgon2id HashAlgorithm = "argon2id"
	AlgorithmBcrypt   HashAlgorithm = "bcrypt"
)

// Argon2idParams holds parameters for Argon2id key derivation.
type Argon2idParams struct {
	Memory      uint32 // in KiB (e.g. 64 * 1024 = 65536)
	Iterations  uint32 // number of passes
	Parallelism uint8  // number of threads
	SaltLength  uint32 // in bytes (recommended 16)
	KeyLength   uint32 // output key length in bytes (recommended 32)
}

// DefaultArgon2idParams returns OWASP-recommended parameters for server-side hashing.
func DefaultArgon2idParams() Argon2idParams {
	return Argon2idParams{
		Memory:      64 * 1024, // 64 MB
		Iterations:  3,
		Parallelism: 2,
		SaltLength:  16,
		KeyLength:   32,
	}
}

// FastArgon2idParams returns lighter parameters suitable for high-speed testing.
func FastArgon2idParams() Argon2idParams {
	return Argon2idParams{
		Memory:      16 * 1024, // 16 MB
		Iterations:  1,
		Parallelism: 1,
		SaltLength:  16,
		KeyLength:   32,
	}
}

// PasswordManager provides unified hashing, verification, and rehash detection
// supporting both Argon2id and bcrypt.
type PasswordManager struct {
	preferredAlgorithm HashAlgorithm
	argonParams        Argon2idParams
	bcryptCost         int
}

// NewPasswordManager creates a new password manager with default settings (Argon2id).
func NewPasswordManager() *PasswordManager {
	return &PasswordManager{
		preferredAlgorithm: AlgorithmArgon2id,
		argonParams:        DefaultArgon2idParams(),
		bcryptCost:         bcrypt.DefaultCost,
	}
}

// NewPasswordManagerWithOptions creates a custom configured password manager.
func NewPasswordManagerWithOptions(algo HashAlgorithm, argonParams Argon2idParams, bcryptCost int) *PasswordManager {
	if bcryptCost <= 0 {
		bcryptCost = bcrypt.DefaultCost
	}
	return &PasswordManager{
		preferredAlgorithm: algo,
		argonParams:        argonParams,
		bcryptCost:         bcryptCost,
	}
}

// HashPassword hashes a plaintext password using the preferred algorithm.
func (pm *PasswordManager) HashPassword(password string) (string, error) {
	switch pm.preferredAlgorithm {
	case AlgorithmArgon2id:
		return pm.HashArgon2id(password)
	case AlgorithmBcrypt:
		return pm.HashBcrypt(password)
	default:
		return pm.HashArgon2id(password)
	}
}

// HashArgon2id hashes a password with Argon2id and returns the PHC string format.
// Format: $argon2id$v=19$m=65536,t=3,p=2$<salt-b64>$<hash-b64>
func (pm *PasswordManager) HashArgon2id(password string) (string, error) {
	salt, err := GenerateRandomBytes(int(pm.argonParams.SaltLength))
	if err != nil {
		return "", fmt.Errorf("failed to generate random salt: %w", err)
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		pm.argonParams.Iterations,
		pm.argonParams.Memory,
		pm.argonParams.Parallelism,
		pm.argonParams.KeyLength,
	)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	encoded := fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		pm.argonParams.Memory,
		pm.argonParams.Iterations,
		pm.argonParams.Parallelism,
		b64Salt,
		b64Hash,
	)

	return encoded, nil
}

// HashBcrypt hashes a password using bcrypt with the configured cost.
func (pm *PasswordManager) HashBcrypt(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), pm.bcryptCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password with bcrypt: %w", err)
	}
	return string(bytes), nil
}

// VerifyPassword verifies a plaintext password against an encoded hash.
// Automatically determines whether the hash is Argon2id or bcrypt.
func (pm *PasswordManager) VerifyPassword(password, encodedHash string) (bool, error) {
	if strings.HasPrefix(encodedHash, "$argon2id$") {
		return pm.verifyArgon2id(password, encodedHash)
	}
	if strings.HasPrefix(encodedHash, "$2a$") ||
		strings.HasPrefix(encodedHash, "$2b$") ||
		strings.HasPrefix(encodedHash, "$2y$") {
		return pm.verifyBcrypt(password, encodedHash)
	}
	return false, ErrInvalidHash
}

func (pm *PasswordManager) verifyArgon2id(password, encodedHash string) (bool, error) {
	parts := strings.Split(encodedHash, "$")
	// Format is: "" , "argon2id" , "v=19" , "m=...,t=...,p=..." , "<salt>" , "<hash>"
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, ErrInvalidHash
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return false, ErrInvalidHash
	}
	if version != argon2.Version {
		return false, ErrIncompatibleVersion
	}

	var memory, iterations uint32
	var parallelism uint8
	params := strings.Split(parts[3], ",")
	if len(params) != 3 {
		return false, ErrInvalidHash
	}

	for _, param := range params {
		kv := strings.Split(param, "=")
		if len(kv) != 2 {
			return false, ErrInvalidHash
		}
		switch kv[0] {
		case "m":
			m, err := strconv.ParseUint(kv[1], 10, 32)
			if err != nil {
				return false, ErrInvalidHash
			}
			memory = uint32(m)
		case "t":
			t, err := strconv.ParseUint(kv[1], 10, 32)
			if err != nil {
				return false, ErrInvalidHash
			}
			iterations = uint32(t)
		case "p":
			p, err := strconv.ParseUint(kv[1], 10, 8)
			if err != nil {
				return false, ErrInvalidHash
			}
			parallelism = uint8(p)
		default:
			return false, ErrInvalidHash
		}
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, fmt.Errorf("failed to decode salt: %w", err)
	}

	expectedHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, fmt.Errorf("failed to decode hash: %w", err)
	}

	computedHash := argon2.IDKey(
		[]byte(password),
		salt,
		iterations,
		memory,
		parallelism,
		uint32(len(expectedHash)),
	)

	if subtle.ConstantTimeCompare(computedHash, expectedHash) == 1 {
		return true, nil
	}

	return false, nil
}

func (pm *PasswordManager) verifyBcrypt(password, encodedHash string) (bool, error) {
	err := bcrypt.CompareHashAndPassword([]byte(encodedHash), []byte(password))
	if err == nil {
		return true, nil
	}
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		return false, nil
	}
	return false, err
}

// NeedsRehash checks if a hash should be re-calculated (e.g. upgraded from bcrypt to Argon2id,
// or if Argon2id parameters were upgraded).
func (pm *PasswordManager) NeedsRehash(encodedHash string) bool {
	if pm.preferredAlgorithm == AlgorithmArgon2id {
		// If current preference is Argon2id but hash is bcrypt, rehash needed
		if !strings.HasPrefix(encodedHash, "$argon2id$") {
			return true
		}
		// If Argon2id parameters changed
		parts := strings.Split(encodedHash, "$")
		if len(parts) == 6 {
			expectedParams := fmt.Sprintf("m=%d,t=%d,p=%d",
				pm.argonParams.Memory, pm.argonParams.Iterations, pm.argonParams.Parallelism)
			if parts[3] != expectedParams {
				return true
			}
		}
		return false
	}

	if pm.preferredAlgorithm == AlgorithmBcrypt {
		if !strings.HasPrefix(encodedHash, "$2") {
			return true
		}
		cost, err := bcrypt.Cost([]byte(encodedHash))
		if err == nil && cost < pm.bcryptCost {
			return true
		}
	}

	return false
}

// --- Cryptographic Token Generation & Verification ---

// GenerateRandomBytes returns n cryptographically secure random bytes.
func GenerateRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		return nil, fmt.Errorf("crypto/rand error: %w", err)
	}
	return b, nil
}

// GenerateRandomHex returns a hex-encoded cryptographically secure random string.
func GenerateRandomHex(byteCount int) (string, error) {
	bytes, err := GenerateRandomBytes(byteCount)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// GenerateRandomBase64 returns a URL-safe unpadded base64 random string.
func GenerateRandomBase64(byteCount int) (string, error) {
	bytes, err := GenerateRandomBytes(byteCount)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// GenerateToken generates an API or session token with an optional prefix.
// E.g. prefix="ptero_usr_" -> "ptero_usr_x8YgK2..."
func GenerateToken(prefix string, byteCount int) (string, error) {
	if byteCount <= 0 {
		byteCount = 32
	}
	randStr, err := GenerateRandomBase64(byteCount)
	if err != nil {
		return "", err
	}
	return prefix + randStr, nil
}

// DaemonTokenPair represents a node daemon token pair (<token_id>.<token_secret>).
type DaemonTokenPair struct {
	ID        string `json:"id"`
	Secret    string `json:"secret"`
	FullToken string `json:"full_token"`
}

// GenerateDaemonTokenPair generates a Wings daemon compatible token pair.
func GenerateDaemonTokenPair() (*DaemonTokenPair, error) {
	id, err := GenerateRandomHex(8) // 16 hex chars
	if err != nil {
		return nil, err
	}
	secret, err := GenerateRandomBase64(32) // 43 chars url-safe
	if err != nil {
		return nil, err
	}
	return &DaemonTokenPair{
		ID:        id,
		Secret:    secret,
		FullToken: fmt.Sprintf("%s.%s", id, secret),
	}, nil
}

// HashTokenSHA256 returns the hex-encoded SHA-256 hash of a token.
// Useful for fast indexing in databases while never storing plaintext tokens.
func HashTokenSHA256(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// VerifyTokenSHA256 verifies a token against a stored SHA-256 hex hash in constant time.
func VerifyTokenSHA256(token, storedHashHex string) bool {
	computed := HashTokenSHA256(token)
	return subtle.ConstantTimeCompare([]byte(computed), []byte(storedHashHex)) == 1
}

// ConstantTimeCompareString performs constant-time comparison of two strings.
func ConstantTimeCompareString(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
