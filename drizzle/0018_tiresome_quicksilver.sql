ALTER TABLE "ipam_allocations" ADD COLUMN "kea_subnet_id" text;--> statement-breakpoint
ALTER TABLE "ipam_allocations" ADD COLUMN "kea_reservation_address" text;--> statement-breakpoint
ALTER TABLE "ipam_prefixes" ADD COLUMN "kea_subnet_id" text;--> statement-breakpoint
ALTER TABLE "ipam_prefixes" ADD COLUMN "kea_interface" text;--> statement-breakpoint
ALTER TABLE "ipam_allocations" DROP COLUMN "opnsense_subnet_uuid";--> statement-breakpoint
ALTER TABLE "ipam_allocations" DROP COLUMN "opnsense_reservation_uuid";--> statement-breakpoint
ALTER TABLE "ipam_prefixes" DROP COLUMN "opnsense_subnet_uuid";--> statement-breakpoint
ALTER TABLE "ipam_prefixes" DROP COLUMN "opnsense_interface";