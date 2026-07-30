CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `dashboards` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dashboards_owner_slug_unique` ON `dashboards` (`owner_user_id`,`slug`);--> statement-breakpoint
CREATE INDEX `dashboards_owner_user_id_idx` ON `dashboards` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`dashboard_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_dashboard_slug_unique` ON `pages` (`dashboard_id`,`slug`);--> statement-breakpoint
CREATE INDEX `pages_dashboard_id_idx` ON `pages` (`dashboard_id`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `integrations_user_id_idx` ON `integrations` (`user_id`);--> statement-breakpoint
CREATE TABLE `widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`config_json` text DEFAULT '{}' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`integration_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `widgets_page_id_idx` ON `widgets` (`page_id`);--> statement-breakpoint
CREATE INDEX `widgets_integration_id_idx` ON `widgets` (`integration_id`);--> statement-breakpoint
CREATE TABLE `widget_layouts` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_id` text NOT NULL,
	`page_id` text NOT NULL,
	`col_start` integer NOT NULL,
	`col_span` integer NOT NULL,
	`row_order` integer NOT NULL,
	`row_span` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`widget_id`) REFERENCES `widgets`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `widget_layouts_widget_id_unique` ON `widget_layouts` (`widget_id`);--> statement-breakpoint
CREATE INDEX `widget_layouts_page_id_idx` ON `widget_layouts` (`page_id`);--> statement-breakpoint
CREATE TABLE `secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`integration_id` text NOT NULL,
	`key` text NOT NULL,
	`ciphertext` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `secrets_integration_key_unique` ON `secrets` (`integration_id`,`key`);--> statement-breakpoint
CREATE INDEX `secrets_integration_id_idx` ON `secrets` (`integration_id`);--> statement-breakpoint
CREATE TABLE `cache_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`cache_key` text NOT NULL,
	`widget_id` text,
	`payload_json` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`stale_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`widget_id`) REFERENCES `widgets`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cache_entries_cache_key_unique` ON `cache_entries` (`cache_key`);--> statement-breakpoint
CREATE INDEX `cache_entries_widget_id_idx` ON `cache_entries` (`widget_id`);--> statement-breakpoint
CREATE INDEX `cache_entries_expires_at_idx` ON `cache_entries` (`expires_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_user_key_unique` ON `settings` (`user_id`,`key`);--> statement-breakpoint
CREATE INDEX `settings_user_id_idx` ON `settings` (`user_id`);
