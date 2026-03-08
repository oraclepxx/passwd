package vault

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
	"passwd/backend/models"
)

func newTestDB(t *testing.T) *DB {
	t.Helper()
	conn, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	conn.SetMaxOpenConns(1)
	db := &DB{conn: conn}
	if err := db.migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return db
}

func testKey(t *testing.T) [32]byte {
	t.Helper()
	key, err := DeriveKey([]byte("test-pass"), []byte("saltsaltsaltsaltsaltsaltsaltsalt"))
	if err != nil {
		t.Fatalf("DeriveKey: %v", err)
	}
	return key
}

// 4-12: CreateRecord + GetRecord round-trip.
func TestCreateGetRecord_RoundTrip(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	input := models.RecordInput{
		Name:     "GitHub",
		Username: "user@example.com",
		Password: "s3cr3t!",
		URL:      "https://github.com",
		Notes:    "work account",
		Tags:     []string{"dev", "work"},
	}

	id, err := CreateRecord(db, key, input)
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}

	got, err := GetRecord(db, key, id)
	if err != nil {
		t.Fatalf("GetRecord: %v", err)
	}

	if got.Username != input.Username {
		t.Errorf("username: got %q, want %q", got.Username, input.Username)
	}
	if got.Password != input.Password {
		t.Errorf("password: got %q, want %q", got.Password, input.Password)
	}
	if got.URL != input.URL {
		t.Errorf("url: got %q, want %q", got.URL, input.URL)
	}
	if got.Notes != input.Notes {
		t.Errorf("notes: got %q, want %q", got.Notes, input.Notes)
	}
	// "user@example.com" = 16 chars → "use" + 11 stars + "om"
	if got.UsernameMasked != "use***********om" {
		t.Errorf("masked: got %q", got.UsernameMasked)
	}
}

// 4-13: ListRecords with query filter.
func TestListRecords_QueryFilter(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	CreateRecord(db, key, models.RecordInput{Name: "GitHub", Username: "alice@gh.com", Password: "p1"})
	CreateRecord(db, key, models.RecordInput{Name: "Gmail", Username: "alice@gmail.com", Password: "p2"})
	CreateRecord(db, key, models.RecordInput{Name: "Slack", Username: "bob@slack.com", Password: "p3"})

	all, err := ListRecords(db, "")
	if err != nil {
		t.Fatalf("ListRecords all: %v", err)
	}
	if len(all) != 3 {
		t.Errorf("expected 3 records, got %d", len(all))
	}

	filtered, err := ListRecords(db, "github")
	if err != nil {
		t.Fatalf("ListRecords filter: %v", err)
	}
	if len(filtered) != 1 {
		t.Fatalf("expected 1 record for 'github', got %d", len(filtered))
	}
	if filtered[0].Name != "github" { // search_hint is lowercased
		t.Errorf("expected name 'github', got %q", filtered[0].Name)
	}

	byUsername, err := ListRecords(db, "alice")
	if err != nil {
		t.Fatalf("ListRecords by username: %v", err)
	}
	if len(byUsername) != 2 {
		t.Errorf("expected 2 records for 'alice', got %d", len(byUsername))
	}
}

// 4-14: UpdateRecord saves password history; GetHistory recovers old password.
func TestUpdateRecord_PasswordHistory(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, _ := CreateRecord(db, key, models.RecordInput{
		Name: "Site", Username: "user", Password: "old-pass",
	})

	err := UpdateRecord(db, key, id, models.RecordInput{
		Name: "Site", Username: "user", Password: "new-pass",
	})
	if err != nil {
		t.Fatalf("UpdateRecord: %v", err)
	}

	// Current record should have new password.
	detail, _ := GetRecord(db, key, id)
	if detail.Password != "new-pass" {
		t.Errorf("expected new-pass, got %q", detail.Password)
	}

	// History should contain old password.
	history, err := GetHistory(db, key, id)
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("expected 1 history entry, got %d", len(history))
	}
	if history[0].Password != "old-pass" {
		t.Errorf("history password: got %q, want %q", history[0].Password, "old-pass")
	}
}

// 4-14 (extended): History is capped at 5 entries.
func TestUpdateRecord_HistoryCappedAt5(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, _ := CreateRecord(db, key, models.RecordInput{Name: "S", Username: "u", Password: "p0"})
	for i := 1; i <= 7; i++ {
		UpdateRecord(db, key, id, models.RecordInput{
			Name: "S", Username: "u", Password: strings.Repeat("x", i),
		})
	}

	history, err := GetHistory(db, key, id)
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if len(history) > 5 {
		t.Errorf("expected at most 5 history entries, got %d", len(history))
	}
}

// 4-15: maskUsername cases from TECH_DESIGN_v2.md §5.
func TestMaskUsername(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"helloworld", "hel*****ld"},
		{"ab", "**"},
		{"hello", "*****"},
		{"hi@example.com", "hi@*********om"},
	}
	for _, c := range cases {
		got := maskUsername(c.input)
		if got != c.want {
			t.Errorf("maskUsername(%q) = %q, want %q", c.input, got, c.want)
		}
	}
}

// 4-16: Generate — correct length and each enabled char class present.
func TestGenerate(t *testing.T) {
	opts := models.GeneratorOptions{
		Length:       20,
		UseSymbols:   true,
		UseNumbers:   true,
		UseUppercase: true,
	}
	password, err := Generate(opts)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if len(password) != 20 {
		t.Errorf("expected length 20, got %d", len(password))
	}

	hasLower := strings.ContainsAny(password, charLower)
	hasUpper := strings.ContainsAny(password, charUpper)
	hasNumber := strings.ContainsAny(password, charNumbers)
	hasSymbol := strings.ContainsAny(password, charSymbols)

	if !hasLower {
		t.Error("missing lowercase char")
	}
	if !hasUpper {
		t.Error("missing uppercase char")
	}
	if !hasNumber {
		t.Error("missing number char")
	}
	if !hasSymbol {
		t.Error("missing symbol char")
	}
}

func TestGenerate_MinLengthError(t *testing.T) {
	_, err := Generate(models.GeneratorOptions{Length: 7})
	if err == nil {
		t.Error("expected error for length < 8")
	}
}

// 10-7: PurgeExpiredTrash removes records deleted more than 30 days ago.
func TestPurgeExpiredTrash(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, _ := CreateRecord(db, key, models.RecordInput{Name: "Old", Username: "u", Password: "p"})

	// Manually set deleted_at to 31 days ago.
	cutoff := time.Now().Unix() - 31*24*60*60
	_, err := db.conn.Exec(`UPDATE records SET deleted_at=? WHERE id=?`, cutoff, id)
	if err != nil {
		t.Fatalf("set deleted_at: %v", err)
	}

	if err := PurgeExpiredTrash(db); err != nil {
		t.Fatalf("PurgeExpiredTrash: %v", err)
	}

	// Record should be gone.
	var count int
	db.conn.QueryRow(`SELECT COUNT(*) FROM records WHERE id=?`, id).Scan(&count)
	if count != 0 {
		t.Errorf("expected record to be purged, still exists")
	}
}

func TestSoftDeleteRestorePurge(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, _ := CreateRecord(db, key, models.RecordInput{Name: "X", Username: "u", Password: "p"})

	// Soft delete — should not appear in active list.
	if err := DeleteRecord(db, id); err != nil {
		t.Fatalf("DeleteRecord: %v", err)
	}
	active, _ := ListRecords(db, "")
	if len(active) != 0 {
		t.Errorf("expected 0 active records after delete, got %d", len(active))
	}

	// Restore — should reappear.
	if err := RestoreRecord(db, id); err != nil {
		t.Fatalf("RestoreRecord: %v", err)
	}
	active, _ = ListRecords(db, "")
	if len(active) != 1 {
		t.Errorf("expected 1 active record after restore, got %d", len(active))
	}

	// Soft delete again then purge.
	DeleteRecord(db, id)
	if err := PurgeRecord(db, id); err != nil {
		t.Fatalf("PurgeRecord: %v", err)
	}
	// Purging active record should fail.
	id2, _ := CreateRecord(db, key, models.RecordInput{Name: "Y", Username: "u", Password: "p"})
	if err := PurgeRecord(db, id2); err == nil {
		t.Error("expected error purging active record")
	}
}
