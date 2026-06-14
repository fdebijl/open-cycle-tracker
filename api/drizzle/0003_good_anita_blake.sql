ALTER TABLE "categories" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "category_levels" ADD COLUMN "order" integer;--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN "enc_notes" "bytea";--> statement-breakpoint
ALTER TABLE "factors" ADD COLUMN "enc_value" "bytea";