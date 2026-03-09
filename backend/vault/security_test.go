package vault

import (
	"strings"
	"testing"

	"github.com/oraclepxx/passwd/backend/models"
)

// Verify search_hint never contains password, URL, or notes for password-type records.
func TestSearchHint_NeverContainsSecretFields_Password(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, err := CreateRecord(db, key, models.RecordInput{
		Type:     "password",
		Name:     "GitHub",
		Username: "user@example.com",
		Password: "hunter2-super-secret",
		URL:      "https://github.com/secret-path",
		Notes:    "do not share this note",
	})
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}

	var hint string
	if err := db.conn.QueryRow(`SELECT search_hint FROM records WHERE id=?`, id).Scan(&hint); err != nil {
		t.Fatalf("query search_hint: %v", err)
	}

	if strings.Contains(hint, "hunter2-super-secret") {
		t.Errorf("search_hint contains password: %q", hint)
	}
	if strings.Contains(hint, "https://github.com/secret-path") {
		t.Errorf("search_hint contains URL: %q", hint)
	}
	if strings.Contains(hint, "do not share this note") {
		t.Errorf("search_hint contains notes: %q", hint)
	}
	// Must contain name and username.
	if !strings.Contains(hint, "github") {
		t.Errorf("search_hint missing name: %q", hint)
	}
	if !strings.Contains(hint, "user@example.com") {
		t.Errorf("search_hint missing username: %q", hint)
	}
}

// Verify search_hint for api_key contains only name, never the secret key, URL, or notes.
func TestSearchHint_NeverContainsSecretFields_APIKey(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, err := CreateRecord(db, key, models.RecordInput{
		Type:      "api_key",
		Name:      "OpenAI Production",
		SecretKey: "sk-very-secret-key-12345",
		Notes:     "production use only",
	})
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}

	var hint string
	if err := db.conn.QueryRow(`SELECT search_hint FROM records WHERE id=?`, id).Scan(&hint); err != nil {
		t.Fatalf("query search_hint: %v", err)
	}

	if strings.Contains(hint, "sk-very-secret-key-12345") {
		t.Errorf("search_hint contains secret key: %q", hint)
	}
	if strings.Contains(hint, "production use only") {
		t.Errorf("search_hint contains notes: %q", hint)
	}
	// api_key search_hint must contain only the name (lowercased), no username.
	if !strings.Contains(hint, "openai production") {
		t.Errorf("search_hint missing name: %q", hint)
	}
	// Verify there is no tab separator (which would indicate a username was appended).
	if strings.Contains(hint, "\t") {
		t.Errorf("api_key search_hint unexpectedly contains tab separator: %q", hint)
	}
}

// Verify search_hint format: password type uses name\tusername (tab-separated, lowercased).
func TestSearchHint_Format_PasswordType(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, _ := CreateRecord(db, key, models.RecordInput{
		Type:     "password",
		Name:     "MyService",
		Username: "Alice@Example.COM",
		Password: "pw",
	})

	var hint string
	db.conn.QueryRow(`SELECT search_hint FROM records WHERE id=?`, id).Scan(&hint)

	expected := "myservice\talice@example.com"
	if hint != expected {
		t.Errorf("search_hint = %q, want %q", hint, expected)
	}
}

// Verify search_hint is updated correctly on UpdateRecord.
func TestSearchHint_UpdatedOnRecordUpdate(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, _ := CreateRecord(db, key, models.RecordInput{
		Type:     "password",
		Name:     "OldName",
		Username: "old@user.com",
		Password: "pw",
	})

	err := UpdateRecord(db, key, id, models.RecordInput{
		Type:     "password",
		Name:     "NewName",
		Username: "new@user.com",
		Password: "pw",
	})
	if err != nil {
		t.Fatalf("UpdateRecord: %v", err)
	}

	var hint string
	db.conn.QueryRow(`SELECT search_hint FROM records WHERE id=?`, id).Scan(&hint)

	if strings.Contains(hint, "oldname") {
		t.Errorf("search_hint still contains old name: %q", hint)
	}
	if !strings.Contains(hint, "newname") {
		t.Errorf("search_hint missing new name: %q", hint)
	}
	if !strings.Contains(hint, "new@user.com") {
		t.Errorf("search_hint missing new username: %q", hint)
	}
}

// Verify UpdateRecord without secret change does NOT create a history entry.
func TestUpdateRecord_NoHistoryWhenSecretUnchanged(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, _ := CreateRecord(db, key, models.RecordInput{
		Type:     "password",
		Name:     "Site",
		Username: "user",
		Password: "same-password",
	})

	// Update only the name — password unchanged.
	err := UpdateRecord(db, key, id, models.RecordInput{
		Type:     "password",
		Name:     "SiteRenamed",
		Username: "user",
		Password: "same-password",
	})
	if err != nil {
		t.Fatalf("UpdateRecord: %v", err)
	}

	history, err := GetHistory(db, key, id)
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if len(history) != 0 {
		t.Errorf("expected no history entries when secret unchanged, got %d", len(history))
	}
}

// Verify GetRecord returns an error for a non-existent ID.
func TestGetRecord_NotFound(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	_, err := GetRecord(db, key, "non-existent-uuid")
	if err == nil {
		t.Error("expected error for non-existent record ID, got nil")
	}
}

// Verify Decrypt fails (and GetRecord returns an error) when the wrong key is used.
func TestGetRecord_WrongKeyFails(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id, _ := CreateRecord(db, key, models.RecordInput{
		Type:     "password",
		Name:     "Secret",
		Username: "u",
		Password: "p",
	})

	wrongKey, _ := DeriveKey([]byte("wrong-password"), []byte("saltsaltsaltsaltsaltsaltsaltsalt"))
	_, err := GetRecord(db, wrongKey, id)
	if err == nil {
		t.Error("expected error when decrypting with wrong key, got nil")
	}
}

// Verify ListDeletedRecords returns only soft-deleted records.
func TestListDeletedRecords_OnlyDeleted(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	id1, _ := CreateRecord(db, key, models.RecordInput{Type: "password", Name: "Active", Username: "u", Password: "p"})
	id2, _ := CreateRecord(db, key, models.RecordInput{Type: "password", Name: "Deleted", Username: "u", Password: "p"})
	DeleteRecord(db, id2)

	active, _ := ListRecords(db, "")
	if len(active) != 1 || active[0].ID != id1 {
		t.Errorf("expected 1 active record, got %d", len(active))
	}

	deleted, err := ListDeletedRecords(db)
	if err != nil {
		t.Fatalf("ListDeletedRecords: %v", err)
	}
	if len(deleted) != 1 || deleted[0].ID != id2 {
		t.Errorf("expected 1 deleted record, got %d", len(deleted))
	}
}

// Verify tags are preserved through create/get round-trip.
func TestCreateGetRecord_TagsRoundTrip(t *testing.T) {
	db := newTestDB(t)
	key := testKey(t)

	tags := []string{"work", "dev", "2fa"}
	id, _ := CreateRecord(db, key, models.RecordInput{
		Type:     "password",
		Name:     "Tagged",
		Username: "u",
		Password: "p",
		Tags:     tags,
	})

	got, err := GetRecord(db, key, id)
	if err != nil {
		t.Fatalf("GetRecord: %v", err)
	}
	if len(got.Tags) != len(tags) {
		t.Fatalf("tags len: got %d, want %d", len(got.Tags), len(tags))
	}
	for i, tag := range tags {
		if got.Tags[i] != tag {
			t.Errorf("tag[%d]: got %q, want %q", i, got.Tags[i], tag)
		}
	}
}
