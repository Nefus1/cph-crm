/** Reset integration state only in the disposable local browser-test database. */
import postgres from "postgres";
const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/cph_test")
  throw new Error("Browser tests require an isolated local cph_test database");
const client = postgres(url.toString(), { max: 1, prepare: false, onnotice: () => {} });
async function main() {
  await client`truncate intake_drafts, folder_connectors restart identity cascade`;
  await client`update staff set locale = 'en'`;
  await client`update app_settings set folder_setup_enabled = false, folder_root = '', folder_connector_id = null, folder_mapping_verified_at = null,
    google_refresh_token_enc = null, google_email = null, google_connected_at = null, cases_folder_id = null, cases_folder_name = null, calendar_id = null, calendar_name = null where id = 1`;
  await client.end();
}
main().catch(async (error) => {
  console.error(error);
  await client.end();
  process.exitCode = 1;
});
