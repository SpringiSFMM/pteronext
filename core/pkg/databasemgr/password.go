package databasemgr

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"unicode"
)

const (
	DefaultPasswordLength = 24
	MinPasswordLength     = 12
	MaxIdentifierLength   = 48

	charsetLower   = "abcdefghijklmnopqrstuvwxyz"
	charsetUpper   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	charsetDigits  = "0123456789"
	charsetSymbols = "!@#$%&*-_=+"
)

var (
	identifierRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)
)

// PasswordGenerator generates cryptographically secure passwords and handles identifier formatting.
type PasswordGenerator struct {
	allowedSymbols string
}

// NewPasswordGenerator creates a new PasswordGenerator instance.
func NewPasswordGenerator(customSymbols ...string) *PasswordGenerator {
	symbols := charsetSymbols
	if len(customSymbols) > 0 && customSymbols[0] != "" {
		symbols = customSymbols[0]
	}
	return &PasswordGenerator{
		allowedSymbols: symbols,
	}
}

// Generate creates a cryptographically secure random password guaranteed to include
// uppercase letters, lowercase letters, numbers, and symbols.
func (g *PasswordGenerator) Generate(length int) (string, error) {
	if length < MinPasswordLength {
		length = DefaultPasswordLength
	}

	allChars := charsetLower + charsetUpper + charsetDigits + g.allowedSymbols

	// Ensure at least one character from each required class
	passwordRunes := make([]rune, length)

	var err error
	passwordRunes[0], err = randomRune(charsetLower)
	if err != nil {
		return "", err
	}
	passwordRunes[1], err = randomRune(charsetUpper)
	if err != nil {
		return "", err
	}
	passwordRunes[2], err = randomRune(charsetDigits)
	if err != nil {
		return "", err
	}
	passwordRunes[3], err = randomRune(g.allowedSymbols)
	if err != nil {
		return "", err
	}

	// Fill remainder from full character set
	for i := 4; i < length; i++ {
		passwordRunes[i], err = randomRune(allChars)
		if err != nil {
			return "", err
		}
	}

	// Fisher-Yates shuffle using crypto/rand
	for i := length - 1; i > 0; i-- {
		nBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return "", fmt.Errorf("crypto random error: %w", err)
		}
		j := int(nBig.Int64())
		passwordRunes[i], passwordRunes[j] = passwordRunes[j], passwordRunes[i]
	}

	return string(passwordRunes), nil
}

// ValidateStrength ensures a password meets minimum complexity requirements.
func (g *PasswordGenerator) ValidateStrength(password string) error {
	if len(password) < MinPasswordLength {
		return fmt.Errorf("password must be at least %d characters long", MinPasswordLength)
	}

	var hasLower, hasUpper, hasDigit, hasSymbol bool
	for _, ch := range password {
		switch {
		case unicode.IsLower(ch):
			hasLower = true
		case unicode.IsUpper(ch):
			hasUpper = true
		case unicode.IsDigit(ch):
			hasDigit = true
		case strings.ContainsRune(g.allowedSymbols, ch):
			hasSymbol = true
		}
	}

	if !hasLower || !hasUpper || !hasDigit || !hasSymbol {
		return fmt.Errorf("password must contain uppercase, lowercase, numbers, and special symbols (%s)", g.allowedSymbols)
	}

	return nil
}

// GenerateDatabaseName formats and validates a unique database name: s{serverID}_{baseName}.
func (g *PasswordGenerator) GenerateDatabaseName(serverID, baseName string) (string, error) {
	sanitized := strings.TrimSpace(baseName)
	if sanitized == "" {
		return "", fmt.Errorf("database name cannot be empty")
	}

	// Strip non-alphanumeric/underscore
	reg := regexp.MustCompile(`[^a-zA-Z0-9_]`)
	cleanBase := reg.ReplaceAllString(sanitized, "_")

	prefix := fmt.Sprintf("s%s_", serverID)
	maxBaseLen := MaxIdentifierLength - len(prefix)
	if maxBaseLen <= 0 {
		return "", fmt.Errorf("server ID too long for database name")
	}

	if len(cleanBase) > maxBaseLen {
		cleanBase = cleanBase[:maxBaseLen]
	}

	fullName := prefix + cleanBase
	if err := ValidateIdentifier(fullName); err != nil {
		return "", err
	}
	return fullName, nil
}

// GenerateDatabaseUsername formats a unique database username: u{serverID}_{random8}.
func (g *PasswordGenerator) GenerateDatabaseUsername(serverID string) (string, error) {
	const userCharset = "abcdefghijklmnopqrstuvwxyz0123456789"
	randomSuffix := make([]rune, 8)
	for i := 0; i < 8; i++ {
		r, err := randomRune(userCharset)
		if err != nil {
			return "", err
		}
		randomSuffix[i] = r
	}

	username := fmt.Sprintf("u%s_%s", serverID, string(randomSuffix))
	// Max length in MySQL is 32 characters
	if len(username) > 32 {
		return "", fmt.Errorf("generated username %q exceeds 32 characters", username)
	}
	return username, nil
}

// ValidateIdentifier verifies that an identifier conforms strictly to alphanumeric and underscores.
func ValidateIdentifier(identifier string) error {
	if identifier == "" {
		return fmt.Errorf("identifier cannot be empty: %w", ErrInvalidIdentifier)
	}
	if len(identifier) > MaxIdentifierLength {
		return fmt.Errorf("identifier %q exceeds maximum length %d: %w", identifier, MaxIdentifierLength, ErrInvalidIdentifier)
	}
	if !identifierRegex.MatchString(identifier) {
		return fmt.Errorf("identifier %q contains disallowed characters: %w", identifier, ErrInvalidIdentifier)
	}
	return nil
}

func randomRune(charset string) (rune, error) {
	nBig, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
	if err != nil {
		return 0, fmt.Errorf("crypto rand failed: %w", err)
	}
	return rune(charset[nBig.Int64()]), nil
}
