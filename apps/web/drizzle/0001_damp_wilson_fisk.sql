CREATE TYPE "public"."master_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."skill_level" AS ENUM('not_trained', 'beginner', 'intermediate', 'competent', 'expert', 'trainer');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"site_id" text,
	"minimum_skill_level" "skill_level" DEFAULT 'not_trained' NOT NULL,
	"status" "master_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "master_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"timezone" text NOT NULL,
	"status" "master_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "master_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"department_id" text,
	"position" text,
	"phone" text,
	"avatar_url" text,
	"join_date" date,
	"active_site_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_active_site_id_sites_id_fk" FOREIGN KEY ("active_site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "areas_code_idx" ON "areas" USING btree ("code");--> statement-breakpoint
CREATE INDEX "areas_site_id_idx" ON "areas" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "areas_status_idx" ON "areas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "areas_created_at_idx" ON "areas" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_idx" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "departments_status_idx" ON "departments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "departments_created_at_idx" ON "departments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_name_idx" ON "shifts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "shifts_status_idx" ON "shifts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_code_idx" ON "sites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "sites_status_idx" ON "sites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sites_created_at_idx" ON "sites" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "system_settings_updated_by_idx" ON "system_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "system_settings_updated_at_idx" ON "system_settings" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_department_id_idx" ON "user_profiles" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "user_profiles_active_site_id_idx" ON "user_profiles" USING btree ("active_site_id");