ALTER TABLE "scheduled_messages" ALTER COLUMN "cron_expression" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "schedule_type" varchar(20) DEFAULT 'recurring' NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "scheduled_at" timestamp;