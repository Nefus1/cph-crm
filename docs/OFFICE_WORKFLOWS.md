# Office workflows

The Follow-ups queue tracks Gmail, Dialpad, and WhatsApp contact attempts. App links only open a composer; staff must record the outcome. Unresolved attempts require a new follow-up date. The client language determines the initial editable message. WhatsApp requires an explicit international phone number; copy the number for Dialpad when no link is available.

Paperwork items track preparation separately from supporting-document requests. Target dates are operational dates, not legal deadlines. PDFs, Word documents, and Clio Draft remain the authoring tools. File links must use HTTPS. Staff can assign preparation and review, link supporting-document requests to follow-ups, and copy saved case information. Administrators maintain bilingual checklists; staff preview and select items before applying them.

Case Progress lets staff select an existing open task as the next action, set a blocker and review date, and pin a note. Today surfaces due follow-ups, paperwork awaiting review, overdue scheduled events, and matters without an open next action. Completed next actions are no longer displayed as outstanding.

## Release

Migration 0005 is additive and preserves existing record identifiers and content. Run database migrations before starting this application version. Do not point preview builds at an unmigrated production database. Existing production build automation applies migrations only for production deployments.

No automatic client messaging, mailbox ingestion, Dialpad synchronization, WhatsApp API messaging, form filling, or Clio Draft API integration is enabled. Google Sheets and OneNote remain untouched.

## Checks

Use the isolated local `cph_test` database for integration/browser tests. Run transaction suites sequentially: the older intake suite truncates shared test tables. Unit tests do not require a database. Browser setup resets fixture records and must never target production.
