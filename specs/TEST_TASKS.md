# TEST_TASKS.md — passwd Automation Test Checklist

## Backend Tests

Run with:
```bash
GO111MODULE=on go test ./backend/... -v
```

---

### Crypto Layer (`backend/vault/crypto_test.go`)

- [x] `TestEncryptDecrypt_RoundTrip` — encrypt then decrypt produces original plaintext
- [x] `TestDecrypt_TamperedCiphertext` — flipping a byte causes Decrypt to return an error
- [x] `TestEncrypt_UniqueNonces` — two encryptions of identical plaintext produce different nonces
- [x] `TestVaultSession_LockZerosKey` — Lock() zeroes the key and sets unlocked=false
- [x] `TestVaultSession_KeyReturnsErrorWhenLocked` — Key() returns error when session is locked

---

### Database Layer (`backend/vault/db_test.go`)

- [x] `TestOpen_CreatesTablesAndIndexes` — all 3 tables and 3 indexes exist after migration
- [x] `TestOpen_UsesConfigDir` — Open() resolves to the platform config directory

---

### Vault Metadata (`backend/vault/vault_meta_test.go`)

- [x] `TestVaultExists_FalseOnNewDB` — VaultExists returns false on an empty database
- [x] `TestSaveLoadVaultMeta_RoundTrip` — salt, verifier, and nonce survive a save/load round-trip
- [x] `TestVaultExists_TrueAfterSave` — VaultExists returns true after SaveVaultMeta
- [x] `TestSaveVaultMeta_DuplicateInsertFails` — inserting vault_meta twice returns a constraint error

---

### Password Generator (`backend/vault/records_test.go` + `backend/vault/generator_test.go`)

- [x] `TestGenerate` — correct length; each enabled character class (lower, upper, number, symbol) present
- [x] `TestGenerate_MinLengthError` — length < 8 returns an error
- [x] `TestGenerate_LowercaseOnly` — all optional sets disabled → only lowercase output
- [x] `TestGenerate_NoUppercaseWhenDisabled` — UseUppercase=false → no uppercase chars
- [x] `TestGenerate_NoNumbersWhenDisabled` — UseNumbers=false → no digit chars
- [x] `TestGenerate_NoSymbolsWhenDisabled` — UseSymbols=false → no symbol chars
- [x] `TestGenerate_LengthBoundaries` — lengths 8, 16, 32, 64 all produce exactly the right length
- [x] `TestGenerate_UniqueOutputs` — 20 consecutive calls produce 20 distinct passwords
- [x] `TestGenerate_AtLeastOneFromEachEnabledSet` — 50 iterations, each guarantees ≥1 char per enabled set

---

### Record CRUD (`backend/vault/records_test.go`)

- [x] `TestCreateGetRecord_RoundTrip` — password-type round-trip: all fields decrypt correctly, username masked
- [x] `TestCreateGetRecord_APIKey_RoundTrip` — api_key-type round-trip: secret_key decrypts; username fields empty
- [x] `TestCreateGetRecord_TagsRoundTrip` — tags array preserved through create/get
- [x] `TestListRecords_QueryFilter` — name filter works for both types; username filter only matches password type; api_key has empty username_masked
- [x] `TestUpdateRecord_PasswordHistory` — updating password saves old value to secret_history
- [x] `TestUpdateRecord_APIKey_SecretHistory` — updating secret_key saves old value to secret_history
- [x] `TestUpdateRecord_HistoryCappedAt5` — 7 updates → at most 5 history entries
- [x] `TestMaskUsername` — all four spec cases: short, exact-5, >5, with special chars
- [x] `TestPurgeExpiredTrash` — record with deleted_at = now−31d is removed by PurgeExpiredTrash
- [x] `TestSoftDeleteRestorePurge` — delete hides record; restore unhides; purge permanently removes; purging active record fails

---

### Security Properties (`backend/vault/security_test.go`)

- [x] `TestSearchHint_NeverContainsSecretFields_Password` — search_hint excludes password, URL, and notes; contains name and username
- [x] `TestSearchHint_NeverContainsSecretFields_APIKey` — search_hint excludes secret_key and notes; contains only name; no tab separator
- [x] `TestSearchHint_Format_PasswordType` — search_hint = `{name}\t{username}` (tab-separated, lowercased)
- [x] `TestSearchHint_UpdatedOnRecordUpdate` — search_hint reflects new name/username after update
- [x] `TestUpdateRecord_NoHistoryWhenSecretUnchanged` — updating non-secret fields creates no history entry
- [x] `TestGetRecord_NotFound` — GetRecord returns error for unknown ID
- [x] `TestGetRecord_WrongKeyFails` — GetRecord with wrong vault key returns decryption error
- [x] `TestListDeletedRecords_OnlyDeleted` — ListDeletedRecords returns only soft-deleted records; active list unchanged

---

### App Integration (`backend/app_test.go`)

- [x] `TestApp_VaultCreate_SetsUnlocked` — VaultCreate unlocks the session immediately
- [x] `TestApp_VaultCreate_DuplicateFails` — second VaultCreate returns ErrVaultAlreadyExists
- [x] `TestApp_VaultUnlock_WrongPassword` — wrong password returns ErrWrongPassword; session stays locked
- [x] `TestApp_VaultUnlock_CorrectPassword` — correct password unlocks the session
- [x] `TestApp_LockedVault_RejectsRecordOperations` — all 8 record methods return ErrVaultLocked when session is locked
- [x] `TestApp_RecordCRUD_Integration` — full flow: create → list → get → update → history → delete → restore → purge
- [x] `TestApp_VaultChangeMasterPassword` — new password works after change; old password rejected
- [x] `TestApp_VaultChangeMasterPassword_WrongCurrentFails` — wrong current password returns ErrWrongPassword; session remains unlocked
- [x] `TestApp_PasswordGenerate_Basic` — PasswordGenerate returns correct-length output

---

## Frontend Tests

Stack: **Vitest** + **React Testing Library** + **jsdom**. Wails bindings are mocked — no Go runtime required.

Run with:
```bash
cd frontend && npm test
```

---

### Journey Tests (`src/__tests__/journeys/`)

These tests render the full `<App />` component with all Wails bindings mocked and simulate complete user flows across view transitions.

> **Status: All implemented and run 2026-03-08.**

---

#### Journey: First Launch — Create Vault (`src/__tests__/journeys/createVault.journey.test.tsx`)

- [x] app renders the lock screen in "Create vault" mode when `VaultExists` returns false
- [x] submitting a password shorter than 8 characters shows an inline error; `VaultCreate` is not called
- [x] submitting mismatched passwords shows "Passwords do not match" error; `VaultCreate` is not called
- [x] submitting valid matching passwords calls `VaultCreate` and transitions to the list view
- [x] the list view shows "No records yet." after a fresh vault creation

---

#### Journey: Returning User — Unlock Vault (`src/__tests__/journeys/unlockVault.journey.test.tsx`)

- [x] app renders the lock screen in "Unlock vault" mode when `VaultExists` returns true and vault is locked
- [x] entering the wrong password shows the backend error message; user remains on lock screen
- [x] entering the correct password calls `VaultUnlock` and transitions to the list view
- [x] clicking the Lock button from the list view calls `VaultLock` and returns to the lock screen
- [~] after auto-lock timeout fires (mocked via `vi.useFakeTimers`), the app returns to the lock screen — TIMED OUT (5000ms)

---

#### Journey: Create a Password Record (`src/__tests__/journeys/createPasswordRecord.journey.test.tsx`)

- [x] clicking "+ New" from the list view opens the form in create mode with empty fields and "Password" type selected
- [x] the type selector is visible in create mode
- [x] submitting the form with Name empty shows a validation error and does not call `RecordCreate`
- [x] submitting the form with Username empty shows a validation error and does not call `RecordCreate`
- [x] filling all required fields and submitting calls `RecordCreate` with the correct payload
- [x] after successful create, the app navigates back to the list view (not detail view)
- [x] the newly created record name appears in the list
- [x] clicking Cancel from the create form returns to the list view without calling `RecordCreate`

---

#### Journey: Create an API Key Record (`src/__tests__/journeys/createApiKeyRecord.journey.test.tsx`)

- [x] selecting "API Key" type hides the Username field and shows "Key / Token" field
- [x] submitting with Key / Token empty shows a validation error; `RecordCreate` is not called
- [x] submitting a valid API key record calls `RecordCreate` with `type: "api_key"` and no username
- [x] after save, the record appears in the list with an "API Key" badge and no username shown

---

#### Journey: View Record Detail (`src/__tests__/journeys/viewDetail.journey.test.tsx`)

- [x] clicking a record card in the list navigates to the detail view showing the record name
- [x] the password field shows `••••••••` by default on the detail view
- [x] clicking "Reveal" shows the plaintext password; clicking "Hide" masks it again
- [x] username is shown masked by default; clicking "Show" reveals full username; "Hide" re-masks it
- [x] clicking "Copy" on the password field calls `ClipboardCopy` with the password value and shows "Copied!" label
- [x] "Copied!" label reverts to "Copy" after 2 seconds
- [x] clicking "← Back" from the detail view returns to the list view
- [x] URL, Notes, and Tags fields render "—" when empty

---

#### Journey: Edit a Record (`src/__tests__/journeys/editRecord.journey.test.tsx`)

- [x] clicking "Edit" from the detail view navigates to the form pre-filled with the record's current values
- [x] the type selector is NOT visible in edit mode
- [x] changing the name and saving calls `RecordUpdate` with the new name; navigates back to detail view
- [x] changing the password and saving calls `RecordUpdate`; the updated password is shown on the detail view
- [x] clicking Cancel from the edit form returns to the detail view without calling `RecordUpdate`
- [x] clicking the inline Edit (⋮ menu) on a record card in the list navigates directly to the edit form

---

#### Journey: Delete a Record (`src/__tests__/journeys/deleteRecord.journey.test.tsx`)

- [x] clicking "Delete" on the detail view shows a confirm dialog with the record name in the message
- [x] clicking "Cancel" in the confirm dialog dismisses it; the record is still shown; `RecordDelete` is not called
- [x] clicking "Delete" in the confirm dialog calls `RecordDelete` and navigates back to the list view
- [x] the deleted record no longer appears in the list after deletion
- [x] clicking Delete (⋮ menu) on a record card in the list shows the confirm dialog; confirming removes it from the list

---

#### Journey: Trash — Restore & Purge (`src/__tests__/journeys/trash.journey.test.tsx`)

- [x] clicking "Trash" from the list view navigates to the trash view
- [x] the trash view shows deleted records; active records are not listed
- [x] clicking "Restore" on a trash item calls `RecordRestore` and removes the item from the trash list
- [x] clicking "Delete" on a trash item shows a confirm dialog with "cannot be undone" warning
- [x] cancelling the purge confirm dialog keeps the item in the trash list
- [x] confirming the purge dialog calls `RecordPurge` and removes the item from the trash list
- [x] clicking "← Back" from the trash view returns to the list view
- [x] after restoring a record, it reappears in the main list view

---

#### Journey: Search Records (`src/__tests__/journeys/search.journey.test.tsx`)

- [x] list view shows all records on load (empty query)
- [x] typing in the search box debounces 150 ms then calls `RecordList` with the typed query
- [x] only records matching the query are rendered; non-matching records are absent
- [x] clearing the search input restores the full record list
- [x] when no records match the query, "No records match your search." is shown
- [x] search works by record name (case-insensitive match via backend)
- [x] search works by username for password-type records

---

#### Journey: Password Generator in Form (`src/__tests__/journeys/passwordGenerator.journey.test.tsx`)

- [x] clicking "Generate" in the create form opens the generator options panel (length slider, toggles)
- [x] clicking "Generate password" in the options panel calls `PasswordGenerate` and fills the password field
- [x] the generated password is visible in the password input (not masked) after generation
- [x] disabling Symbols toggle and generating calls `PasswordGenerate` with `use_symbols: false`
- [x] adjusting the length slider and generating calls `PasswordGenerate` with the selected length
- [x] generated password is submitted as part of the record when the form is saved

---

#### Journey: Change Master Password (`src/__tests__/journeys/changeMasterPassword.journey.test.tsx`)

- [x] clicking "Settings" from the list view navigates to the Change Password view
- [x] submitting with the wrong current password shows the backend error; vault remains unlocked
- [x] submitting with a new password shorter than 8 characters shows a validation error
- [x] submitting with mismatched new passwords shows "Passwords do not match" error
- [x] submitting valid current + matching new passwords calls `VaultChangeMasterPassword` and returns to list view

---

### ConfirmDialog (`src/__tests__/ConfirmDialog.test.tsx`)

- [x] renders the message text
- [x] renders multi-line message split by `\n` (whitespace-pre-line)
- [x] calls `onConfirm` when Delete button is clicked
- [x] calls `onCancel` when Cancel button is clicked
- [x] renders both Cancel and Delete buttons

---

### RecordCard (`src/__tests__/RecordCard.test.tsx`)

- [x] renders record name
- [x] renders "Password" badge for password-type records
- [x] renders "API Key" badge for api_key-type records
- [x] renders masked username for password type
- [x] does not render username for api_key type
- [x] calls `onClick` with record id when the main card area is clicked
- [x] opens the ⋮ actions menu showing Edit and Delete on menu button click
- [x] calls `onEdit` with record id when Edit is selected
- [x] calls `onDelete` with record id when Delete is selected

---

### PasswordField (`src/__tests__/PasswordField.test.tsx`)

- [x] renders password input hidden by default (`type="password"`)
- [x] Show button reveals the password (`type="text"`)
- [x] Hide button hides the password again
- [x] shows error message when `error` prop is provided
- [x] does not show error when `error` prop is absent
- [x] Generate button opens the options panel (length slider, char-class toggles)
- [x] "Generate password" button calls `PasswordGenerate` binding and fills the field via `onChange`
- [x] calls `onChange` when user types in the input

---

### FormView (`src/__tests__/FormView.test.tsx`)

**Create mode:**
- [x] shows type selector (Password / API Key) in create mode
- [x] does not show type selector in edit mode
- [x] shows Name, Username, and Password fields for password type
- [x] shows Key / Token field (no Username) when API Key type is selected
- [x] validation error when Name is empty on submit; no API call made
- [x] validation error when Username is empty for password type; no API call made
- [x] validation error when Key/Token is empty for api_key type; no API call made
- [x] calls `RecordCreate` with correct payload on valid submit; calls `onSave` with new id
- [x] calls `onBack` when Cancel is clicked; no API call made

**Edit mode:**
- [x] pre-fills all fields from the existing record returned by `RecordGet`
- [x] calls `RecordUpdate` (not `RecordCreate`) on save; calls `onSave` with existing id

---

### useClipboard hook (`src/__tests__/useClipboard.test.ts`)

- [x] `copiedKey` is `null` initially
- [x] `copy()` sets `copiedKey` to the provided key and calls `ClipboardCopy(value, 30)`
- [x] `copiedKey` clears back to `null` after 2 seconds
- [x] `copiedKey` is still set before 2 seconds have elapsed
- [x] always calls `ClipboardCopy` with a 30-second timeout

---

## Coverage Summary

| Area | Tests | Status |
|------|-------|--------|
| **Backend** | | |
| Crypto (AES-GCM, Argon2id, session) | 5 | ✅ All pass |
| Database (schema, migration) | 2 | ✅ All pass |
| Vault metadata | 4 | ✅ All pass |
| Password generator | 9 | ✅ All pass |
| Record CRUD | 10 | ✅ All pass |
| Security properties | 8 | ✅ All pass |
| App integration | 9 | ✅ All pass |
| **Frontend — Unit** | | |
| ConfirmDialog component | 5 | ✅ All pass |
| RecordCard component | 9 | ✅ All pass |
| PasswordField component | 8 | ✅ All pass |
| FormView (create + edit) | 11 | ✅ All pass |
| useClipboard hook | 5 | ✅ All pass |
| **Frontend — Journeys** | | |
| Create vault (first launch) | 5 | ✅ All pass |
| Unlock vault (returning user) | 5 | ⚠️ 4 pass, 1 fail (auto-lock timeout) |
| Create password record | 8 | ✅ All pass |
| Create API key record | 4 | ✅ All pass |
| View record detail | 8 | ✅ All pass |
| Edit record | 6 | ✅ All pass |
| Delete record | 5 | ✅ All pass |
| Trash (restore & purge) | 8 | ✅ All pass |
| Search records | 7 | ✅ All pass |
| Password generator in form | 6 | ✅ All pass |
| Change master password | 5 | ✅ All pass |
| **Implemented total** | **142** | **104 pass, 1 fail** |
