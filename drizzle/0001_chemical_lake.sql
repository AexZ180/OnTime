ALTER TABLE `profiles` ADD `home_city` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `time_zone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `location_sharing` text DEFAULT 'never' NOT NULL;