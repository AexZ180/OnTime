CREATE TABLE `calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `calendars_owner` ON `calendars` (`owner`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`calendar` text NOT NULL,
	`data` text NOT NULL,
	`token` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_owner` ON `events` (`owner`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_token` ON `events` (`token`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`birthday` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`event` text NOT NULL,
	`user` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `responses_event_user` ON `responses` (`event`,`user`);