CREATE TABLE "folder_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folder_connectors_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "folder_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"binding_id" uuid NOT NULL,
	"connector_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"state" text DEFAULT 'waiting' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folder_jobs_binding_id_unique" UNIQUE("binding_id")
);
--> statement-breakpoint
CREATE TABLE "intake_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"assignee_id" uuid,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"matter_id" uuid,
	"reviewed_by" uuid,
	"conflict_contact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matter_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"relative_path" text,
	"local_root" text,
	"template_version" text,
	"drive_folder_id" text,
	"drive_folder_url" text,
	"local_status" text DEFAULT 'waiting' NOT NULL,
	"discovery_status" text DEFAULT 'waiting' NOT NULL,
	"discovery_error" text,
	"discovery_attempts" integer DEFAULT 0 NOT NULL,
	"next_discovery_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_verification" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "message_key" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "message_values" jsonb;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "folder_setup_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "folder_root" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "folder_mapping_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "folder_connector_id" uuid;--> statement-breakpoint
ALTER TABLE "folder_jobs" ADD CONSTRAINT "folder_jobs_binding_id_matter_folders_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."matter_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_jobs" ADD CONSTRAINT "folder_jobs_connector_id_folder_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."folder_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_drafts" ADD CONSTRAINT "intake_drafts_assignee_id_staff_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_drafts" ADD CONSTRAINT "intake_drafts_updated_by_staff_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_reviewed_by_staff_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_folders" ADD CONSTRAINT "matter_folders_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folder_jobs_queue_idx" ON "folder_jobs" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "matter_folders_matter_idx" ON "matter_folders" USING btree ("matter_id");
--> statement-breakpoint
CREATE UNIQUE INDEX matter_folders_managed_unique ON matter_folders(matter_id) WHERE origin = 'managed';
--> statement-breakpoint
INSERT INTO matter_folders (matter_id, origin, drive_folder_id, drive_folder_url, local_status, discovery_status)
SELECT id, 'legacy', drive_folder_id, drive_folder_url, 'unlinked', 'linked' FROM matters WHERE drive_folder_id IS NOT NULL;

--> statement-breakpoint
ALTER TABLE intake_drafts ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE folder_connectors ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE folder_jobs ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE matter_folders ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
REVOKE ALL ON intake_drafts, intake_submissions, folder_connectors, folder_jobs, matter_folders FROM anon, authenticated;
END IF; END $$;
