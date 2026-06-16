ALTER TABLE "ipam_prefixes" ADD COLUMN "ipv6_use_transit_address" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ipam_prefixes" ADD COLUMN "whitelist_start" "inet";--> statement-breakpoint
ALTER TABLE "ipam_prefixes" ADD COLUMN "whitelist_end" "inet";--> statement-breakpoint
ALTER TABLE "ipam_prefixes" DROP COLUMN "gateway";