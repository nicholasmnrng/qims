CREATE TYPE "public"."device_token_platform" AS ENUM('expo', 'fcm', 'apns', 'web');--> statement-breakpoint
CREATE TYPE "public"."device_token_status" AS ENUM('active', 'inactive', 'failed');--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" "device_token_platform" DEFAULT 'expo' NOT NULL,
	"status" "device_token_status" DEFAULT 'active' NOT NULL,
	"device_name" text,
	"last_registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_delivered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_token_idx" ON "device_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "device_tokens_status_idx" ON "device_tokens" USING btree ("status");--> statement-breakpoint
CREATE INDEX "device_tokens_platform_idx" ON "device_tokens" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "device_tokens_last_registered_at_idx" ON "device_tokens" USING btree ("last_registered_at");