package models

// RecordPlaintext is the decrypted JSON stored per record.
type RecordPlaintext struct {
	Name     string   `json:"name"`
	Username string   `json:"username"`
	Password string   `json:"password"`
	URL      string   `json:"url,omitempty"`
	Notes    string   `json:"notes,omitempty"`
	Tags     []string `json:"tags,omitempty"`
}

// RecordSummary is returned by RecordList — no sensitive fields.
type RecordSummary struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	UsernameMasked string `json:"username_masked"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

// RecordDetail is returned by RecordGet — includes decrypted sensitive fields.
type RecordDetail struct {
	RecordSummary
	Username string   `json:"username"`
	Password string   `json:"password"`
	URL      string   `json:"url,omitempty"`
	Notes    string   `json:"notes,omitempty"`
	Tags     []string `json:"tags,omitempty"`
}

// RecordInput is the payload for create and update operations.
type RecordInput struct {
	Name     string   `json:"name"`
	Username string   `json:"username"`
	Password string   `json:"password"`
	URL      string   `json:"url,omitempty"`
	Notes    string   `json:"notes,omitempty"`
	Tags     []string `json:"tags,omitempty"`
}

// GeneratorOptions controls the password generator.
type GeneratorOptions struct {
	Length       int  `json:"length"`
	UseSymbols   bool `json:"use_symbols"`
	UseNumbers   bool `json:"use_numbers"`
	UseUppercase bool `json:"use_uppercase"`
}

// PasswordHistory is a single entry in the password history for a record.
type PasswordHistory struct {
	ID         string `json:"id"`
	RecordID   string `json:"record_id"`
	Password   string `json:"password"`
	ReplacedAt int64  `json:"replaced_at"`
}
