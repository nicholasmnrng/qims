CREATE TYPE "public"."assignment_status" AS ENUM('draft', 'published', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."handover_item_category" AS ENUM('area_condition', 'completed_work', 'pending_work', 'blocker', 'safety_concern', 'special_note');--> statement-breakpoint
CREATE TYPE "public"."handover_status" AS ENUM('draft', 'submitted', 'read_by_next_shift', 'acknowledged', 'closed');--> statement-breakpoint
CREATE TYPE "public"."issue_category" AS ENUM('quality_issue', 'safety_concern', 'manpower_shortage', 'equipment_issue', 'sop_deviation', 'production_constraint', 'other');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'under_review', 'action_required', 'resolved', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('critical', 'high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('schedule_update', 'priority_change', 'new_sop', 'sop_reminder', 'handover_reminder', 'issue_alert', 'assignment_change', 'system_alert');--> statement-breakpoint
CREATE TYPE "public"."procedure_category" AS ENUM('safety', 'inspection_method', 'production_update', 'emergency_instruction', 'general_announcement');--> statement-breakpoint
CREATE TYPE "public"."procedure_status" AS ENUM('draft', 'in_review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."procedure_target_type" AS ENUM('all_inspectors', 'area', 'shift', 'skill_level');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('draft', 'assigned', 'acknowledged', 'in_progress', 'blocked', 'done', 'verified', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "handover_items" (
	"id" text PRIMARY KEY NOT NULL,
	"handover_id" text NOT NULL,
	"category" "handover_item_category" NOT NULL,
	"note" text NOT NULL,
	"severity" "issue_severity" DEFAULT 'low',
	"attachment_url" text,
	"related_task_id" text,
	"related_issue_id" text
);
--> statement-breakpoint
CREATE TABLE "handovers" (
	"id" text PRIMARY KEY NOT NULL,
	"from_shift_assignment_id" text,
	"to_shift_id" text,
	"area_id" text,
	"submitted_by" text,
	"status" "handover_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"acknowledged_by" text,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_events" (
	"id" text PRIMARY KEY NOT NULL,
	"issue_id" text NOT NULL,
	"event_type" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"note" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "issue_category" NOT NULL,
	"severity" "issue_severity" DEFAULT 'medium' NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"area_id" text,
	"task_id" text,
	"shift_assignment_id" text,
	"reported_by" text,
	"assigned_to" text,
	"attachment_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"delivery_status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"read_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"priority" "notification_priority" DEFAULT 'normal' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedure_version_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"procedure_version_id" text NOT NULL,
	"target_type" "procedure_target_type" NOT NULL,
	"target_id" text
);
--> statement-breakpoint
CREATE TABLE "procedure_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"procedure_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"content" text,
	"attachment_url" text,
	"published_at" timestamp with time zone,
	"published_by" text,
	"effective_date" date,
	"is_critical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" "procedure_category" NOT NULL,
	"status" "procedure_status" DEFAULT 'draft' NOT NULL,
	"owner_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"shift_id" text NOT NULL,
	"area_id" text NOT NULL,
	"work_date" date NOT NULL,
	"assignment_status" "assignment_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" text,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_matrix" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"area_id" text NOT NULL,
	"skill_level" "skill_level" DEFAULT 'not_trained' NOT NULL,
	"assessed_by" text,
	"assessed_at" timestamp with time zone,
	"valid_until" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"event_type" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"area_id" text NOT NULL,
	"assigned_user_id" text,
	"shift_assignment_id" text,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'draft' NOT NULL,
	"due_at" timestamp with time zone,
	"attachment_url" text,
	"checklist" jsonb,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_handover_id_handovers_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."handovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_related_task_id_tasks_id_fk" FOREIGN KEY ("related_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_related_issue_id_issue_reports_id_fk" FOREIGN KEY ("related_issue_id") REFERENCES "public"."issue_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_from_shift_assignment_id_shift_assignments_id_fk" FOREIGN KEY ("from_shift_assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_to_shift_id_shifts_id_fk" FOREIGN KEY ("to_shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_events" ADD CONSTRAINT "issue_events_issue_id_issue_reports_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_events" ADD CONSTRAINT "issue_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_shift_assignment_id_shift_assignments_id_fk" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_version_targets" ADD CONSTRAINT "procedure_version_targets_procedure_version_id_procedure_versions_id_fk" FOREIGN KEY ("procedure_version_id") REFERENCES "public"."procedure_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_versions" ADD CONSTRAINT "procedure_versions_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_versions" ADD CONSTRAINT "procedure_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_matrix" ADD CONSTRAINT "skill_matrix_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_matrix" ADD CONSTRAINT "skill_matrix_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_matrix" ADD CONSTRAINT "skill_matrix_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_shift_assignment_id_shift_assignments_id_fk" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handover_items_handover_id_idx" ON "handover_items" USING btree ("handover_id");--> statement-breakpoint
CREATE INDEX "handover_items_related_task_id_idx" ON "handover_items" USING btree ("related_task_id");--> statement-breakpoint
CREATE INDEX "handover_items_related_issue_id_idx" ON "handover_items" USING btree ("related_issue_id");--> statement-breakpoint
CREATE INDEX "handovers_from_shift_assignment_id_idx" ON "handovers" USING btree ("from_shift_assignment_id");--> statement-breakpoint
CREATE INDEX "handovers_to_shift_id_idx" ON "handovers" USING btree ("to_shift_id");--> statement-breakpoint
CREATE INDEX "handovers_area_id_idx" ON "handovers" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "handovers_status_idx" ON "handovers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "issue_events_issue_id_idx" ON "issue_events" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_events_actor_id_idx" ON "issue_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "issue_events_created_at_idx" ON "issue_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "issue_reports_area_id_idx" ON "issue_reports" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "issue_reports_task_id_idx" ON "issue_reports" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "issue_reports_shift_assignment_id_idx" ON "issue_reports" USING btree ("shift_assignment_id");--> statement-breakpoint
CREATE INDEX "issue_reports_reported_by_idx" ON "issue_reports" USING btree ("reported_by");--> statement-breakpoint
CREATE INDEX "issue_reports_status_idx" ON "issue_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "issue_reports_severity_idx" ON "issue_reports" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "issue_reports_created_at_idx" ON "issue_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_recipients_notification_id_idx" ON "notification_recipients" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_user_id_idx" ON "notification_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_delivery_status_idx" ON "notification_recipients" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notifications_priority_idx" ON "notifications" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "notifications_entity_idx" ON "notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "procedure_version_targets_version_id_idx" ON "procedure_version_targets" USING btree ("procedure_version_id");--> statement-breakpoint
CREATE INDEX "procedure_version_targets_target_idx" ON "procedure_version_targets" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "procedure_versions_procedure_id_idx" ON "procedure_versions" USING btree ("procedure_id");--> statement-breakpoint
CREATE INDEX "procedure_versions_published_at_idx" ON "procedure_versions" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "procedures_status_idx" ON "procedures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "procedures_category_idx" ON "procedures" USING btree ("category");--> statement-breakpoint
CREATE INDEX "procedures_owner_id_idx" ON "procedures" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "procedures_created_at_idx" ON "procedures" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "shift_assignments_user_id_idx" ON "shift_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shift_assignments_shift_id_idx" ON "shift_assignments" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shift_assignments_area_id_idx" ON "shift_assignments" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "shift_assignments_work_date_idx" ON "shift_assignments" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "shift_assignments_status_idx" ON "shift_assignments" USING btree ("assignment_status");--> statement-breakpoint
CREATE INDEX "shift_assignments_created_at_idx" ON "shift_assignments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_matrix_user_area_idx" ON "skill_matrix" USING btree ("user_id","area_id");--> statement-breakpoint
CREATE INDEX "skill_matrix_user_id_idx" ON "skill_matrix" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "skill_matrix_area_id_idx" ON "skill_matrix" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "skill_matrix_skill_level_idx" ON "skill_matrix" USING btree ("skill_level");--> statement-breakpoint
CREATE INDEX "task_events_task_id_idx" ON "task_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_events_actor_id_idx" ON "task_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "task_events_created_at_idx" ON "task_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tasks_area_id_idx" ON "tasks" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_user_id_idx" ON "tasks" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "tasks_shift_assignment_id_idx" ON "tasks" USING btree ("shift_assignment_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "tasks_created_at_idx" ON "tasks" USING btree ("created_at");