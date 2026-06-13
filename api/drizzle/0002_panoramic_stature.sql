ALTER TABLE "users" ADD COLUMN "recovery_auth_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "salt_recovery_auth" text NOT NULL;