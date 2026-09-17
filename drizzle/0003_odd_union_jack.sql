ALTER TABLE "signup_leads" ADD COLUMN "funding_stream" "funding_stream";--> statement-breakpoint
ALTER TABLE "signup_leads" ADD COLUMN "plan_manager_name" text;--> statement-breakpoint
ALTER TABLE "signup_leads" ADD COLUMN "preferred_worker_id" uuid;--> statement-breakpoint
ALTER TABLE "signup_leads" ADD CONSTRAINT "signup_leads_preferred_worker_id_worker_profiles_id_fk" FOREIGN KEY ("preferred_worker_id") REFERENCES "public"."worker_profiles"("id") ON DELETE no action ON UPDATE no action;