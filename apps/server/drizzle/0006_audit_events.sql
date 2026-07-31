CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` integer NOT NULL,
	`actor_user_id` text,
	`actor_email` text,
	`event` text NOT NULL,
	`success` integer NOT NULL,
	`ip` text,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_events_occurred_at_idx` ON `audit_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_user_id_idx` ON `audit_events` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_events_event_idx` ON `audit_events` (`event`);