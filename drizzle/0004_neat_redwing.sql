ALTER TABLE "users" ADD COLUMN "hash_algo" text DEFAULT 'bcrypt' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hash_version" integer DEFAULT 1 NOT NULL;