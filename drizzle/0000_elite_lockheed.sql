CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`message` text NOT NULL,
	`media_type` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_posts_object_key` ON `posts` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_posts_user_created` ON `posts` (`user`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_created` ON `posts` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`username` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
