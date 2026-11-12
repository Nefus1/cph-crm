# CPH Windows Folder Connector

This replaces the old generator's local Flask server with an outbound background connector. The **Case Generator** shortcut opens a focused CRM screen using the same invited Google staff accounts as the rest of the CRM. No inbound router ports, public NAS endpoint, or browser access to a local drive is required.

## Install on the generator PC

1. Keep the original Legal Case Generator ZIP unchanged for rollback. Stop its old startup shortcut/server when switching to the new workflow; do not run both folder-writing workflows during cutover.
2. Install Python 3.11 or newer for the Windows user who runs Synology Drive. Extract this package to `C:\CPH\Connector`. It uses only Python's standard library; Flask is no longer needed.
3. In the CRM, open **Settings → Folder setup**, register this computer, and copy its one-time device token. Copy `config.example.json` to `config.json`, enter the HTTPS CRM address, token, and existing Windows Cases path. Keep this file private to the connector user and administrators using Windows file permissions. Do not put the connector configuration in the synced Cases tree.
4. Select the device and enter the **same Windows path** in CRM Folder setup. Save with automatic setup disabled. In **Settings → Google**, select the corresponding Cases folder receiving your existing Synology → Google sync. Do not change your sync direction.
5. Test locally in PowerShell: `python .\connector.py --config .\config.json --once`. Check the device appears online in CRM Folder setup. A revoked token exits the connector; register a replacement instead of retrying it.
6. Run `.\install.ps1` from PowerShell under the same Windows user. If execution policy blocks local scripts, use your normal approved procedure for running a reviewed local script. The script registers an at-logon task, starts it, and creates a desktop shortcut. Synology Drive must also run for that user. The computer must remain powered on and signed in for this per-user connector; queued CRM intake remains available while it is offline.
7. Create a clearly named disposable test matter in the CRM **without** the normal folder checkbox. In Case Generator, select it and expand **Verify setup with a test matter**. Create verification folders, then inspect the local folder and its Google copy. In the matter's Files tab, click **Confirm this mapping works** once the Google folder is linked. Enable automatic setup in Folder setup only after this check.

A lost acknowledgment is safe: the matter identity marker lets retries resume the same folder. Existing notes are never overwritten. An existing folder without the matching identity marker is rejected, not adopted. Use the administrator's **Link an existing folder** preview for existing cases.

The worker polls every 15 seconds while online. Network errors back off to five minutes; folder-job failures back off to one hour, with eight attempts before manual attention. The Files tab shows local and Google status separately. Use **Retry / check Google copy** after fixing a problem. Google discovery confirms the folder exists, not that all files are synchronized.

Logs rotate at 1 MB (three backups) and contain job IDs and error codes, not names, paths, or tokens. The credential can claim only that device's jobs and acknowledge its active leases; it cannot query client records, change billing, or submit intake.

## Disable or roll back

Disable automatic folder setup in the CRM first. Allow an already-running job to finish, then stop the Windows task with `Stop-ScheduledTask -TaskName 'CPH Folder Connector'`. Revoke its token if retiring the PC. Retain CRM records and additive migrations. Re-enable the original generator only after stopping the new connector; link folders it creates explicitly to the correct CRM matter. Nothing automatically renames, moves, deletes, or merges existing folders.

## Tests

Run `python -m unittest discover -s . -p 'test_*.py' -v`. CI runs these on Windows and Linux. Windows junction and symlink checks need filesystem support and appropriate permissions. A real Synology/Google synchronization test must still be completed on the office PC; a local test cannot verify your actual sync mapping.
