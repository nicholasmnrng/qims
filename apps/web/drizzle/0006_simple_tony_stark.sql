CREATE TABLE "realtime_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"actor_id" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "realtime_events" ADD CONSTRAINT "realtime_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "realtime_events_type_idx" ON "realtime_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "realtime_events_channel_idx" ON "realtime_events" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "realtime_events_actor_id_idx" ON "realtime_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "realtime_events_created_at_idx" ON "realtime_events" USING btree ("created_at");