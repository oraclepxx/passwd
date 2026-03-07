# TASKS.md — passwd Implementation Tasks

Check off each task as it is completed. Do not skip ahead — complete and verify each phase before starting the next.

---

## Phase 1 — Project Scaffold

- [x] 1-1. Run `wails init -n passwd -t react-ts` to bootstrap the project
- [x] 1-2. Reorganize directory structure to match `TECH_DESIGN_v2.md` §10 (move Go code into `backend/`)
- [x] 1-3. Update `wails.json` to point `backend` to the new path
- [x] 1-4. Add Go dependencies: `modernc.org/sqlite`, `golang.org/x/crypto/argon2`, `github.com/google/uuid`, `golang.org/x/sys`
- [x] 1-5. Add frontend dependency: `tailwindcss @tailwindcss/vite`
- [x] 1-6. Configure Tailwind in `vite.config.ts` and add `@tailwind` directives to global CSS
- [x] 1-7. Set Wails CSP in `wails.json` to block all external origins (`"default-src 'self'"`)
- [x] 1-8. Create all empty Go files with package declarations: `backend/vault/session.go`, `crypto.go`, `db.go`, `records.go`, `generator.go`, `backend/models/record.go`, `errors.go`

**Verify:**
- [x] 1-9. `wails dev` starts and opens a blank window with no errors
- [x] 1-10. `go build ./...` compiles cleanly
- [x] 1-11. `cd frontend && npm run build` succeeds

---

## Phase 2 — Data Layer (Go)

- [x] 2-1. Implement `backend/vault/db.go`: open/create SQLite DB at `os.UserConfigDir()` path
- [x] 2-2. Run schema on first open with `CREATE TABLE IF NOT EXISTS` for `vault_meta`, `records`, `password_history`
- [x] 2-3. Create all three indexes: `idx_records_deleted_at`, `idx_records_search`, `idx_history_record`
- [x] 2-4. Export `DB` struct with `*sql.DB` field and `Close() error` method
- [x] 2-5. Implement `backend/models/record.go` with exact structs from `TECH_DESIGN_v2.md` §4.3: `RecordPlaintext`, `RecordSummary`, `RecordDetail`, `RecordInput`, `GeneratorOptions`, `PasswordHistory`
- [x] 2-6. Implement `backend/models/errors.go` with sentinel errors: `ErrVaultLocked`, `ErrVaultAlreadyExists`, `ErrVaultNotFound`, `ErrRecordNotFound`, `ErrWrongPassword`

**Verify:**
- [x] 2-7. Go test: call `db.Open()`, query `sqlite_master`, assert all 3 tables exist
- [x] 2-8. `go test ./backend/vault/...` passes

---

## Phase 3 — Crypto Layer (Go)

- [x] 3-1. Implement `DeriveKey(password []byte, salt []byte) ([32]byte, error)` in `crypto.go` — Argon2id `m=65536, t=3, p=4`
- [x] 3-2. Implement `Encrypt(key [32]byte, plaintext []byte) (ciphertext []byte, nonce []byte, err error)` — AES-256-GCM, fresh nonce per call via `crypto/rand`
- [x] 3-3. Implement `Decrypt(key [32]byte, ciphertext []byte, nonce []byte) ([]byte, error)` — AES-256-GCM verify + decrypt
- [x] 3-4. Implement `VaultSession` struct in `session.go` with `key [32]byte`, `unlocked bool`, `sync.Mutex`
- [x] 3-5. Implement `Lock()` — zeros key with `clear(s.key[:])`, sets `unlocked = false`
- [x] 3-6. Implement `IsUnlocked() bool` and `Key() ([32]byte, error)` on `VaultSession`

**Verify:**
- [x] 3-7. Unit test: encrypt then decrypt known plaintext — assert round-trip equality
- [x] 3-8. Unit test: tamper with ciphertext — assert `Decrypt` returns error
- [x] 3-9. Unit test: call `Lock()` — assert `key == [32]byte{}`
- [x] 3-10. `go test ./backend/vault/...` passes

---

## Phase 4 — Vault & Record Business Logic (Go)

- [ ] 4-1. Implement `CreateRecord(db, key, input)` — UUID v4 id, build `search_hint`, encrypt, insert
- [ ] 4-2. Implement `ListRecords(db, key, query)` — filter by `search_hint LIKE ?`, `WHERE deleted_at IS NULL`, apply `maskUsername`
- [ ] 4-3. Implement `GetRecord(db, key, id)` — decrypt on demand
- [ ] 4-4. Implement `UpdateRecord(db, key, id, input)` — save password history if password changed, re-encrypt with fresh nonce
- [ ] 4-5. Implement `DeleteRecord(db, id)` — sets `deleted_at = now()`
- [ ] 4-6. Implement `RestoreRecord(db, id)` — sets `deleted_at = NULL`
- [ ] 4-7. Implement `PurgeRecord(db, id)` — hard DELETE, guard requires `deleted_at IS NOT NULL`
- [ ] 4-8. Implement `GetHistory(db, key, id)` — last 5 entries, decrypt passwords
- [ ] 4-9. Implement `PurgeExpiredTrash(db)` — DELETE where `deleted_at < now() - 30 days`
- [ ] 4-10. Implement `maskUsername(username string) string` exactly as specified in `TECH_DESIGN_v2.md` §5
- [ ] 4-11. Implement `Generate(opts GeneratorOptions) (string, error)` in `generator.go`:
  - [ ] 4-11-1. Build character pool from enabled sets (lowercase always included)
  - [ ] 4-11-2. Guarantee at least one char from each enabled set
  - [ ] 4-11-3. Fill remaining length from full pool via `crypto/rand`
  - [ ] 4-11-4. Fisher-Yates shuffle using `crypto/rand`
  - [ ] 4-11-5. Return error if `opts.Length < 8`

**Verify:**
- [ ] 4-12. Unit test: `CreateRecord` + `GetRecord` round-trip — decrypted values match input
- [ ] 4-13. Unit test: `ListRecords` with query — only matching records returned
- [ ] 4-14. Unit test: `UpdateRecord` with password change — history row inserted, old value recoverable via `GetHistory`
- [ ] 4-15. Unit test: `maskUsername` — verify all four cases from `TECH_DESIGN_v2.md` §5
- [ ] 4-16. Unit test: `Generate` — assert correct length, each enabled char class present
- [ ] 4-17. `go test ./backend/vault/...` passes

---

## Phase 5 — App Struct & Wails Wiring (Go)

- [ ] 5-1. Implement `App` struct in `backend/app.go` with fields `ctx`, `db`, `session`
- [ ] 5-2. Implement `startup(ctx)`: open DB, call `PurgeExpiredTrash`
- [ ] 5-3. Implement `shutdown(ctx)`: call `session.Lock()`, close DB
- [ ] 5-4. Implement `VaultCreate(password string) error`
- [ ] 5-5. Implement `VaultUnlock(password string) error`
- [ ] 5-6. Implement `VaultLock() error`
- [ ] 5-7. Implement `VaultIsUnlocked() bool`
- [ ] 5-8. Implement `RecordCreate(input RecordInput) (string, error)` — guard with `IsUnlocked()`
- [ ] 5-9. Implement `RecordList(query string) ([]RecordSummary, error)` — guard with `IsUnlocked()`
- [ ] 5-10. Implement `RecordGet(id string) (RecordDetail, error)` — guard with `IsUnlocked()`
- [ ] 5-11. Implement `RecordUpdate(id string, data RecordInput) error` — guard with `IsUnlocked()`
- [ ] 5-12. Implement `RecordDelete(id string) error` — guard with `IsUnlocked()`
- [ ] 5-13. Implement `RecordRestore(id string) error` — guard with `IsUnlocked()`
- [ ] 5-14. Implement `RecordPurge(id string) error` — guard with `IsUnlocked()`
- [ ] 5-15. Implement `RecordHistory(id string) ([]PasswordHistory, error)` — guard with `IsUnlocked()`
- [ ] 5-16. Implement `PasswordGenerate(opts GeneratorOptions) (string, error)`
- [ ] 5-17. Implement `ClipboardCopy(value string, timeoutSecs int) error` — write to OS clipboard, goroutine clears after timeout
- [ ] 5-18. Register `App` in `backend/main.go` with `wails.Run`

**Verify:**
- [ ] 5-19. `wails build` produces a binary with no errors
- [ ] 5-20. Run binary — app window opens
- [ ] 5-21. In Wails dev tools console: `window['go']['main']['App']['VaultIsUnlocked']()` returns `false`

---

## Phase 6 — Frontend: Vault Lock Screen

- [ ] 6-1. Implement `useVault.ts` hook: `isUnlocked`, `unlock(password)`, `lock()`, `createVault(password)`
- [ ] 6-2. Add auto-lock in `useVault.ts`: reset `setTimeout` on `mousemove` and `keydown`; call `lock()` on expiry (default 5 min)
- [ ] 6-3. Implement `LockView.tsx` — "Create vault" form (first launch): password + confirm fields
- [ ] 6-4. Implement `LockView.tsx` — "Unlock vault" form (subsequent launches): single password field
- [ ] 6-5. Call `VaultCreate` or `VaultUnlock` on submit; show inline error on failure
- [ ] 6-6. On success: transition to main layout (`ListView`)
- [ ] 6-7. Wire `App.tsx` to render `LockView` when locked, main layout when unlocked

**Verify:**
- [ ] 6-8. Create a vault — app transitions to empty list view
- [ ] 6-9. Lock the vault — lock screen reappears
- [ ] 6-10. Enter wrong password — error message shown
- [ ] 6-11. Enter correct password — unlock succeeds and list view shown

---

## Phase 7 — Frontend: Record List & Search

- [ ] 7-1. Implement `useRecords.ts` hook with `list(query)`, `get(id)`, `create(input)`, `update(id, input)`, `remove(id)`, `restore(id)`, `purge(id)`
- [ ] 7-2. Implement `RecordCard.tsx` — display `name` and `username_masked`, no password shown
- [ ] 7-3. Implement `ListView.tsx` — search bar at top, debounced (150ms) call to `RecordList` on every keystroke
- [ ] 7-4. Render list of `RecordCard` components in `ListView`
- [ ] 7-5. "New record" button in `ListView` — navigate to `FormView` in create mode
- [ ] 7-6. Clicking a `RecordCard` — navigate to `DetailView`

**Verify:**
- [ ] 7-7. Create 3 records; all appear in the list
- [ ] 7-8. Search by name — only matching records shown
- [ ] 7-9. Search by username — only matching records shown
- [ ] 7-10. Clear search — all records shown

---

## Phase 8 — Frontend: Record Detail View

- [ ] 8-1. Implement `ConfirmDialog.tsx` — reusable modal with confirm/cancel
- [ ] 8-2. Implement `useClipboard.ts` — wraps `ClipboardCopy`, shows "Copied!" toast for 2 seconds
- [ ] 8-3. Implement `DetailView.tsx` — call `RecordGet(id)` on mount
- [ ] 8-4. Display `username_masked`; add "show" toggle to reveal full username
- [ ] 8-5. Display password as `••••••••` by default; "reveal" button toggles visibility (use `font-mono` for password)
- [ ] 8-6. "Copy username" button — calls `ClipboardCopy(username, 30)`
- [ ] 8-7. "Copy password" button — calls `ClipboardCopy(password, 30)`
- [ ] 8-8. Display URL, notes, tags if present
- [ ] 8-9. "Edit" button — navigate to `FormView` in edit mode
- [ ] 8-10. "Delete" button — show `ConfirmDialog` → call `RecordDelete(id)` → back to `ListView`

**Verify:**
- [ ] 8-11. Open a record — password shows as dots
- [ ] 8-12. Click reveal — plaintext appears
- [ ] 8-13. Click "Copy password" — clipboard contains the password
- [ ] 8-14. Wait 30 seconds — clipboard is cleared
- [ ] 8-15. Click delete → confirm dialog appears → confirm → record gone from list

---

## Phase 9 — Frontend: Create & Edit Form

- [ ] 9-1. Implement `PasswordField.tsx` — show/hide toggle, "Generate" button calls `PasswordGenerate` and fills field
- [ ] 9-2. Add generator options UI to `PasswordField`: length slider (min 8, default 20), symbol/number/uppercase toggles
- [ ] 9-3. Implement `FormView.tsx` in create mode — fields: Name (required), Username (required), Password (required), URL, Notes, Tags
- [ ] 9-4. Implement `FormView.tsx` in edit mode — pre-fill all fields from `RecordDetail`
- [ ] 9-5. Validate required fields before submit; show inline errors, make no API call if invalid
- [ ] 9-6. Save in create mode — call `RecordCreate` → navigate to `DetailView`
- [ ] 9-7. Save in edit mode — call `RecordUpdate` → navigate to `DetailView`
- [ ] 9-8. Cancel — navigate back without saving

**Verify:**
- [ ] 9-9. Create a record via the form — it appears in the list
- [ ] 9-10. Edit the record's password — old password appears in history
- [ ] 9-11. Leave required field empty — validation error shown, no API call made
- [ ] 9-12. Click cancel — no record created or modified

---

## Phase 10 — Security Hardening & Final Checks

- [ ] 10-1. Test vault key zeroing: lock vault, assert `session.key == [32]byte{}`
- [ ] 10-2. Code review `crypto.go`: confirm `crypto/rand.Read` used for every nonce, no nonce reused
- [ ] 10-3. Code review `records.go` `CreateRecord` and `UpdateRecord`: confirm `search_hint` never includes password, URL, or notes
- [ ] 10-4. Code review all `App` methods: confirm every record method returns `ErrVaultLocked` if session is locked
- [ ] 10-5. Check `wails.json` CSP field: confirm it denies all external origins
- [ ] 10-6. Manual test clipboard auto-clear: copy a password, wait 30 seconds, assert clipboard is empty
- [ ] 10-7. Test trash auto-purge: insert record with `deleted_at = now() - 31 days`, call `PurgeExpiredTrash`, assert record is gone
- [ ] 10-8. Run `grep -r "math/rand" backend/` — assert no results
- [ ] 10-9. Run app with network monitoring (`lsof -i`): assert no external connections on startup or normal use

**Verify:**
- [ ] 10-10. All checklist items 10-1 through 10-9 pass
- [ ] 10-11. `go test ./...` passes with no failures
- [ ] 10-12. `wails build` produces a release binary
- [ ] 10-13. Smoke test release binary end-to-end:
  - [ ] 10-13-1. Create vault
  - [ ] 10-13-2. Add a record
  - [ ] 10-13-3. Search for the record
  - [ ] 10-13-4. Reveal password
  - [ ] 10-13-5. Copy password
  - [ ] 10-13-6. Edit the record
  - [ ] 10-13-7. Delete the record
  - [ ] 10-13-8. Restore from trash
  - [ ] 10-13-9. Permanently purge
