CREATE TABLE `setup_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `setup_tokens_token_hash_unique` ON `setup_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `setup_tokens_expires_at_idx` ON `setup_tokens` (`expires_at`);