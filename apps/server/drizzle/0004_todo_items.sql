CREATE TABLE `todo_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`instance_id` text NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`due_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_items_owner_instance_idx` ON `todo_items` (`owner_user_id`,`instance_id`);--> statement-breakpoint
CREATE INDEX `todo_items_instance_sort_idx` ON `todo_items` (`instance_id`,`sort_order`);
