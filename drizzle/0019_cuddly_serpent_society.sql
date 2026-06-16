ALTER TABLE "ipam_allocations" DROP COLUMN "kea_subnet_id";--> statement-breakpoint
ALTER TABLE "ipam_allocations" DROP COLUMN "kea_reservation_address";--> statement-breakpoint
ALTER TABLE "ipam_prefixes" DROP COLUMN "kea_subnet_id";--> statement-breakpoint
ALTER TABLE "ipam_prefixes" DROP COLUMN "kea_interface";