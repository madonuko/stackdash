DROP INDEX "ipam_allocations_vm_family_index";--> statement-breakpoint
CREATE INDEX "ipam_allocations_vm_family_index" ON "ipam_allocations" USING btree ("associated_vm_id","family");