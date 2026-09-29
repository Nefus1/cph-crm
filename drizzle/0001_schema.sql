CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid,
	"contact_id" uuid,
	"type" text DEFAULT 'note' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"google_refresh_token_enc" text,
	"google_email" text,
	"google_connected_at" timestamp with time zone,
	"cases_folder_id" text,
	"cases_folder_name" text,
	"calendar_id" text,
	"calendar_name" text,
	"default_supervising_attorney" text DEFAULT '' NOT NULL,
	"firm_name" text DEFAULT 'CPH' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"label" text NOT NULL,
	"label_es" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" uuid
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'person' NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"middle_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"org_name" text DEFAULT '' NOT NULL,
	"display_name" text NOT NULL,
	"preferred_language" text DEFAULT 'es' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"phone_digits" text DEFAULT '' NOT NULL,
	"phone_alt" text DEFAULT '' NOT NULL,
	"phone_alt_digits" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address_line1" text DEFAULT '' NOT NULL,
	"address_line2" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'CA' NOT NULL,
	"zip" text DEFAULT '' NOT NULL,
	"date_of_birth" date,
	"how_found_us" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"import_source" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "court_holidays" (
	"date" date PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid,
	"kind" text DEFAULT 'deadline' NOT NULL,
	"title" text NOT NULL,
	"all_day" boolean DEFAULT true NOT NULL,
	"date" date NOT NULL,
	"time" text,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"ladder" text DEFAULT 'none' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"computed_from" text,
	"gcal_event_id" text,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"sync_error" text,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amount_cents" integer NOT NULL,
	"entry_date" date DEFAULT now() NOT NULL,
	"method" text DEFAULT '' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matter_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"display_name" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"practice_area" text NOT NULL,
	"matter_type" text NOT NULL,
	"side" text DEFAULT 'na' NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"assignee_id" uuid,
	"supervising_attorney" text DEFAULT '' NOT NULL,
	"opened_on" date DEFAULT now() NOT NULL,
	"closed_on" date,
	"court" text DEFAULT 'Los Angeles Superior Court' NOT NULL,
	"courthouse" text DEFAULT '' NOT NULL,
	"case_number" text DEFAULT '' NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"judge" text DEFAULT '' NOT NULL,
	"fee_type" text DEFAULT 'flat' NOT NULL,
	"flat_fee_cents" integer DEFAULT 0 NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"drive_folder_id" text,
	"drive_folder_url" text,
	"drive_status" text DEFAULT 'none' NOT NULL,
	"drive_error" text,
	"import_source" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "matters_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_email_unique" UNIQUE("email"),
	CONSTRAINT "staff_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"assignee_id" uuid,
	"due_date" date,
	"urgent" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_author_id_staff_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_done_by_staff_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD CONSTRAINT "matter_parties_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_parties" ADD CONSTRAINT "matter_parties_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matters" ADD CONSTRAINT "matters_assignee_id_staff_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matters" ADD CONSTRAINT "matters_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_staff_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_staff_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_matter_idx" ON "activities" USING btree ("matter_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activities_contact_idx" ON "activities" USING btree ("contact_id","occurred_at");--> statement-breakpoint
CREATE INDEX "checklist_matter_idx" ON "checklist_items" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "contacts_display_name_trgm" ON "contacts" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "contacts_phone_digits_idx" ON "contacts" USING btree ("phone_digits");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "events_matter_idx" ON "events" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "events_sync_idx" ON "events" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "ledger_matter_idx" ON "ledger_entries" USING btree ("matter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matter_parties_unique" ON "matter_parties" USING btree ("matter_id","contact_id","role");--> statement-breakpoint
CREATE INDEX "matter_parties_contact_idx" ON "matter_parties" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "matters_area_status_idx" ON "matters" USING btree ("practice_area","status");--> statement-breakpoint
CREATE INDEX "matters_assignee_idx" ON "matters" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "matters_display_name_trgm" ON "matters" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "matters_case_number_idx" ON "matters" USING btree ("case_number");--> statement-breakpoint
CREATE INDEX "tasks_assignee_open_idx" ON "tasks" USING btree ("assignee_id","completed_at");--> statement-breakpoint
CREATE INDEX "tasks_matter_idx" ON "tasks" USING btree ("matter_id");