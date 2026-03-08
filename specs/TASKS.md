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
- [x] 2-2. Run schema on first open with `CREATE TABLE IF NOT EXISTS` for `vault_meta`, `records` (with `record_type TEXT NOT NULL DEFAULT 'password'` column), `secret_history`
- [x] 2-3. Create all three indexes: `idx_records_deleted_at`, `idx_records_search`, `idx_history_record`
- [x] 2-4. Export `DB` struct with `*sql.DB` field and `Close() error` method
- [x] 2-5. Implement `backend/models/record.go` with exact structs from `TECH_DESIGN_v2.md` §4.3: `RecordPlaintext` (with `Type`, `SecretKey` fields), `RecordSummary` (with `Type`), `RecordDetail` (with `SecretKey`), `RecordInput` (with `Type`, `SecretKey`), `GeneratorOptions`, `SecretHistory`
- [x] 2-6. Implement `backend/models/errors.go` with sentinel errors: `ErrVaultLocked`, `ErrVaultAlreadyExists`, `ErrVaultNotFound`, `ErrRecordNotFound`, `ErrWrongPassword`

**Verify:**
- [x] 2-7. Go test: call `db.Open()`, query `sqlite_master`, assert all 3 tables exist (`vault_meta`, `records`, `secret_history`)
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

- [x] 4-1. Implement `CreateRecord(db, key, input)` — UUID v4 id, build `search_hint` per type (`name\tusername` for `password`; `name` only for `api_key`), store `record_type`, encrypt, insert
- [x] 4-2. Implement `ListRecords(db, key, query)` — filter by `search_hint LIKE ?`, `WHERE deleted_at IS NULL`, apply `maskUsername` for `password` type only (empty for `api_key`)
- [x] 4-3. Implement `GetRecord(db, key, id)` — decrypt on demand
- [x] 4-4. Implement `UpdateRecord(db, key, id, input)` — save secret history if secret field changed (password for `password` type; secret key for `api_key` type), re-encrypt with fresh nonce
- [x] 4-5. Implement `DeleteRecord(db, id)` — sets `deleted_at = now()`
- [x] 4-6. Implement `RestoreRecord(db, id)` — sets `deleted_at = NULL`
- [x] 4-7. Implement `PurgeRecord(db, id)` — hard DELETE, guard requires `deleted_at IS NOT NULL`
- [x] 4-8. Implement `GetHistory(db, key, id)` — last 5 entries from `secret_history`, decrypt secret values
- [x] 4-9. Implement `PurgeExpiredTrash(db)` — DELETE where `deleted_at < now() - 30 days`
- [x] 4-10. Implement `maskUsername(username string) string` exactly as specified in `TECH_DESIGN_v2.md` §5
- [x] 4-11. Implement `Generate(opts GeneratorOptions) (string, error)` in `generator.go`:
  - [x] 4-11-1. Build character pool from enabled sets (lowercase always included)
  - [x] 4-11-2. Guarantee at least one char from each enabled set
  - [x] 4-11-3. Fill remaining length from full pool via `crypto/rand`
  - [x] 4-11-4. Fisher-Yates shuffle using `crypto/rand`
  - [x] 4-11-5. Return error if `opts.Length < 8`

**Verify:**
- [x] 4-12. Unit test: `CreateRecord` + `GetRecord` round-trip — for both `password` and `api_key` types; decrypted values match input
- [x] 4-13. Unit test: `ListRecords` with query — matching by name for both types; matching by username for `password` type only
- [x] 4-14. Unit test: `UpdateRecord` with secret field change — `secret_history` row inserted, old value recoverable via `GetHistory`
- [x] 4-15. Unit test: `maskUsername` — verify all four cases from `TECH_DESIGN_v2.md` §5
- [x] 4-16. Unit test: `Generate` — assert correct length, each enabled char class present
- [x] 4-17. `go test ./backend/vault/...` passes

---

## Phase 5 — App Struct & Wails Wiring (Go)

- [x] 5-1. Implement `App` struct in `backend/app.go` with fields `ctx`, `db`, `session`
- [x] 5-2. Implement `startup(ctx)`: open DB, call `PurgeExpiredTrash`
- [x] 5-3. Implement `shutdown(ctx)`: call `session.Lock()`, close DB
- [x] 5-4. Implement `VaultCreate(password string) error`
- [x] 5-5. Implement `VaultUnlock(password string) error`
- [x] 5-6. Implement `VaultLock() error`
- [x] 5-7. Implement `VaultIsUnlocked() bool`
- [x] 5-8. Implement `RecordCreate(input RecordInput) (string, error)` — guard with `IsUnlocked()`
- [x] 5-9. Implement `RecordList(query string) ([]RecordSummary, error)` — guard with `IsUnlocked()`
- [x] 5-10. Implement `RecordGet(id string) (RecordDetail, error)` — guard with `IsUnlocked()`
- [x] 5-11. Implement `RecordUpdate(id string, data RecordInput) error` — guard with `IsUnlocked()`
- [x] 5-12. Implement `RecordDelete(id string) error` — guard with `IsUnlocked()`
- [x] 5-13. Implement `RecordRestore(id string) error` — guard with `IsUnlocked()`
- [x] 5-14. Implement `RecordPurge(id string) error` — guard with `IsUnlocked()`
- [x] 5-15. Implement `RecordHistory(id string) ([]SecretHistory, error)` — guard with `IsUnlocked()`
- [x] 5-16. Implement `PasswordGenerate(opts GeneratorOptions) (string, error)`
- [x] 5-17. Implement `ClipboardCopy(value string, timeoutSecs int) error` — write to OS clipboard, goroutine clears after timeout
- [x] 5-18. Register `App` in `backend/main.go` with `wails.Run`

**Verify:**
- [x] 5-19. `wails build` produces a binary with no errors
- [x] 5-20. Run binary — app window opens
- [x] 5-21. In Wails dev tools console: `window['go']['main']['App']['VaultIsUnlocked']()` returns `false`

---

## Phase 6 — Frontend: Vault Lock Screen

- [x] 6-1. Implement `useVault.ts` hook: `isUnlocked`, `unlock(password)`, `lock()`, `createVault(password)`
- [x] 6-2. Add auto-lock in `useVault.ts`: reset `setTimeout` on `mousemove` and `keydown`; call `lock()` on expiry (default 5 min)
- [x] 6-3. Implement `LockView.tsx` — "Create vault" form (first launch): password + confirm fields
- [x] 6-4. Implement `LockView.tsx` — "Unlock vault" form (subsequent launches): single password field
- [x] 6-5. Call `VaultCreate` or `VaultUnlock` on submit; show inline error on failure
- [x] 6-6. On success: transition to main layout (`ListView`)
- [x] 6-7. Wire `App.tsx` to render `LockView` when locked, main layout when unlocked

**Verify:**
- [x] 6-8. Create a vault — app transitions to empty list view
- [x] 6-9. Lock the vault — lock screen reappears
- [x] 6-10. Enter wrong password — error message shown
- [x] 6-11. Enter correct password — unlock succeeds and list view shown

---

## Phase 7 — Frontend: Record List & Search

- [x] 7-1. Implement `useRecords.ts` hook with `list(query)`, `get(id)`, `create(input)`, `update(id, input)`, `remove(id)`, `restore(id)`, `purge(id)`
- [x] 7-2. Implement `RecordCard.tsx` — display `name`, record `type` badge, and `username_masked` (for `password` type); no secret field shown
- [x] 7-3. Implement `ListView.tsx` — search bar at top, debounced (150ms) call to `RecordList` on every keystroke
- [x] 7-4. Render list of `RecordCard` components in `ListView`
- [x] 7-5. "New record" button in `ListView` — navigate to `FormView` in create mode
- [x] 7-6. Clicking a `RecordCard` — navigate to `DetailView`

**Verify:**
- [x] 7-7. Create 3 records (at least one of each type); all appear in the list with correct type badge
- [x] 7-8. Search by name — only matching records shown (both types)
- [x] 7-9. Search by username — only matching `password` type records shown (api_key records not matched by username)
- [x] 7-10. Clear search — all records shown

---

## Phase 8 — Frontend: Record Detail View

- [x] 8-1. Implement `ConfirmDialog.tsx` — reusable modal with confirm/cancel
- [x] 8-2. Implement `useClipboard.ts` — wraps `ClipboardCopy`, shows "Copied!" toast for 2 seconds
- [x] 8-3. Implement `DetailView.tsx` — call `RecordGet(id)` on mount; branch rendering on `type`
- [x] 8-4. **Password type:** display `username_masked`; add "show" toggle to reveal full username
- [x] 8-5. **Password type:** display password as `••••••••` by default; "reveal" button toggles visibility (use `font-mono`); "Copy password" button — calls `ClipboardCopy(password, 30)`
- [x] 8-5a. **API key type:** display secret key as `••••••••` by default; "reveal" button toggles visibility (use `font-mono`); "Copy key" button — calls `ClipboardCopy(secret_key, 30)`
- [x] 8-6. "Copy username" button (password type only) — calls `ClipboardCopy(username, 30)`
- [x] 8-7. Display URL (password type only), notes, tags if present
- [x] 8-8. "Edit" button — navigate to `FormView` in edit mode
- [x] 8-9. "Delete" button — show `ConfirmDialog` → call `RecordDelete(id)` → back to `ListView`

**Verify:**
- [x] 8-10. Open a `password` record — password shows as dots; username masked
- [x] 8-11. Open an `api_key` record — secret key shows as dots; no username field shown
- [x] 8-12. Click reveal on either type — plaintext appears
- [x] 8-13. Click copy on either type — clipboard contains the secret value
- [x] 8-14. Wait 30 seconds — clipboard is cleared
- [x] 8-15. Click delete → confirm dialog appears → confirm → record gone from list

---

## Phase 9 — Frontend: Create & Edit Form

- [x] 9-1. Implement `PasswordField.tsx` — show/hide toggle, "Generate" button calls `PasswordGenerate` and fills field
- [x] 9-2. Add generator options UI to `PasswordField`: length slider (min 8, default 20), symbol/number/uppercase toggles
- [x] 9-3. Implement `FormView.tsx` in create mode — type selector (`password` / `api_key`) at top; fields adapt to type:
  - `password`: Name (required), Username (required), Password (required, with generator), URL, Notes, Tags
  - `api_key`: Name (required), Key/Token (required), Notes, Tags
- [x] 9-4. Implement `FormView.tsx` in edit mode — pre-fill all fields from `RecordDetail`; type is fixed (cannot be changed after creation)
- [x] 9-5. Validate required fields before submit; show inline errors, make no API call if invalid
- [x] 9-6. Save in create mode — call `RecordCreate` → navigate to `DetailView`
- [x] 9-7. Save in edit mode — call `RecordUpdate` → navigate to `DetailView`
- [x] 9-8. Cancel — navigate back without saving

**Verify:**
- [x] 9-9. Create a `password` record via the form — it appears in the list with correct type badge
- [x] 9-9a. Create an `api_key` record via the form — it appears in the list with correct type badge
- [x] 9-10. Edit the secret field of either type — old value appears in history
- [x] 9-11. Leave required field empty (per type) — validation error shown, no API call made
- [x] 9-12. Click cancel — no record created or modified

---

## Phase 10 — Security Hardening & Final Checks

- [x] 10-1. Test vault key zeroing: lock vault, assert `session.key == [32]byte{}`
- [x] 10-2. Code review `crypto.go`: confirm `crypto/rand.Read` used for every nonce, no nonce reused
- [x] 10-3. Code review `records.go` `CreateRecord` and `UpdateRecord`: confirm `search_hint` never includes secret values, URL, or notes; confirm `password` type uses `name\tusername` and `api_key` type uses `name` only
- [x] 10-4. Code review all `App` methods: confirm every record method returns `ErrVaultLocked` if session is locked
- [x] 10-5. Check `wails.json` CSP field: confirm it denies all external origins
- [x] 10-6. Manual test clipboard auto-clear: copy a password, wait 30 seconds, assert clipboard is empty
- [x] 10-7. Test trash auto-purge: insert record with `deleted_at = now() - 31 days`, call `PurgeExpiredTrash`, assert record is gone
- [x] 10-8. Run `grep -r "math/rand" backend/` — assert no results
- [x] 10-9. Run app with network monitoring (`lsof -i`): assert no external connections on startup or normal use

**Verify:**
- [x] 10-10. All checklist items 10-1 through 10-9 pass
- [x] 10-11. `go test ./...` passes with no failures
- [x] 10-12. `wails build` produces a release binary
- [x] 10-13. Smoke test release binary end-to-end:
  - [x] 10-13-1. Create vault
  - [x] 10-13-2. Add a record
  - [x] 10-13-3. Search for the record
  - [x] 10-13-4. Reveal password
  - [x] 10-13-5. Copy password
  - [x] 10-13-6. Edit the record
  - [x] 10-13-7. Delete the record
  - [x] 10-13-8. Restore from trash
  - [x] 10-13-9. Permanently purge
