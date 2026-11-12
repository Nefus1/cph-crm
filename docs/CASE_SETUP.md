# Intake drafts and unified case setup

## Staff workflow

Use **New intake** or the **Case Generator** shortcut. Save unfinished intake with **Save intake draft**; it appears in **Saved intakes** with its assignee and last-saved time. Any invited staff member can resume it. Saving is explicit, not automatic. A stale save or submission is rejected; keep that screen open and compare the saved version in another tab. No client, matter, payment, or folder is created from a draft until final submission.

Review the client, parties, fees, attorney if supplied, and folder action before creating the matter. Potential conflict matches assist staff review and are not a determination of whether a conflict exists. Final submission records the reviewer and matching contact IDs. Repeating a submission returns the same matter and does not duplicate charges or payments.

The language button in the header switches English/Español independently for each employee. Client names, notes, folder names, and historical free-text timeline entries keep their original text. New system timeline entries store translation keys and values.

The **Files** tab shows each linked folder, local setup status, and Google discovery status. Local folder setup happens on the Windows connector PC. Google folders are discovered through the existing one-way Synology → Google sync; the CRM does not create a competing Google folder tree.

For existing cases, an administrator pastes a specific Google folder ID, previews its path under the configured Cases root, then explicitly confirms the link. Repeat to link multiple folders. Only confirm the local-path checkbox after verifying the same relative path exists on Synology. Existing linked folders, documents, and record IDs are retained.

## Deployment order

1. Take the normal production database backup and retain the original generator ZIP. Do not seed or reset production data.
2. Apply additive migrations with `npm run db:migrate`, then deploy the application. New tables have RLS enabled with no browser policies, following the existing server-only access model. Legacy Drive links are backfilled as legacy bindings. Automatic folder setup starts disabled.
3. Build the Windows package with `python scripts/package-connector.py`. Follow [connector installation](../connector/README.md).
4. Use a disposable test matter to confirm actual Windows folder creation, starter files, Google discovery, and bilingual status. The administrator can only enable automatic setup after this succeeds.
5. Enable automatic setup. Monitor **Folder setup** for device heartbeat and each matter's **Files** tab for jobs needing attention. The connector's heartbeat also runs bounded Google discovery batches, independent of folder creation retries. Staff can request an immediate discovery check from Files.

Mapping edits invalidate verification. Existing managed bindings keep their original local and Google roots and template version. Editing a client's name or practice area does not rename an already allocated folder. Disabling setup stops normal job claims and new folder requests; existing records and folders remain accessible. Verification jobs may still run while setup is disabled. In-flight filesystem work cannot be recalled.

The office connector requires outbound HTTPS to the CRM, access to its configured Windows Cases folder, and the existing Synology sync setup. No cloud deployment, production migration, credential registration, NAS access, or real file-sync validation is performed by the automated local checks.

## Implementation interfaces

- Intake draft actions use an ID plus expected version. Draft saves, discards, and submissions share a transaction advisory lock; final submission also has a unique submission record.
- Folder requests create a durable binding and job in the intake transaction. New folders use `Matter number — Last, First — Type (Side)` with Windows-safe Unicode naming. Template `cph-1` freezes the uploaded generator's UD, divorce, estate-planning, and general structures; other supported types use the CRM's standard subfolders.
- `POST /api/connector/claim`, `/heartbeat`, `/complete`, and `/failure` require a device bearer token stored hashed in the CRM. Claim uses row locking, a two-minute lease, and a random lease token. Only the assigned device can acknowledge the active lease. Repeated completion acknowledgments are idempotent.
- Revoking a device disables automatic setup when that device is selected. Failed jobs retain their identities and never adopt unrelated existing folders. Keep the original root mapping when replacing a connector and verify it before retrying pending work.

## Validation

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` cover the app. Run database transaction tests only against a local database named `cph_test` after migrations:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/cph_test RUN_DB_TESTS=1 npx vitest run tests/intake-folders.integration.test.ts
python -m unittest discover -s connector -p 'test_*.py' -v
```

Database tests truncate fixture tables and refuse nonlocal or differently named databases. Browser tests seed/reset the dedicated test database; never point `E2E_DATABASE_URL` at production. Windows CI exercises connector filesystem behavior; final office acceptance still requires the real sync test above.
