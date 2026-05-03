import {
	ArrowUpDown,
	BarChart3,
	Camera,
	Clock,
	Disc,
	FileText,
	Globe,
	RotateCw,
	Settings,
	Terminal
} from '@lucide/svelte';

export type ServerTab =
	| 'overview'
	| 'console'
	| 'logs'
	| 'networking'
	| 'images'
	| 'snapshots'
	| 'backups'
	| 'rebuild'
	| 'resize'
	| 'rescue'
	| 'settings';

export const serverTabs: { id: ServerTab; label: string; icon: typeof BarChart3 }[] = [
	{ id: 'overview', label: 'Overview', icon: BarChart3 },
	{ id: 'console', label: 'Console', icon: Terminal },
	{ id: 'logs', label: 'Logs', icon: FileText },
	{ id: 'networking', label: 'Networking', icon: Globe },
	{ id: 'images', label: 'Images', icon: Disc },
	{ id: 'snapshots', label: 'Snapshots', icon: Camera },
	{ id: 'backups', label: 'Backups', icon: Clock },
	{ id: 'rebuild', label: 'Rebuild', icon: RotateCw },
	{ id: 'resize', label: 'Resize', icon: ArrowUpDown },
	{ id: 'rescue', label: 'Rescue', icon: Terminal },
	{ id: 'settings', label: 'Settings', icon: Settings }
];
