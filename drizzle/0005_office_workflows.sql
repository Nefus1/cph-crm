CREATE TABLE "document_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"follow_up_task_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paperwork_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"title" text NOT NULL,
	"form_number" text DEFAULT '' NOT NULL,
	"revision" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'pdf' NOT NULL,
	"file_url" text DEFAULT '' NOT NULL,
	"preparer_id" uuid,
	"reviewer_id" uuid,
	"target_date" date,
	"missing_information" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'needed' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paperwork_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_area" text NOT NULL,
	"title" text NOT NULL,
	"items" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_mutations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "next_action_id" uuid;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "blocker" text;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "blocker_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "blocker_review_date" date;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "pinned_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "matters" ADD COLUMN "workflow_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "category" text DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "waiting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_follow_up_task_id_tasks_id_fk" FOREIGN KEY ("follow_up_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_updated_by_staff_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paperwork_items" ADD CONSTRAINT "paperwork_items_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paperwork_items" ADD CONSTRAINT "paperwork_items_preparer_id_staff_id_fk" FOREIGN KEY ("preparer_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paperwork_items" ADD CONSTRAINT "paperwork_items_reviewer_id_staff_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paperwork_items" ADD CONSTRAINT "paperwork_items_updated_by_staff_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_mutations" ADD CONSTRAINT "workflow_mutations_actor_id_staff_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_requests_matter_idx" ON "document_requests" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "paperwork_matter_idx" ON "paperwork_items" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX "paperwork_review_idx" ON "paperwork_items" USING btree ("reviewer_id","status");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;