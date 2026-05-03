import {
	pgTable,
	pgEnum,
	text,
	boolean,
	bigint,
	integer,
	numeric,
	date,
	index,
	inet,
	cidr
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { ulid } from '$lib/server/id';

export * from './auth.schema';

const ulidPk = () => text('id').primaryKey().$defaultFn(ulid);
const ulidFk = (name: string) => text(name);

// Enums

export const projectPermissionsEnum = pgEnum('project_permissions_enum', [
	'admin',
	'read_write',
	'read'
]);

export const vmIsaEnum = pgEnum('vm_isa', ['x86', 'arm', 'risc-v']);

export const vmBackendEnum = pgEnum('vm_backend', ['proxmox']);

export const vmStatusEnum = pgEnum('vm_status', ['provisioning', 'ready', 'error']);

// Projects

export const projects = pgTable(
	'projects',
	{
		id: ulidPk(),
		projectName: text('project_name').notNull(),
		ownerUserId: text('owner_user_id').notNull(),
		creationDate: bigint('creation_date', { mode: 'number' }).notNull()
	},
	(table) => [index('projects_owner_user_id_index').on(table.ownerUserId)]
);

export const projectsRelations = relations(projects, ({ many }) => ({
	permissions: many(projectPermissions),
	vms: many(vms),
	volumes: many(volumes)
}));

// Project Permissions

export const projectPermissions = pgTable(
	'project_permissions',
	{
		projectId: ulidFk('project_id')
			.notNull()
			.references(() => projects.id),
		userId: text('user_id').notNull(),
		permissions: projectPermissionsEnum('permissions').notNull()
	},
	(table) => [index('project_user_permissions_index').on(table.projectId, table.userId)]
);

export const projectPermissionsRelations = relations(projectPermissions, ({ one }) => ({
	project: one(projects, {
		fields: [projectPermissions.projectId],
		references: [projects.id]
	})
}));

// VM Types

export const vmTypes = pgTable('vm_types', {
	id: ulidPk(),
	name: text('name').notNull(),
	isa: vmIsaEnum('isa').notNull(),
	cores: integer('cores').notNull(),
	ramCapacity: integer('ram_capacity').notNull(),
	storageAmount: integer('storage_amount').notNull(),
	rate: numeric('rate').notNull(),
	cap: numeric('cap').notNull()
});

export const vmTypesRelations = relations(vmTypes, ({ many }) => ({
	vms: many(vms)
}));

// VMs

export const vms = pgTable(
	'vms',
	{
		id: ulidPk(),
		name: text('name').notNull(),
		proxmoxId: integer('proxmox_id'),
		lastKnownIpv4: inet('last_known_ipv4'),
		lastKnownIpv6: inet('last_known_ipv6'),
		lastKnownStatus: text('last_known_status'),
		lastKnownUptime: integer('last_known_uptime').notNull().default(0),
		lastKnownAt: bigint('last_known_at', { mode: 'number' }),
		active: boolean('active').notNull().default(true),
		ownerProjectId: ulidFk('owner_project_id').references(() => projects.id),
		vmTypeId: ulidFk('vm_type_id')
			.notNull()
			.references(() => vmTypes.id),
		creationDate: date('creation_date').notNull(),
		backend: vmBackendEnum('backend').notNull(),
		status: vmStatusEnum('status').notNull().default('provisioning'),
		statusError: text('status_error')
	},
	(table) => [
		index('vms_owner_project_id_index').on(table.ownerProjectId),
		index('vms_owner_project_active_index').on(table.ownerProjectId, table.active),
		index('vms_proxmox_id_index').on(table.proxmoxId)
	]
);

export const vmsRelations = relations(vms, ({ one, many }) => ({
	project: one(projects, {
		fields: [vms.ownerProjectId],
		references: [projects.id]
	}),
	vmType: one(vmTypes, {
		fields: [vms.vmTypeId],
		references: [vmTypes.id]
	}),
	volumes: many(volumes),
	paymentPeriods: many(paymentPeriods),
	ipAssignments: many(ipAssignments)
}));

// Volumes

export const volumes = pgTable(
	'volumes',
	{
		id: ulidPk(),
		name: text('name').notNull(),
		size: integer('size').notNull(),
		ownerProjectId: ulidFk('owner_project_id')
			.notNull()
			.references(() => projects.id),
		associatedVmId: ulidFk('associated_vm_id').references(() => vms.id)
	},
	(table) => [
		index('volumes_owner_project_id_index').on(table.ownerProjectId),
		index('volumes_associated_vm_id_index').on(table.associatedVmId)
	]
);

export const volumesRelations = relations(volumes, ({ one }) => ({
	project: one(projects, {
		fields: [volumes.ownerProjectId],
		references: [projects.id]
	}),
	vm: one(vms, {
		fields: [volumes.associatedVmId],
		references: [vms.id]
	})
}));

// Payment Periods

export const paymentPeriods = pgTable(
	'payment_periods',
	{
		id: ulidPk(),
		vmId: ulidFk('vm_id')
			.notNull()
			.references(() => vms.id),
		userId: text('user_id').notNull(),
		startDate: integer('start_date').notNull(),
		endDate: integer('end_date'),
		rate: numeric('rate').notNull(),
		cap: numeric('cap').notNull()
	},
	(table) => [
		index('payment_periods_vm_id_index').on(table.vmId),
		index('payment_periods_user_id_index').on(table.userId)
	]
);

export const paymentPeriodsRelations = relations(paymentPeriods, ({ one }) => ({
	vm: one(vms, {
		fields: [paymentPeriods.vmId],
		references: [vms.id]
	})
}));

// IP Blocks

export const ipBlocks = pgTable('ip_blocks', {
	id: ulidPk(),
	ipBlock: cidr('ip_block').notNull()
});

export const ipBlocksRelations = relations(ipBlocks, ({ many }) => ({
	assignments: many(ipAssignments)
}));

// IP Assignments

export const ipAssignments = pgTable(
	'ip_assignments',
	{
		ip: inet('ip').notNull(),
		ipBlockId: ulidFk('ip_block_id')
			.notNull()
			.references(() => ipBlocks.id),
		associatedVmId: ulidFk('associated_vm_id').references(() => vms.id)
	},
	(table) => [
		index('ip_assignments_ip_block_id_index').on(table.ipBlockId),
		index('ip_assignments_associated_vm_id_index').on(table.associatedVmId)
	]
);

export const ipAssignmentsRelations = relations(ipAssignments, ({ one }) => ({
	ipBlock: one(ipBlocks, {
		fields: [ipAssignments.ipBlockId],
		references: [ipBlocks.id]
	}),
	vm: one(vms, {
		fields: [ipAssignments.associatedVmId],
		references: [vms.id]
	})
}));

// SSH Keys

export const sshKeys = pgTable(
	'ssh_keys',
	{
		id: ulidPk(),
		userId: text('user_id').notNull(),
		fingerprint: text('fingerprint').notNull(),
		publicKey: text('public_key').notNull(),
		name: text('name').notNull(),
		description: text('description')
	},
	(table) => [index('ssh_keys_user_id_index').on(table.userId)]
);

// API Tokens

export const apiTokens = pgTable(
	'api_tokens',
	{
		id: ulidPk(),
		userId: text('user_id').notNull(),
		name: text('name').notNull(),
		tokenHash: text('token_hash').notNull(),
		createdAt: bigint('created_at', { mode: 'number' }).notNull()
	},
	(table) => [index('api_tokens_user_id_index').on(table.userId)]
);

// Base Images

export const baseImages = pgTable('base_images', {
	id: ulidPk(),
	filePath: text('file_path').notNull(), // Proxmox storage path: "local:iso/Fedora-Server-dvd-x86_64-42-1.1.iso"
	name: text('name').notNull(),
	version: text('version').notNull(),
	description: text('description').notNull(),
	shortName: text('short_name').notNull().default(''),
	icon: text('icon'),
	color: text('color').notNull().default('bg-gray-600'), // Tailwind bg class
	isa: vmIsaEnum('isa').notNull()
});
