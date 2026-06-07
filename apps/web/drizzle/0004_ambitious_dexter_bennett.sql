CREATE INDEX "handovers_submitted_by_idx" ON "handovers" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "handovers_created_at_idx" ON "handovers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "issue_events_event_type_idx" ON "issue_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "issue_reports_assigned_to_idx" ON "issue_reports" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "notification_recipients_read_at_idx" ON "notification_recipients" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "notification_recipients_acknowledged_at_idx" ON "notification_recipients" USING btree ("acknowledged_at");--> statement-breakpoint
CREATE INDEX "offline_drafts_created_at_idx" ON "offline_drafts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "procedure_ack_understood_at_idx" ON "procedure_acknowledgements" USING btree ("understood_at");--> statement-breakpoint
CREATE INDEX "procedure_ack_created_at_idx" ON "procedure_acknowledgements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "skill_matrix_valid_until_idx" ON "skill_matrix" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX "task_events_event_type_idx" ON "task_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "tasks_due_at_idx" ON "tasks" USING btree ("due_at");