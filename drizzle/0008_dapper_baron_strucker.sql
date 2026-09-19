ALTER TABLE "progress_notes" ADD COLUMN "rejected_reason" text;--> statement-breakpoint
ALTER TABLE "progress_notes" ADD COLUMN "rejected_by" uuid;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "progress_notes" ADD CONSTRAINT "progress_notes_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;