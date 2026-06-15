ALTER TABLE "users" ADD COLUMN "duress_user_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "duress_auth_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "destruct_auth_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_duress_user_id_users_id_fk" FOREIGN KEY ("duress_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;