package security

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	qrcode "github.com/skip2/go-qrcode"
)

const (
	DefaultTOTPPeriod = 30 // seconds
	DefaultTOTPDigits = 6
	DefaultSecretSize = 20 // 160 bits (recommended by RFC 6238 / Google Authenticator)
)

// TOTPHelper provides RFC 6238 TOTP 2FA operations.
type TOTPHelper struct {
	issuer string
	period int
	digits int
}

// NewTOTPHelper creates a new TOTP helper for the application.
func NewTOTPHelper(issuer string) *TOTPHelper {
	if issuer == "" {
		issuer = "PteroNext"
	}
	return &TOTPHelper{
		issuer: issuer,
		period: DefaultTOTPPeriod,
		digits: DefaultTOTPDigits,
	}
}

// TOTPSetup contains all information needed to enroll a user into 2FA.
type TOTPSetup struct {
	Secret            string   `json:"secret"`              // Base32-encoded secret string
	KeyURI            string   `json:"key_uri"`             // otpauth:// URI
	QRCodePNG         []byte   `json:"-"`                   // Raw PNG image bytes
	QRCodeDataURL     string   `json:"qr_code_data_url"`    // data:image/png;base64,...
	BackupCodes       []string `json:"backup_codes"`        // Plaintext backup codes to show once
	HashedBackupCodes []string `json:"hashed_backup_codes"` // Hashed backup codes to store in DB
}

// GenerateSetup creates a new TOTP secret, provisioning URI, QR code, and backup codes for a user account.
func (th *TOTPHelper) GenerateSetup(accountName string, backupCodeCount int) (*TOTPSetup, error) {
	secretBytes, err := GenerateRandomBytes(DefaultSecretSize)
	if err != nil {
		return nil, fmt.Errorf("failed to generate secret bytes: %w", err)
	}

	secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(secretBytes)

	// Format provisioning URI
	// otpauth://totp/{issuer}:{accountName}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30
	label := fmt.Sprintf("%s:%s", th.issuer, accountName)
	v := url.Values{}
	v.Set("secret", secret)
	v.Set("issuer", th.issuer)
	v.Set("algorithm", "SHA1")
	v.Set("digits", fmt.Sprintf("%d", th.digits))
	v.Set("period", fmt.Sprintf("%d", th.period))

	keyURI := fmt.Sprintf("otpauth://totp/%s?%s", url.PathEscape(label), v.Encode())

	// Generate QR Code PNG
	qrPNG, err := qrcode.Encode(keyURI, qrcode.Medium, 256)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code: %w", err)
	}

	qrDataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(qrPNG)

	if backupCodeCount <= 0 {
		backupCodeCount = 10
	}
	plainCodes, hashedCodes, err := GenerateBackupCodes(backupCodeCount, 8)
	if err != nil {
		return nil, fmt.Errorf("failed to generate backup codes: %w", err)
	}

	return &TOTPSetup{
		Secret:            secret,
		KeyURI:            keyURI,
		QRCodePNG:         qrPNG,
		QRCodeDataURL:     qrDataURL,
		BackupCodes:       plainCodes,
		HashedBackupCodes: hashedCodes,
	}, nil
}

// VerifyCode verifies a 6-digit TOTP code against the secret using current time with ±1 step skew tolerance.
func (th *TOTPHelper) VerifyCode(secret, code string) bool {
	valid, _ := th.VerifyCodeWithTimestamp(secret, code, time.Now().UTC(), 1)
	return valid
}

// VerifyCodeWithTimestamp verifies a code for a specific time and returns the matched time step counter.
// skewWindow defines how many steps before and after the current step to check (default 1 = ±30s).
// matchedStep can be stored by the caller to prevent replay attacks in the same time window.
func (th *TOTPHelper) VerifyCodeWithTimestamp(secret, code string, t time.Time, skewWindow int) (bool, int64) {
	cleanCode := strings.TrimSpace(code)
	if len(cleanCode) != th.digits {
		return false, 0
	}

	secretBytes, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
	if err != nil {
		// Try standard decoding with padding if unpadded failed
		secretBytes, err = base32.StdEncoding.DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
		if err != nil {
			return false, 0
		}
	}

	currentStep := t.Unix() / int64(th.period)

	for i := -skewWindow; i <= skewWindow; i++ {
		step := currentStep + int64(i)
		expectedCode := computeTOTPCode(secretBytes, step, th.digits)
		if subtle.ConstantTimeCompare([]byte(cleanCode), []byte(expectedCode)) == 1 {
			return true, step
		}
	}

	return false, 0
}

// GenerateCodeAtTime computes the TOTP code for a secret at a specific timestamp (mainly useful for testing and sync).
func (th *TOTPHelper) GenerateCodeAtTime(secret string, t time.Time) (string, error) {
	secretBytes, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
	if err != nil {
		secretBytes, err = base32.StdEncoding.DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
		if err != nil {
			return "", err
		}
	}
	step := t.Unix() / int64(th.period)
	return computeTOTPCode(secretBytes, step, th.digits), nil
}

// computeTOTPCode implements the RFC 4226 / RFC 6238 HOTP/TOTP computation algorithm.
func computeTOTPCode(secret []byte, counter int64, digits int) string {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(counter))

	mac := hmac.New(sha1.New, secret)
	mac.Write(buf)
	h := mac.Sum(nil)

	// Dynamic Truncation
	offset := h[len(h)-1] & 0x0f
	binaryCode := (int64(h[offset]&0x7f) << 24) |
		(int64(h[offset+1]&0xff) << 16) |
		(int64(h[offset+2]&0xff) << 8) |
		int64(h[offset+3]&0xff)

	mod := int64(1)
	for i := 0; i < digits; i++ {
		mod *= 10
	}

	otp := binaryCode % mod
	format := fmt.Sprintf("%%0%dd", digits)
	return fmt.Sprintf(format, otp)
}

// --- Backup / Recovery Codes ---

// NormalizeBackupCode strips spaces, dashes, and converts to uppercase for flexible user input.
func NormalizeBackupCode(code string) string {
	code = strings.ToUpper(code)
	code = strings.ReplaceAll(code, "-", "")
	code = strings.ReplaceAll(code, " ", "")
	return strings.TrimSpace(code)
}

// FormatBackupCode formats a code into human-readable 4-character chunks (e.g. "ABCD-EFGH").
func FormatBackupCode(code string) string {
	clean := NormalizeBackupCode(code)
	if len(clean) <= 4 {
		return clean
	}
	var chunks []string
	for i := 0; i < len(clean); i += 4 {
		end := i + 4
		if end > len(clean) {
			end = len(clean)
		}
		chunks = append(chunks, clean[i:end])
	}
	return strings.Join(chunks, "-")
}

// HashBackupCode computes SHA-256 digest of normalized backup code.
func HashBackupCode(code string) string {
	norm := NormalizeBackupCode(code)
	h := sha256.Sum256([]byte(norm))
	return hex.EncodeToString(h[:])
}

// GenerateBackupCodes produces a batch of formatted plaintext backup codes and their SHA-256 hashes.
func GenerateBackupCodes(count int, length int) (plaintext []string, hashed []string, err error) {
	if count <= 0 {
		count = 10
	}
	if length <= 0 {
		length = 8
	}

	plaintext = make([]string, count)
	hashed = make([]string, count)

	for i := 0; i < count; i++ {
		// Use secure alphanumeric characters (excluding ambiguous 0, O, 1, I, L)
		raw, err := generateAlphanumeric(length)
		if err != nil {
			return nil, nil, err
		}
		formatted := FormatBackupCode(raw)
		plaintext[i] = formatted
		hashed[i] = HashBackupCode(formatted)
	}

	return plaintext, hashed, nil
}

// VerifyBackupCode checks if inputCode matches one of the stored hashedCodes.
// If matched, returns the matched index so the caller can remove/consume it (single-use), and true.
// Otherwise returns -1, false.
func VerifyBackupCode(inputCode string, storedHashes []string) (int, bool) {
	inputHash := HashBackupCode(inputCode)
	for idx, storedHash := range storedHashes {
		if subtle.ConstantTimeCompare([]byte(inputHash), []byte(storedHash)) == 1 {
			return idx, true
		}
	}
	return -1, false
}

const safeCharset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

func generateAlphanumeric(length int) (string, error) {
	b, err := GenerateRandomBytes(length)
	if err != nil {
		return "", err
	}
	res := make([]byte, length)
	charsetLen := byte(len(safeCharset))
	for i, v := range b {
		res[i] = safeCharset[v%charsetLen]
	}
	return string(res), nil
}
