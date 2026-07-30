CREATE TABLE `page_layouts` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`layouts_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_layouts_page_id_unique` ON `page_layouts` (`page_id`);--> statement-breakpoint
CREATE INDEX `page_layouts_page_id_idx` ON `page_layouts` (`page_id`);