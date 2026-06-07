CREATE TYPE "public"."offline_draft_status" AS ENUM('pending', 'synced', 'conflict', 'failed');--> statement-breakpoint
CREATE TYPE "public"."offline_draft_type" AS ENUM('handover', 'issue', 'task_note');--> statement-breakpoint
CREATE TABLE "inspector_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"eco_mode_enabled" boolean DEFAULT true NOT NULL,
	"low_data_mode_enabled" boolean DEFAULT true NOT NULL,
	"compact_mode_enabled" boolean DEFAULT true NOT NULL,
	"dark_mode_preferred" boolean DEFAULT true NOT NULL,
	"background_sync_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offline_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"local_draft_id" text NOT NULL,
	"draft_type" "offline_draft_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "offline_draft_status" DEFAULT 'pending' NOT NULL,
	"synced_entity_type" text,
	"synced_entity_id" text,
	"error_code" text,
	"error_message" text,
	"client_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedure_acknowledgements" (
	"id" text PRIMARY KEY NOT NULL,
	"procedure_version_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"understood_at" timestamp with time zone,
	"critical_confirmed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspector_settings" ADD CONSTRAINT "inspector_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_drafts" ADD CONSTRAINT "offline_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_acknowledgements" ADD CONSTRAINT "procedure_acknowledgements_procedure_version_id_procedure_versions_id_fk" FOREIGN KEY ("procedure_version_id") REFERENCES "public"."procedure_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_acknowledgements" ADD CONSTRAINT "procedure_acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inspector_settings_updated_at_idx" ON "inspector_settings" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "offline_drafts_user_local_idx" ON "offline_drafts" USING btree ("user_id","local_draft_id");--> statement-breakpoint
CREATE INDEX "offline_drafts_user_id_idx" ON "offline_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "offline_drafts_status_idx" ON "offline_drafts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "offline_drafts_type_idx" ON "offline_drafts" USING btree ("draft_type");--> statement-breakpoint
CREATE INDEX "offline_drafts_updated_at_idx" ON "offline_drafts" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "procedure_ack_user_version_idx" ON "procedure_acknowledgements" USING btree ("user_id","procedure_version_id");--> statement-breakpoint
CREATE INDEX "procedure_ack_version_id_idx" ON "procedure_acknowledgements" USING btree ("procedure_version_id");--> statement-breakpoint
CREATE INDEX "procedure_ack_user_id_idx" ON "procedure_acknowledgements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "procedure_ack_read_at_idx" ON "procedure_acknowledgements" USING btree ("read_at");