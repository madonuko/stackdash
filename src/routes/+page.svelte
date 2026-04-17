<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import { officialImages, imageTypeColors, type OfficialImage, type ImageType } from '$lib/data/images';
	import {
		listVms,
		getVm,
		createVm,
		deleteVm,
		startVm,
		stopVm,
		rebootVm
	} from '$lib/remote/vms.remote';
	import { listVmTypes } from '$lib/remote/vm-types.remote';
	import { listImages } from '$lib/remote/images.remote';
	import { untrack, onMount } from 'svelte';
	import {
		Play,
		Square,
		PowerOff,
		RotateCw,
		Camera,
		HardDrive,
		Terminal,
		Globe,
		Shield,
		BarChart3,
		Settings,
		Trash2,
		Power,
		Copy,
		Check,
		ArrowUpDown,
		Download,
		Clock,
		Pencil,
		X,
		Pause,
		Search,
		FileText,
		ArrowDown,
		Plus,
		Disc,
		Upload,
		AlertTriangle,
		ChevronLeft,
		ChevronRight,
		DollarSign,
		Loader2,
		RefreshCw
	} from '@lucide/svelte';

	let { data } = $props();

	type ServerInfo = {
		id: string;
		name: string;
		vcpu: number;
		ram: string;
		disk: string;
		ip: string;
		ipv6: string;
		status: 'running' | 'stopped' | 'restarting' | 'provisioning';
		agentConnected: boolean;
		os: string;
		region: string;
		created: string;
		uptime: string;
		plan: string;
		backups: boolean;
	};

	let servers = $state<ServerInfo[]>([]);
	let loadingVms = $state(false);
	let vmError = $state('');

	function formatUptime(seconds: number): string {
		if (!seconds) return '—';
		const d = Math.floor(seconds / 86400);
		const h = Math.floor((seconds % 86400) / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return `${d}d ${h}h ${m}m`;
	}

	function formatBytes(bytes: number): string {
		if (!bytes) return '0B';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb >= 1) return `${gb.toFixed(0)}GB`;
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(0)}MB`;
	}

	// Load VMs from backend
	async function loadVms() {
		const projectId = data.projects?.[0]?.id;
		if (!projectId) {
			servers = [];
			return;
		}

		loadingVms = true;
		vmError = '';
		try {
			type VmRow = {
				id: string;
				active: boolean;
				status: string;
				creationDate: string;
				vmType: { name: string; cores: number; ramCapacity: number; storageAmount: number } | null;
				live: { id: string; name: string; status: string; cores: number; memory: number; disk: number; uptime: number; networkInterfaces?: Record<string, { ipAddresses?: string[] }> } | null;
			};
			const vms = await listVms({ projectId });
			servers = vms.filter((v) => v.active).map((vm) => {
				const ip = vm.live?.networkInterfaces
					? Object.values(vm.live.networkInterfaces).flatMap((i) => i.ipAddresses ?? []).find((a) => a && !a.startsWith('127.') && !a.includes(':')) ?? '—'
					: '—';
				const ipv6 = vm.live?.networkInterfaces
					? Object.values(vm.live.networkInterfaces).flatMap((i) => i.ipAddresses ?? []).find((a) => a?.includes(':')) ?? '—'
					: '—';
				const vmStatus: ServerInfo['status'] = vm.status === 'provisioning'
					? 'provisioning'
					: (vm.live?.status ?? 'stopped') as 'running' | 'stopped' | 'restarting';
				return {
					id: vm.id,
					name: vm.live?.name ?? vm.id,
					vcpu: vm.live?.cores ?? vm.vmType?.cores ?? 0,
					ram: formatBytes(vm.live?.memory ?? (vm.vmType?.ramCapacity ?? 0) * 1024 * 1024),
					disk: formatBytes(vm.live?.disk ?? (vm.vmType?.storageAmount ?? 0) * 1024 * 1024 * 1024),
					ip,
					ipv6,
					status: vmStatus,
					agentConnected: !!vm.live?.networkInterfaces,
					os: '—',
					region: '—',
					created: vm.creationDate,
					uptime: formatUptime(vm.live?.uptime ?? 0),
					plan: vm.vmType?.name ?? '—',
					backups: false
				};
			});

			// Poll while any VMs are still provisioning
			if (servers.some((s) => s.status === 'provisioning')) {
				setTimeout(() => loadVms(), 3000);
			}
		} catch (err) {
			vmError = err instanceof Error ? err.message : 'Failed to load VMs';
		} finally {
			loadingVms = false;
		}
	}

	onMount(() => {
		loadVms();
	});

	let selectedServerId = $state(page.url.searchParams.get('server') ?? '');

	// Auto-select first server when list loads
	$effect(() => {
		const len = servers.length;
		untrack(() => {
			if (!selectedServerId && len) selectedServerId = servers[0].id;
		});
	});

	// React to URL param changes from command palette
	$effect(() => {
		const fromUrl = page.url.searchParams.get('server');
		if (fromUrl) {
			untrack(() => {
				if (servers.some((s) => s.id === fromUrl)) selectedServerId = fromUrl;
			});
		}
	});
	let selectedServer = $derived(
		servers.find((s) => s.id === selectedServerId) ?? servers[0]
	);
	let selectedServerIdx = $derived(servers.findIndex((s) => s.id === selectedServerId));

	type Tab = 'overview' | 'console' | 'logs' | 'networking' | 'images' | 'snapshots' | 'backups' | 'rebuild' | 'resize' | 'rescue' | 'settings';
	let activeTab = $state<Tab>('overview');

	const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
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

	// Charts
	type ChartDef = { label: string; color: string; points: string; value: string };
	const charts: ChartDef[] = [
		{
			label: 'CPU Usage',
			color: '#ef6b6b',
			points: '0,70 30,68 50,60 70,30 90,15 110,35 130,20 150,40 170,55 190,50 210,52 240,54',
			value: '12%'
		},
		{
			label: 'RAM Usage',
			color: '#4ade80',
			points: '0,65 30,64 60,60 90,50 120,45 150,40 180,42 210,38 240,35',
			value: '847 MB'
		},
		{
			label: 'Bandwidth',
			color: '#60a5fa',
			points: '0,55 30,52 60,50 90,48 120,45 150,46 180,40 210,42 240,38',
			value: '1.2 Mbps'
		},
		{
			label: 'Disk IOPs',
			color: '#fb923c',
			points: '0,50 30,50 60,48 90,48 120,46 150,45 180,44 210,38 240,30',
			value: '340'
		}
	];

	// Terminal mock
	const terminalLines = [
		{ type: 'prompt' as const, text: 'ls /var/log' },
		{ type: 'output' as const, text: 'www.log  gamer.log  uwaa.log  fyra.log  chicago.log' },
		{ type: 'cursor' as const, text: '' }
	];

	// Snapshots
	type Snapshot = { id: string; name: string; size: string; date: string };
	let snapshots = $state<Snapshot[]>([
		{ id: 'snap-001', name: 'pre-deploy-v2.4', size: '4.2 GB', date: '2026-04-03' },
		{ id: 'snap-002', name: 'weekly-backup', size: '3.8 GB', date: '2026-03-29' }
	]);
	let createSnapOpen = $state(false);
	let newSnapName = $state('');
	let snapCounter = $state(2);

	function createSnapshot() {
		if (!newSnapName.trim()) return;
		snapCounter++;
		snapshots.unshift({
			id: `snap-${String(snapCounter).padStart(3, '0')}`,
			name: newSnapName.trim(),
			size: `${(Math.random() * 3 + 2).toFixed(1)} GB`,
			date: new Date().toISOString().slice(0, 10)
		});
		newSnapName = '';
		createSnapOpen = false;
	}

	function deleteSnapshot(id: string) {
		snapshots = snapshots.filter((s) => s.id !== id);
	}

	// Backups
	type Backup = { id: string; date: string; size: string; status: string };
	const backups: Backup[] = [
		{ id: 'bk-001', date: '2026-04-05 03:00', size: '3.9 GB', status: 'completed' },
		{ id: 'bk-002', date: '2026-04-04 03:00', size: '3.9 GB', status: 'completed' },
		{ id: 'bk-003', date: '2026-04-03 03:00', size: '3.8 GB', status: 'completed' },
		{ id: 'bk-004', date: '2026-04-02 03:00', size: '3.8 GB', status: 'completed' },
		{ id: 'bk-005', date: '2026-04-01 03:00', size: '3.7 GB', status: 'completed' }
	];

	// Rebuild
	const osOptions = [
		'Ultramarine Linux 40',
		'Fedora 42',
		'Debian 12',
		'Ubuntu 24.04 LTS',
		'Alpine 3.20'
	];
	let rebuildOs = $state('Ultramarine Linux 40');
	let rebuildConfirm = $state('');
	let rebuilding = $state(false);

	function doRebuild() {
		if (rebuildConfirm !== selectedServer.id) return;
		rebuilding = true;
		servers[selectedServerIdx].status = 'restarting';
		setTimeout(() => {
			servers[selectedServerIdx].os = rebuildOs;
			servers[selectedServerIdx].status = 'running';
			rebuilding = false;
			rebuildConfirm = '';
		}, 3000);
	}

	// Resize
	const resizePlans = [
		{ name: 'STACK-XXS', vcpu: 2, ram: '2GB', disk: '40GB', price: '$5/mo' },
		{ name: 'STACK-XS', vcpu: 4, ram: '4GB', disk: '80GB', price: '$10/mo' },
		{ name: 'STACK-SM', vcpu: 6, ram: '8GB', disk: '160GB', price: '$20/mo' },
		{ name: 'STACK-MD', vcpu: 8, ram: '16GB', disk: '320GB', price: '$34/mo' }
	];
	let resizePlan = $state('');

	function doResize() {
		if (!resizePlan) return;
		const plan = resizePlans.find((p) => p.name === resizePlan);
		if (!plan) return;
		servers[selectedServerIdx].plan = plan.name;
		servers[selectedServerIdx].vcpu = plan.vcpu;
		servers[selectedServerIdx].ram = plan.ram;
		servers[selectedServerIdx].disk = plan.disk + ' SAS3';
		servers[selectedServerIdx].status = 'restarting';
		setTimeout(() => {
			servers[selectedServerIdx].status = 'running';
		}, 2000);
		resizePlan = '';
	}

	// Rescue mode
	let rescueEnabled = $state(false);
	let rescuePassword = $state('');

	function toggleRescue() {
		if (rescueEnabled) {
			rescueEnabled = false;
			rescuePassword = '';
		} else {
			rescueEnabled = true;
			rescuePassword = 'xK9m$2pL!qR7';
			servers[selectedServerIdx].status = 'restarting';
			setTimeout(() => {
				servers[selectedServerIdx].status = 'running';
			}, 2000);
		}
	}

	// Settings
	let editingName = $state(false);
	let nameValue = $state('');
	let deleteConfirm = $state('');
	let deleteOpen = $state(false);

	function saveName() {
		editingName = false;
	}

	async function doDelete() {
		if (deleteConfirm !== selectedServer.id) return;
		await deleteVm({ vmId: selectedServer.id });
		servers = servers.filter((s) => s.id !== selectedServer.id);
		if (servers.length > 0) selectedServerId = servers[0].id;
		deleteOpen = false;
		deleteConfirm = '';
	}

	// Clipboard
	let copied = $state('');
	function copyToClipboard(text: string, label: string) {
		navigator.clipboard.writeText(text);
		copied = label;
		setTimeout(() => (copied = ''), 1500);
	}

	// Power actions — wired to backend
	let powerLoading = $state(false);

	async function setStatus(status: 'running' | 'stopped' | 'restarting') {
		if (!selectedServer || powerLoading) return;
		powerLoading = true;

		try {
			if (status === 'running') {
				servers[selectedServerIdx].status = 'restarting';
				await startVm({ vmId: selectedServer.id });
			} else if (status === 'stopped') {
				await stopVm({ vmId: selectedServer.id });
			} else if (status === 'restarting') {
				servers[selectedServerIdx].status = 'restarting';
				await rebootVm({ vmId: selectedServer.id });
			}
			await loadVms();
		} catch {
			// Refresh to get current state even on error
			await loadVms();
		} finally {
			powerLoading = false;
		}
	}

	// rDNS editing (networking tab)
	let editingRdnsKey = $state<string | null>(null);
	let rdnsValue = $state('');

	// IPv4 rDNS (one per server)
	let ipv4Rdns = $state<Record<string, string>>({
		'vps-747762': 'vps-747762.stack.sh',
		'vps-742736': 'vps-742736.stack.sh',
		'vps-711980': '',
		'vps-698412': ''
	});

	// IPv6 per-IP rDNS entries within each /64 subnet
	type Ipv6Entry = { ip: string; rdns: string };
	let ipv6Entries = $state<Record<string, Ipv6Entry[]>>({
		'vps-747762': [
			{ ip: '2607:f8b0:4004:0800::1', rdns: 'mail.stack.sh' },
			{ ip: '2607:f8b0:4004:0800::2', rdns: 'mx.stack.sh' }
		],
		'vps-742736': [
			{ ip: '2607:f8b0:4004:0801::1', rdns: '' }
		],
		'vps-711980': [],
		'vps-698412': []
	});

	let addIpv6Open = $state(false);
	let newIpv6Addr = $state('');
	let newIpv6Rdns = $state('');

	function startRdnsEdit(key: string, currentValue: string) {
		editingRdnsKey = key;
		rdnsValue = currentValue;
	}

	function saveIpv4Rdns() {
		ipv4Rdns[selectedServerId] = rdnsValue;
		editingRdnsKey = null;
	}

	function saveIpv6Rdns(idx: number) {
		const entries = ipv6Entries[selectedServerId];
		if (entries && entries[idx]) entries[idx].rdns = rdnsValue;
		editingRdnsKey = null;
	}

	function addIpv6Entry() {
		if (!newIpv6Addr.trim()) return;
		if (!ipv6Entries[selectedServerId]) ipv6Entries[selectedServerId] = [];
		ipv6Entries[selectedServerId].push({ ip: newIpv6Addr.trim(), rdns: newIpv6Rdns.trim() });
		newIpv6Addr = '';
		newIpv6Rdns = '';
		addIpv6Open = false;
	}

	function deleteIpv6Entry(idx: number) {
		const entries = ipv6Entries[selectedServerId];
		if (entries) ipv6Entries[selectedServerId] = entries.filter((_, i) => i !== idx);
	}

	// Logs (per-VM, shown in overview)
	type Severity = 'info' | 'warn' | 'error' | 'debug';
	type LogEntry = { id: number; timestamp: string; severity: Severity; source: string; message: string };

	const logSources = ['nginx', 'app', 'postgres', 'redis', 'cron', 'sshd'];
	const logMessages: Record<Severity, string[]> = {
		info: ['GET /api/health 200 OK - 2ms', 'POST /api/auth/login 200 OK - 45ms', 'Worker started pid=4821', 'Cache hit ratio: 94.2%', 'Backup completed: 42MB', 'GET /api/servers 200 OK - 12ms'],
		warn: ['Rate limit at 80% for 45.33.32.156', 'Slow query: 850ms on users', 'Disk usage at 78%', 'Memory exceeds 85% threshold', 'Cert expires in 14 days'],
		error: ['Connection timeout after 30000ms', 'ECONNREFUSED 10.132.0.5:5432', 'OOM: kill pid 3827', 'SSL handshake failed'],
		debug: ['GC pause: 12ms (heap: 256MB)', 'Route matched: /api/servers/:id', 'Cache eviction: 12 entries']
	};

	let logId = $state(0);
	function randomLog(): LogEntry {
		const weights: Severity[] = ['info', 'info', 'info', 'info', 'debug', 'warn', 'warn', 'error'];
		const severity = weights[Math.floor(Math.random() * weights.length)];
		const msgs = logMessages[severity];
		logId++;
		return {
			id: logId,
			timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
			severity,
			source: logSources[Math.floor(Math.random() * logSources.length)],
			message: msgs[Math.floor(Math.random() * msgs.length)]
		};
	}

	let serverLogs = $state<Record<string, LogEntry[]>>({
		'vps-747762': Array.from({ length: 20 }, () => randomLog()),
		'vps-742736': Array.from({ length: 15 }, () => randomLog()),
		'vps-711980': [],
		'vps-698412': []
	});

	let currentLogs = $derived(serverLogs[selectedServerId] ?? []);
	let logStreaming = $state(true);
	let logContainer: HTMLDivElement | undefined = $state();
	let logSevFilter = $state<Severity | null>(null);
	let logSourceFilter = $state<string | null>(null);
	let logSearch = $state('');

	let filteredLogs = $derived(() => {
		let result = currentLogs;
		if (logSevFilter) result = result.filter((l) => l.severity === logSevFilter);
		if (logSourceFilter) result = result.filter((l) => l.source === logSourceFilter);
		if (logSearch.trim()) {
			const q = logSearch.toLowerCase();
			result = result.filter((l) => l.message.toLowerCase().includes(q) || l.source.toLowerCase().includes(q));
		}
		return result;
	});

	function clearLogFilters() {
		logSevFilter = null;
		logSourceFilter = null;
		logSearch = '';
	}

	let hasLogFilters = $derived(logSevFilter !== null || logSourceFilter !== null || logSearch.trim() !== '');

	// Images
	type UserImage = { id: string; name: string; type: ImageType; size: string; uploaded: string; status: 'ready' | 'uploading' | 'processing'; progress: number };
	let vmUserImages = $state<UserImage[]>([
		{ id: 'img-008', name: 'custom-webserver', type: 'qcow2', size: '8.4 GB', uploaded: '2026-03-28', status: 'ready', progress: 100 },
		{ id: 'img-009', name: 'db-snapshot-apr', type: 'img', size: '12.1 GB', uploaded: '2026-04-02', status: 'ready', progress: 100 }
	]);

	let imgSearch = $state('');
	let imgPage = $state(0);
	const imgPerPage = 6;
	let selectedOfficialImage = $state<OfficialImage | null>(null);
	let imgSheetOpen = $state(false);
	let mountedImage = $state<string | null>(null);
	let rebuildFromImage = $state<{ name: string; version: string } | null>(null);
	let rebuildImageConfirm = $state('');
	let rebuildingFromImage = $state(false);
	let imgUploadOpen = $state(false);
	let imgUploadName = $state('');
	let imgUploadFile = $state('');
	let imgUploadDetectedType = $state<ImageType | null>(null);
	let imgUploadUrl = $state('');
	let imgUploadMethod = $state<'file' | 'url'>('file');
	let imgCounter = $state(10);

	function filteredOfficialImages() {
		if (!imgSearch.trim()) return officialImages;
		const q = imgSearch.toLowerCase();
		return officialImages.filter((i) => i.name.toLowerCase().includes(q) || i.versions.some((v) => v.version.toLowerCase().includes(q)));
	}
	let imgTotalPages = $derived(Math.ceil(filteredOfficialImages().length / imgPerPage));
	let pagedOfficialImages = $derived(() => {
		const list = filteredOfficialImages();
		return list.slice(imgPage * imgPerPage, (imgPage + 1) * imgPerPage);
	});
	let filteredVmUserImages = $derived(() => {
		if (!imgSearch.trim()) return vmUserImages;
		const q = imgSearch.toLowerCase();
		return vmUserImages.filter((i) => i.name.toLowerCase().includes(q));
	});

	function openImageDetail(img: OfficialImage) { selectedOfficialImage = img; imgSheetOpen = true; }
	function closeImageDetail() { imgSheetOpen = false; setTimeout(() => (selectedOfficialImage = null), 200); }
	function mountOfficialVersion(name: string, version: string) { mountedImage = `${name} ${version}`; }
	function mountUserImage(name: string) { mountedImage = name; }
	function unmountImage() { mountedImage = null; }
	function startRebuild(name: string, version: string) { rebuildFromImage = { name, version }; rebuildImageConfirm = ''; }

	function doRebuildFromImage() {
		if (rebuildImageConfirm !== selectedServer.id || !rebuildFromImage) return;
		rebuildingFromImage = true;
		servers[selectedServerIdx].status = 'restarting';
		const rb = rebuildFromImage;
		setTimeout(() => {
			servers[selectedServerIdx].status = 'running';
			servers[selectedServerIdx].os = `${rb.name} ${rb.version}`;
			rebuildingFromImage = false;
			rebuildFromImage = null;
			rebuildImageConfirm = '';
		}, 3000);
	}

	function detectImgType(filename: string): ImageType | null {
		const ext = filename.split('.').pop()?.toLowerCase();
		if (ext === 'iso') return 'iso';
		if (ext === 'img') return 'img';
		if (ext === 'qcow2') return 'qcow2';
		return null;
	}
	function handleImgFileSelect(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		imgUploadFile = f.name;
		imgUploadDetectedType = detectImgType(f.name);
		if (!imgUploadName) imgUploadName = f.name.replace(/\.[^.]+$/, '');
	}
	function handleImgUrlChange() {
		if (imgUploadUrl) imgUploadDetectedType = detectImgType(imgUploadUrl.split('/').pop() ?? '');
	}
	function startImgUpload() {
		if (!imgUploadName.trim()) return;
		const type = imgUploadDetectedType ?? 'img';
		imgCounter++;
		const sizes = ['1.2 GB', '2.8 GB', '4.5 GB', '680 MB', '9.1 GB'];
		const newImg: UserImage = { id: `img-${String(imgCounter).padStart(3, '0')}`, name: imgUploadName.trim(), type, size: sizes[Math.floor(Math.random() * sizes.length)], uploaded: new Date().toISOString().slice(0, 10), status: 'uploading', progress: 0 };
		vmUserImages.push(newImg);
		imgUploadOpen = false;
		imgUploadName = ''; imgUploadFile = ''; imgUploadUrl = ''; imgUploadDetectedType = null;
		const idx = vmUserImages.length - 1;
		const tick = setInterval(() => {
			if (vmUserImages[idx].progress >= 100) { vmUserImages[idx].status = 'processing'; clearInterval(tick); setTimeout(() => { vmUserImages[idx].status = 'ready'; vmUserImages[idx].progress = 100; }, 1500); return; }
			vmUserImages[idx].progress += Math.floor(Math.random() * 15 + 5);
			if (vmUserImages[idx].progress > 100) vmUserImages[idx].progress = 100;
		}, 400);
	}
	function deleteVmImage(id: string) { vmUserImages = vmUserImages.filter((i) => i.id !== id); }

	// Create VM
	let createVmOpen = $state(false);
	let createVmName = $state('');
	let createVmType = $state('');
	let createVmImage = $state('');
	let createVmSshKeys = $state<string[]>([]);
	let creatingVm = $state(false);
	let createVmError = $state('');

	// VM types + images loaded from DB
	type VmType = { id: string; name: string; cores: number; ramCapacity: number; storageAmount: number; rate: string; cap: string };
	type DbImage = { id: string; name: string; version: string; shortName: string; color: string; icon: string | null; filePath: string; description: string };
	let vmTypes = $state<VmType[]>([]);
	let dbImages = $state<DbImage[]>([]);

	async function loadVmTypes() {
		try { vmTypes = await listVmTypes({}); } catch {}
	}
	async function loadDbImages() {
		try { dbImages = await listImages({}); } catch {}
	}

	onMount(() => { loadVmTypes(); loadDbImages(); });

	function openCreateVm() {
		createVmName = '';
		createVmType = vmTypes[0]?.id ?? '';
		createVmImage = dbImages[0]?.filePath ?? '';
		createVmSshKeys = [];
		createVmError = '';
		createVmOpen = true;
	}

	async function doCreateVm() {
		const projectId = data.projects?.[0]?.id;
		if (!projectId || !createVmName.trim() || !createVmType) {
			createVmError = !createVmType ? 'Select a VM type (create one in Admin first)' : 'Enter a server name';
			return;
		}
		creatingVm = true;
		createVmError = '';
		try {
			await createVm({
				projectId,
				vmTypeId: createVmType,
				name: createVmName.trim(),
				imageId: createVmImage || undefined,
				sshKeyIds: createVmSshKeys.length ? createVmSshKeys : undefined
			});
			createVmOpen = false;
			// Reload immediately — VM will appear as "provisioning" and auto-poll
			await loadVms();
		} catch (err) {
			createVmError = err instanceof Error ? err.message : 'Failed to create VM';
		} finally {
			creatingVm = false;
		}
	}

	const sevColors: Record<Severity, string> = {
		info: 'text-blue-400',
		warn: 'text-amber-400',
		error: 'text-red-400',
		debug: 'text-fyra-gray-500'
	};

	$effect(() => {
		if (!logStreaming) return;
		const sid = selectedServerId;
		const sv = servers.find((s) => s.id === sid);
		if (!sv || sv.status !== 'running' || !sv.agentConnected) return;
		const interval = setInterval(() => {
			if (!serverLogs[sid]) serverLogs[sid] = [];
			serverLogs[sid].push(randomLog());
			if (serverLogs[sid].length > 100) serverLogs[sid] = serverLogs[sid].slice(-100);
		}, 1500);
		return () => clearInterval(interval);
	});

	$effect(() => {
		filteredLogs();
		if (logStreaming && logContainer) {
			requestAnimationFrame(() => { logContainer!.scrollTop = logContainer!.scrollHeight; });
		}
	});
</script>

<!-- Server list panel -->
<div class="flex w-64 shrink-0 flex-col border-r border-fyra-gray-800">
	<div class="flex h-10 shrink-0 items-center justify-between border-b border-fyra-gray-800 px-4">
		<div class="flex items-center">
			<span class="text-sm font-semibold text-fyra-gray-100">Servers</span>
			<Badge variant="secondary" class="ml-2 text-[10px]">{servers.length}</Badge>
		</div>
		<Button variant="ghost" size="sm" class="h-6 w-6 p-0 text-fyra-gray-400 hover:text-fyra-gray-100" onclick={openCreateVm}>
			<Plus class="h-3.5 w-3.5" />
		</Button>
	</div>
	<div class="flex-1 overflow-y-auto">
		{#each servers as server (server.id)}
			<button
				class="flex w-full items-start justify-between border-b border-fyra-gray-800 px-4 py-3 text-left transition-colors duration-100 {selectedServerId ===
				server.id
					? 'bg-fyra-gray-800/60'
					: 'hover:bg-fyra-gray-800/30'}"
				onclick={() => {
					selectedServerId = server.id;
					activeTab = 'overview';
				}}
			>
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold text-fyra-gray-100">{server.name}</p>
					<p class="mt-0.5 truncate text-xs text-fyra-gray-500">
						{server.vcpu} vCPU &bull; {server.ram} RAM &bull; {server.ip}
					</p>
				</div>
				<span
					class="mt-1 ml-2 h-2 w-2 shrink-0 rounded-full {server.status === 'running'
						? 'bg-emerald-500'
						: server.status === 'provisioning'
							? 'animate-pulse bg-blue-500'
							: server.status === 'restarting'
								? 'animate-pulse bg-amber-500'
								: 'bg-fyra-red-500'}"
				></span>
			</button>
		{/each}

		{#if loadingVms}
			<div class="flex flex-col items-center justify-center py-16 text-fyra-gray-500">
				<Loader2 class="mb-3 h-5 w-5 animate-spin" />
				<p class="text-xs">Loading...</p>
			</div>
		{:else if servers.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-fyra-gray-500">
				<HardDrive class="mb-3 h-6 w-6" />
				<p class="text-xs">No servers</p>
				<Button variant="outline" size="sm" class="mt-3 gap-1.5 text-xs" onclick={openCreateVm}>
					<Plus class="h-3 w-3" />
					Create Server
				</Button>
			</div>
		{/if}
	</div>
</div>

<!-- Main content -->
<div class="flex flex-1 flex-col overflow-hidden">
	{#if servers.length > 0}
		<!-- Server header with power actions -->
		<div
			class="flex h-10 shrink-0 items-center justify-between border-b border-fyra-gray-800 px-4"
		>
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-fyra-gray-200">{selectedServer.name}</span>
				<Badge
					variant="outline"
					class="text-[10px] {selectedServer.status === 'running'
						? 'border-emerald-800 bg-emerald-950/40 text-emerald-400'
						: selectedServer.status === 'provisioning'
							? 'border-blue-800 bg-blue-950/40 text-blue-400'
							: selectedServer.status === 'restarting'
								? 'border-amber-800 bg-amber-950/40 text-amber-400'
								: 'border-fyra-red-800 bg-fyra-red-950/40 text-fyra-red-400'}"
				>
					{selectedServer.status === 'provisioning' ? 'provisioning...' : selectedServer.status}
				</Badge>
			</div>
			<div class="flex items-center gap-1.5">
				<Button
					variant="outline"
					size="sm"
					class="h-7 gap-1.5 px-3 text-xs"
					disabled={selectedServer.status === 'running' ||
						selectedServer.status === 'restarting' ||
						selectedServer.status === 'provisioning'}
					onclick={() => setStatus('running')}
				>
					<Play class="h-3 w-3" />
					Start
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="h-7 gap-1.5 px-3 text-xs"
					disabled={selectedServer.status === 'stopped' ||
						selectedServer.status === 'restarting' ||
						selectedServer.status === 'provisioning'}
					onclick={() => setStatus('restarting')}
				>
					<RotateCw
						class="h-3 w-3 {selectedServer.status === 'restarting' ? 'animate-spin' : ''}"
					/>
					Restart
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="h-7 gap-1.5 border-fyra-red-700 px-3 text-xs text-fyra-red-400 hover:bg-fyra-red-950"
					disabled={selectedServer.status === 'stopped' ||
						selectedServer.status === 'provisioning'}
					onclick={() => setStatus('stopped')}
				>
					<PowerOff class="h-3 w-3" />
					Kill
				</Button>
			</div>
		</div>

		<!-- Tab navigation -->
		<div
			class="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-fyra-gray-800 px-2"
		>
			{#each tabs as tab (tab.id)}
				<button
					class="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors duration-100 {activeTab ===
					tab.id
						? 'border-b-2 border-fyra-red-500 text-fyra-gray-50'
						: 'text-fyra-gray-500 hover:text-fyra-gray-300'}"
					onclick={() => (activeTab = tab.id)}
				>
					<tab.icon class="h-3 w-3" />
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Tab content -->
		<div class="flex flex-1 flex-col overflow-hidden">
			{#if activeTab === 'overview'}
				<!-- Metrics row -->
				<div
					class="grid shrink-0 grid-cols-4 divide-x divide-fyra-gray-800 border-b border-fyra-gray-800"
				>
					{#each charts as chart (chart.label)}
						<div class="relative flex flex-col">
							<div class="flex items-baseline justify-between px-4 pt-3 pb-1">
								<span class="relative z-10 text-xs font-medium text-fyra-gray-400">{chart.label}</span>
								<span class="relative z-10 text-xs font-semibold text-fyra-gray-200">{chart.value}</span>
							</div>
							<div>
								<svg viewBox="0 0 240 80" class="block h-28 w-full" preserveAspectRatio="none">
									<polygon
										points="{chart.points} 240,80 0,80"
										fill={chart.color}
										opacity="0.08"
									/>
									<polyline
										points={chart.points}
										fill="none"
										stroke={chart.color}
										stroke-width="2"
										stroke-linejoin="round"
										stroke-linecap="round"
										vector-effect="non-scaling-stroke"
									/>
								</svg>
							</div>
						</div>
					{/each}
				</div>

				<!-- Info grid + Terminal -->
				<div class="grid shrink-0 grid-cols-5 divide-x divide-fyra-gray-800 border-b border-fyra-gray-800">
					<!-- Server info -->
					<div class="col-span-2 divide-y divide-fyra-gray-800/50">
						<div class="px-5 py-3">
							<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500">Server Details</span>
						</div>
						{#each [
							['Plan', selectedServer.plan],
							['OS', selectedServer.os],
							['Region', selectedServer.region],
							['vCPU', `${selectedServer.vcpu} cores`],
							['RAM', selectedServer.ram],
							['Disk', selectedServer.disk],
							['Created', selectedServer.created],
							['Uptime', selectedServer.uptime]
						] as [label, value]}
							<div class="flex items-center justify-between px-5 py-2">
								<span class="text-xs text-fyra-gray-500">{label}</span>
								<span class="text-xs font-medium text-fyra-gray-200">{value}</span>
							</div>
						{/each}
						<div class="flex items-center justify-between px-5 py-2">
							<span class="text-xs text-fyra-gray-500">IPv4</span>
							<div class="flex items-center gap-1.5">
								<span class="font-mono text-xs text-fyra-gray-200">{selectedServer.ip}</span>
								<button class="text-fyra-gray-500 hover:text-fyra-gray-300" onclick={() => copyToClipboard(selectedServer.ip, 'ipv4')}>
									{#if copied === 'ipv4'}<Check class="h-3 w-3 text-emerald-500" />{:else}<Copy class="h-3 w-3" />{/if}
								</button>
							</div>
						</div>
						<div class="flex items-center justify-between px-5 py-2">
							<span class="text-xs text-fyra-gray-500">IPv6</span>
							<div class="flex items-center gap-1.5">
								<span class="font-mono text-[11px] text-fyra-gray-200">{selectedServer.ipv6}</span>
								<button class="text-fyra-gray-500 hover:text-fyra-gray-300" onclick={() => copyToClipboard(selectedServer.ipv6, 'ipv6')}>
									{#if copied === 'ipv6'}<Check class="h-3 w-3 text-emerald-500" />{:else}<Copy class="h-3 w-3" />{/if}
								</button>
							</div>
						</div>
					</div>

					<!-- Terminal -->
					<div class="col-span-3 flex flex-col">
						<div class="flex items-center gap-2 border-b border-fyra-gray-800 px-4 py-2.5">
							<Terminal class="h-3 w-3 text-fyra-gray-500" />
							<span class="text-xs font-semibold text-fyra-gray-400">Console</span>
						</div>
						<div class="min-h-[180px] flex-1 bg-fyra-gray-950 p-4 font-mono text-sm leading-relaxed text-fyra-gray-300">
							{#if selectedServer.status === 'running'}
								{#each terminalLines as line}
									{#if line.type === 'prompt'}
										<div><span class="text-fyra-gray-500">user@{selectedServer.name}~:</span> {line.text}</div>
									{:else if line.type === 'output'}
										<div class="text-fyra-gray-400">{line.text}</div>
									{:else}
										<div><span class="text-fyra-gray-500">user@{selectedServer.name}~:</span> <span class="inline-block h-4 w-1.5 animate-pulse bg-fyra-gray-400"></span></div>
									{/if}
								{/each}
							{:else if selectedServer.status === 'restarting'}
								<div class="text-amber-500">Restarting server...</div>
							{:else}
								<div class="text-fyra-gray-600">Server is offline. Start the server to connect.</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Logs panel -->
				<div class="flex min-h-0 flex-1 flex-col">
					<div class="flex h-8 shrink-0 items-center justify-between border-b border-fyra-gray-800 px-4">
						<div class="flex items-center gap-2">
							<FileText class="h-3 w-3 text-fyra-gray-500" />
							<span class="text-xs font-semibold text-fyra-gray-400">Logs</span>
							{#if hasLogFilters}
								<span class="text-[9px] text-fyra-gray-500">
									{filteredLogs().length}/{currentLogs.length}
								</span>
								<button class="text-[9px] text-fyra-red-400 hover:text-fyra-red-300" onclick={clearLogFilters}>clear</button>
							{/if}
						</div>
						<div class="flex items-center gap-1">
							<Button variant="ghost" size="sm" class="h-6 w-6 p-0" onclick={() => (logStreaming = !logStreaming)}>
								{#if logStreaming}<Pause class="h-2.5 w-2.5" />{:else}<Play class="h-2.5 w-2.5" />{/if}
							</Button>
							<Button variant="ghost" size="sm" class="h-6 w-6 p-0 text-fyra-red-400" onclick={() => { serverLogs[selectedServerId] = []; }}>
								<Trash2 class="h-2.5 w-2.5" />
							</Button>
						</div>
					</div>
					<div class="flex-1 overflow-auto bg-fyra-gray-950 font-mono text-[11px] leading-relaxed" bind:this={logContainer}>
						{#if selectedServer.status !== 'running'}
							<div class="flex h-full flex-col items-center justify-center gap-3">
								<AlertTriangle class="h-8 w-8 text-amber-500/60" />
								<div class="text-center">
									<p class="text-sm font-medium text-fyra-gray-300">Server not running</p>
									<p class="mt-1 text-xs text-fyra-gray-500">Start the server to connect to the guest agent.</p>
								</div>
								<Button variant="outline" size="sm" class="mt-1 gap-1.5 text-xs" onclick={() => setStatus('running')} disabled={selectedServer.status === 'restarting'}>
									<Play class="h-3 w-3" />
									Start Server
								</Button>
							</div>
						{:else if !selectedServer.agentConnected}
							<div class="flex h-full flex-col items-center justify-center gap-3">
								<AlertTriangle class="h-8 w-8 text-fyra-red-400/60" />
								<div class="text-center">
									<p class="text-sm font-medium text-fyra-gray-300">Guest agent unreachable</p>
									<p class="mt-1 max-w-xs text-xs text-fyra-gray-500">The server is running but the guest agent is not responding. Ensure the agent is installed and the network is configured.</p>
								</div>
							</div>
						{:else}
							{#each filteredLogs() as entry (entry.id)}
								<div class="flex items-baseline gap-0 px-4 py-px leading-[1.6] hover:bg-fyra-gray-800/20">
									<span class="w-[148px] shrink-0 text-fyra-gray-600">{entry.timestamp}</span>
									<button class="w-[42px] shrink-0 text-left font-semibold uppercase {sevColors[entry.severity]} {logSevFilter === entry.severity ? 'underline' : ''}" onclick={() => (logSevFilter = logSevFilter === entry.severity ? null : entry.severity)}>{entry.severity.slice(0, 4)}</button>
									<button class="w-[72px] shrink-0 text-left text-fyra-gray-500 hover:text-fyra-gray-300 {logSourceFilter === entry.source ? 'text-fyra-gray-200' : ''}" onclick={() => (logSourceFilter = logSourceFilter === entry.source ? null : entry.source)}>{entry.source}</button>
									<span class="text-fyra-gray-300">{entry.message}</span>
								</div>
							{/each}
							{#if filteredLogs().length === 0 && currentLogs.length > 0}
								<div class="flex items-center justify-center py-8 text-xs text-fyra-gray-600">No logs match filter</div>
							{:else if currentLogs.length === 0}
								<div class="flex items-center justify-center py-8 text-xs text-fyra-gray-600">No logs yet</div>
							{/if}
						{/if}
					</div>
				</div>

			{:else if activeTab === 'console'}
				<!-- Full Console tab -->
				<div class="min-h-0 flex-1 overflow-auto bg-fyra-gray-950 p-5 font-mono text-sm leading-relaxed text-fyra-gray-300">
					{#if selectedServer.status === 'running'}
						{#each terminalLines as line}
							{#if line.type === 'prompt'}
								<div><span class="text-fyra-gray-500">user@{selectedServer.name}~:</span> {line.text}</div>
							{:else if line.type === 'output'}
								<div class="text-fyra-gray-400">{line.text}</div>
							{:else}
								<div><span class="text-fyra-gray-500">user@{selectedServer.name}~:</span> <span class="inline-block h-4 w-1.5 animate-pulse bg-fyra-gray-400"></span></div>
							{/if}
						{/each}
					{:else if selectedServer.status === 'restarting'}
						<div class="text-amber-500">Restarting server...</div>
					{:else}
						<div class="text-fyra-gray-600">Server is offline. Start the server to connect.</div>
					{/if}
				</div>

			{:else if activeTab === 'logs'}
				<!-- Full Logs tab -->
				<div class="flex h-8 shrink-0 items-center justify-between border-b border-fyra-gray-800 px-4">
					<div class="flex items-center gap-2">
						<span class="text-xs font-medium text-fyra-gray-300">{selectedServer.name}</span>
						{#if hasLogFilters}
							<span class="text-[9px] text-fyra-gray-500">{filteredLogs().length}/{currentLogs.length}</span>
							{#if logSevFilter}
								<button onclick={() => (logSevFilter = null)}>
									<Badge variant="outline" class="cursor-pointer gap-1 text-[8px] {sevColors[logSevFilter]}">
										{logSevFilter.toUpperCase()}
										<X class="h-2 w-2" />
									</Badge>
								</button>
							{/if}
							{#if logSourceFilter}
								<button onclick={() => (logSourceFilter = null)}>
									<Badge variant="secondary" class="cursor-pointer gap-1 text-[8px]">
										{logSourceFilter}
										<X class="h-2 w-2" />
									</Badge>
								</button>
							{/if}
						{/if}
					</div>
					<div class="flex items-center gap-1.5">
						<div class="relative">
							<Search class="pointer-events-none absolute left-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-fyra-gray-500" />
							<input
								bind:value={logSearch}
								placeholder="Search..."
								class="h-6 w-36 border border-fyra-gray-700 bg-fyra-gray-800 pl-6 pr-2 text-[11px] text-fyra-gray-100 placeholder:text-fyra-gray-600 focus:border-fyra-gray-500 focus:outline-none"
							/>
						</div>
						{#if hasLogFilters}
							<button class="text-[9px] text-fyra-red-400 hover:text-fyra-red-300" onclick={clearLogFilters}>Clear</button>
						{/if}
						<Button variant="ghost" size="sm" class="h-6 w-6 p-0" onclick={() => (logStreaming = !logStreaming)}>
							{#if logStreaming}<Pause class="h-2.5 w-2.5" />{:else}<Play class="h-2.5 w-2.5" />{/if}
						</Button>
						<Button variant="ghost" size="sm" class="h-6 w-6 p-0 text-fyra-red-400" onclick={() => { serverLogs[selectedServerId] = []; }}>
							<Trash2 class="h-2.5 w-2.5" />
						</Button>
					</div>
				</div>
				<div class="min-h-0 flex-1 overflow-auto bg-fyra-gray-950 font-mono text-[11px] leading-relaxed" bind:this={logContainer}>
					{#if selectedServer.status !== 'running'}
						<div class="flex h-full flex-col items-center justify-center gap-3">
							<AlertTriangle class="h-10 w-10 text-amber-500/60" />
							<div class="text-center">
								<p class="text-base font-medium text-fyra-gray-200">Server not running</p>
								<p class="mt-1 text-xs text-fyra-gray-500">Start the server to connect to the guest agent and stream logs.</p>
							</div>
							<Button variant="outline" size="sm" class="mt-2 gap-1.5 text-xs" onclick={() => setStatus('running')} disabled={selectedServer.status === 'restarting'}>
								<Play class="h-3 w-3" />
								Start Server
							</Button>
						</div>
					{:else if !selectedServer.agentConnected}
						<div class="flex h-full flex-col items-center justify-center gap-3">
							<AlertTriangle class="h-10 w-10 text-fyra-red-400/60" />
							<div class="text-center">
								<p class="text-base font-medium text-fyra-gray-200">Guest agent unreachable</p>
								<p class="mt-1 max-w-sm text-xs text-fyra-gray-500">The server is running but the guest agent is not responding. Ensure the agent is installed and the network is configured correctly.</p>
							</div>
						</div>
					{:else}
						{#each filteredLogs() as entry (entry.id)}
							<div class="flex items-baseline gap-0 px-4 py-px leading-[1.6] hover:bg-fyra-gray-800/20">
								<span class="w-[148px] shrink-0 text-fyra-gray-600">{entry.timestamp}</span>
								<button class="w-[42px] shrink-0 cursor-pointer text-left font-semibold uppercase {sevColors[entry.severity]} {logSevFilter === entry.severity ? 'underline' : ''}" onclick={() => (logSevFilter = logSevFilter === entry.severity ? null : entry.severity)}>{entry.severity.slice(0, 4)}</button>
								<button class="w-[72px] shrink-0 cursor-pointer text-left text-fyra-gray-500 hover:text-fyra-gray-300 {logSourceFilter === entry.source ? 'text-fyra-gray-200' : ''}" onclick={() => (logSourceFilter = logSourceFilter === entry.source ? null : entry.source)}>{entry.source}</button>
								<span class="text-fyra-gray-300">{entry.message}</span>
							</div>
						{/each}
						{#if filteredLogs().length === 0 && currentLogs.length > 0}
							<div class="flex items-center justify-center py-16 text-xs text-fyra-gray-600">No logs match filter</div>
						{:else if currentLogs.length === 0}
							<div class="flex items-center justify-center py-16 text-xs text-fyra-gray-600">No logs yet</div>
						{/if}
					{/if}
				</div>

			{:else}
			<div class="flex-1 overflow-auto">
			{#if activeTab === 'networking'}
				<div class="divide-y divide-fyra-gray-800/50">
					<div class="px-5 py-3">
						<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500">Public Network</span>
					</div>
					<!-- IPv4 -->
					<div class="px-5 py-3">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-fyra-gray-100">IPv4 Address</p>
								<p class="mt-0.5 font-mono text-xs text-fyra-gray-400">{selectedServer.ip}</p>
							</div>
							<button class="text-fyra-gray-500 hover:text-fyra-gray-300" onclick={() => copyToClipboard(selectedServer.ip, 'net-ipv4')}>
								{#if copied === 'net-ipv4'}<Check class="h-3.5 w-3.5 text-emerald-500" />{:else}<Copy class="h-3.5 w-3.5" />{/if}
							</button>
						</div>
						<div class="mt-2 flex items-center justify-between">
							<span class="text-xs text-fyra-gray-500">Reverse DNS</span>
							{#if editingRdnsKey === 'ipv4'}
								<div class="flex items-center gap-1.5">
									<Input bind:value={rdnsValue} class="h-7 w-56 text-xs" placeholder="hostname.example.com" />
									<Button variant="ghost" size="sm" class="h-7 w-7 p-0 text-emerald-500" onclick={saveIpv4Rdns}><Check class="h-3 w-3" /></Button>
									<Button variant="ghost" size="sm" class="h-7 w-7 p-0" onclick={() => (editingRdnsKey = null)}><X class="h-3 w-3" /></Button>
								</div>
							{:else}
								<div class="flex items-center gap-1.5">
									<span class="font-mono text-xs text-fyra-gray-300">{ipv4Rdns[selectedServerId] || '—'}</span>
									<Button variant="ghost" size="sm" class="h-7 w-7 p-0" onclick={() => startRdnsEdit('ipv4', ipv4Rdns[selectedServerId] ?? '')}><Pencil class="h-3 w-3" /></Button>
								</div>
							{/if}
						</div>
					</div>
					<!-- IPv6 Subnet -->
					<div class="px-5 py-3">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-fyra-gray-100">IPv6 Subnet</p>
								<p class="mt-0.5 font-mono text-xs text-fyra-gray-400">{selectedServer.ipv6}</p>
							</div>
							<Button variant="outline" size="sm" class="h-7 gap-1.5 px-3 text-xs" onclick={() => {
								const prefix = selectedServer.ipv6.replace('::/64', '');
								newIpv6Addr = prefix + '::';
								newIpv6Rdns = '';
								addIpv6Open = true;
							}}>
								<Plus class="h-3 w-3" />
								Add Address
							</Button>
						</div>
					</div>
					<!-- IPv6 per-IP entries -->
					{#each ipv6Entries[selectedServerId] ?? [] as entry, idx (entry.ip)}
						<div class="flex items-center justify-between px-5 py-2.5">
							<div class="flex items-center gap-3">
								<span class="font-mono text-xs text-fyra-gray-200">{entry.ip}</span>
								{#if editingRdnsKey === `ipv6-${idx}`}
									<div class="flex items-center gap-1.5">
										<Input bind:value={rdnsValue} class="h-7 w-48 text-xs" placeholder="hostname" />
										<Button variant="ghost" size="sm" class="h-7 w-7 p-0 text-emerald-500" onclick={() => saveIpv6Rdns(idx)}><Check class="h-3 w-3" /></Button>
										<Button variant="ghost" size="sm" class="h-7 w-7 p-0" onclick={() => (editingRdnsKey = null)}><X class="h-3 w-3" /></Button>
									</div>
								{:else}
									<span class="font-mono text-xs text-fyra-gray-500">{entry.rdns || '—'}</span>
								{/if}
							</div>
							{#if editingRdnsKey !== `ipv6-${idx}`}
								<div class="flex items-center gap-1">
									<Button variant="ghost" size="sm" class="h-7 w-7 p-0" onclick={() => startRdnsEdit(`ipv6-${idx}`, entry.rdns)}><Pencil class="h-3 w-3" /></Button>
									<Button variant="ghost" size="sm" class="h-7 w-7 p-0 text-fyra-red-400 hover:text-fyra-red-300" onclick={() => deleteIpv6Entry(idx)}><Trash2 class="h-3 w-3" /></Button>
								</div>
							{/if}
						</div>
					{/each}
					{#if (ipv6Entries[selectedServerId] ?? []).length === 0}
						<div class="px-5 py-3 text-xs text-fyra-gray-500">No IPv6 addresses configured. Add one from the subnet above.</div>
					{/if}
					<div class="px-5 py-3">
						<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500">Firewall</span>
					</div>
					<div class="flex items-center justify-between px-5 py-3">
						<div>
							<p class="text-sm font-medium text-fyra-gray-100">web-servers</p>
							<p class="mt-0.5 text-xs text-fyra-gray-400">3 inbound, 1 outbound rules</p>
						</div>
						<Badge variant="outline" class="border-emerald-800 bg-emerald-950/40 text-[10px] text-emerald-400">Active</Badge>
					</div>
					<div class="px-5 py-3">
						<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500">Private Network</span>
					</div>
					<div class="flex items-center justify-between px-5 py-3">
						<div>
							<p class="text-sm font-medium text-fyra-gray-100">internal-net</p>
							<p class="mt-0.5 font-mono text-xs text-fyra-gray-400">10.132.0.0/16</p>
						</div>
						<Badge variant="outline" class="border-emerald-800 bg-emerald-950/40 text-[10px] text-emerald-400">Connected</Badge>
					</div>
				</div>

			{:else if activeTab === 'images'}
				<div class="flex flex-1 flex-col overflow-hidden">
					<!-- Mounted image banner -->
					{#if mountedImage}
						<div class="flex items-center justify-between border-b border-fyra-gray-800 bg-fyra-gray-800/20 px-5 py-2.5">
							<div class="flex items-center gap-2">
								<Disc class="h-3 w-3 text-fyra-red-400" />
								<span class="text-xs font-medium text-fyra-gray-200">Mounted: {mountedImage}</span>
							</div>
							<Button variant="ghost" size="sm" class="h-7 px-2 text-xs" onclick={unmountImage}>Unmount</Button>
						</div>
					{/if}

					<!-- Rebuild confirmation -->
					{#if rebuildFromImage}
						<div class="border-b border-fyra-gray-800 bg-fyra-red-950/10 px-5 py-3">
							<h3 class="text-sm font-semibold text-fyra-gray-100">Rebuild from {rebuildFromImage.name} {rebuildFromImage.version}</h3>
							<p class="mt-1 text-xs text-fyra-gray-400">This will wipe all data and reinstall from this image. Type the server name to confirm.</p>
							<div class="mt-3 flex items-center gap-2">
								<Input bind:value={rebuildImageConfirm} placeholder={selectedServer.id} class="h-8 w-56 font-mono text-xs" />
								<Button variant="outline" size="sm" class="gap-1.5 border-fyra-red-700 px-3 text-xs text-fyra-red-400 hover:bg-fyra-red-950" disabled={rebuildImageConfirm !== selectedServer.id || rebuildingFromImage} onclick={doRebuildFromImage}>
									{#if rebuildingFromImage}<RotateCw class="h-3 w-3 animate-spin" /> Rebuilding...{:else}Rebuild{/if}
								</Button>
								<Button variant="ghost" size="sm" class="h-8 px-2 text-xs" onclick={() => (rebuildFromImage = null)}>Cancel</Button>
							</div>
						</div>
					{/if}

					<!-- Search + Upload -->
					<div class="flex items-center justify-between border-b border-fyra-gray-800 px-5 py-2.5">
						<div class="relative">
							<Search class="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-fyra-gray-500" />
							<input bind:value={imgSearch} placeholder="Search images..." class="h-7 w-44 border border-fyra-gray-700 bg-fyra-gray-800 pl-7 pr-2 text-xs text-fyra-gray-100 placeholder:text-fyra-gray-600 focus:border-fyra-gray-500 focus:outline-none" />
						</div>
						<Button variant="outline" size="sm" class="h-7 gap-1.5 px-3 text-xs" onclick={() => { imgUploadOpen = true; imgUploadMethod = 'file'; imgUploadFile = ''; imgUploadUrl = ''; imgUploadName = ''; imgUploadDetectedType = null; }}>
							<Upload class="h-3 w-3" /> Upload Image
						</Button>
					</div>

					<div class="flex-1 overflow-auto">
						<!-- Official Images -->
						<div class="flex items-center justify-between border-b border-fyra-gray-800 px-5 py-2.5">
							<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500">Official Images</span>
							{#if imgTotalPages > 1}
								<div class="flex items-center gap-1.5">
									<button class="flex h-6 w-6 items-center justify-center text-fyra-gray-500 hover:text-fyra-gray-300 disabled:opacity-30" disabled={imgPage === 0} onclick={() => imgPage--}>
										<ChevronLeft class="h-3.5 w-3.5" />
									</button>
									<span class="text-[10px] text-fyra-gray-500">{imgPage + 1}/{imgTotalPages}</span>
									<button class="flex h-6 w-6 items-center justify-center text-fyra-gray-500 hover:text-fyra-gray-300 disabled:opacity-30" disabled={imgPage >= imgTotalPages - 1} onclick={() => imgPage++}>
										<ChevronRight class="h-3.5 w-3.5" />
									</button>
								</div>
							{/if}
						</div>

						<div class="border-b border-fyra-gray-800">
							<div class="grid grid-cols-2 gap-px bg-fyra-gray-900">
								{#each pagedOfficialImages() as img (img.id)}
									<button class="relative flex gap-3 overflow-hidden bg-fyra-gray-900 p-4 text-left transition-colors hover:bg-fyra-gray-800/40" onclick={() => openImageDetail(img)}>
										<div class="pointer-events-none absolute inset-0 opacity-[0.05]" style="background: linear-gradient(135deg, {img.iconColor} 0%, transparent 60%)"></div>
										<div class="relative shrink-0">
											{#if img.icon}
												<svg viewBox="0 0 24 24" class="h-10 w-10" fill="var(--fyra-gray-300)"><path d={img.icon} /></svg>
											{:else}
												<span class="flex h-10 w-10 items-center justify-center text-lg font-bold text-fyra-gray-300">{img.shortName}</span>
											{/if}
										</div>
										<div class="relative flex min-w-0 flex-1 flex-col">
											<div class="flex items-center gap-1.5">
												<span class="text-sm font-semibold text-fyra-gray-50">{img.name}</span>
												{#if img.paid}
													<Badge variant="outline" class="border-fyra-red-700 bg-fyra-red-950/40 text-[8px] text-fyra-red-400">
														<DollarSign class="mr-0.5 h-2 w-2" /> {img.price}
													</Badge>
												{/if}
											</div>
											<p class="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-fyra-gray-500">{img.description}</p>
											<p class="mt-auto pt-1.5 text-[10px] leading-none text-fyra-gray-600">
												{img.versions[0].archs.join('  ')} | {img.versions.length} version{img.versions.length > 1 ? 's' : ''}
											</p>
										</div>
									</button>
								{/each}
							</div>
							{#if filteredOfficialImages().length === 0 && imgSearch.trim()}
								<div class="px-5 py-6 text-center text-xs text-fyra-gray-500">No official images match "{imgSearch}"</div>
							{/if}
						</div>

						<!-- User Images -->
						<div class="flex items-center justify-between border-b border-fyra-gray-800 px-5 py-2.5">
							<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500">Your Images ({vmUserImages.length})</span>
						</div>
						{#if filteredVmUserImages().length > 0}
							<div class="divide-y divide-fyra-gray-800/20">
								{#each filteredVmUserImages() as img (img.id)}
									<div class="flex items-center justify-between px-5 py-3 transition-colors hover:bg-fyra-gray-800/20">
										<div class="flex items-center gap-2">
											<Disc class="h-2.5 w-2.5 shrink-0 text-fyra-gray-600" />
											<span class="text-xs text-fyra-gray-200">{img.name}</span>
											<Badge variant="outline" class="text-[7px] {imageTypeColors[img.type]}">.{img.type}</Badge>
											<span class="text-[10px] text-fyra-gray-600">{img.size}</span>
										</div>
										<div class="flex items-center gap-1.5">
											{#if img.status === 'ready'}
												{#if mountedImage === img.name}
													<Badge variant="outline" class="border-emerald-800 bg-emerald-950/40 text-[9px] text-emerald-400">Mounted</Badge>
												{:else}
													<Button variant="ghost" size="sm" class="h-6 px-2 text-[10px]" onclick={() => mountUserImage(img.name)}>Mount</Button>
												{/if}
												<Button variant="outline" size="sm" class="h-6 px-2 text-[10px]" onclick={() => startRebuild(img.name, '')}>Rebuild</Button>
												<span class="text-[10px] text-fyra-gray-600">{img.uploaded}</span>
											{:else if img.status === 'uploading'}
												<div class="flex items-center gap-1">
													<div class="h-0.5 w-12 bg-fyra-gray-800"><div class="h-full bg-fyra-red-500 transition-all" style="width: {img.progress}%"></div></div>
													<span class="text-[9px] text-fyra-gray-500">{img.progress}%</span>
												</div>
											{:else}
												<span class="text-[9px] text-amber-500">Processing</span>
											{/if}
											<Button variant="ghost" size="sm" class="h-5 w-5 p-0 text-fyra-gray-600 hover:text-fyra-red-400" onclick={() => deleteVmImage(img.id)} disabled={img.status !== 'ready'}>
												<Trash2 class="h-2.5 w-2.5" />
											</Button>
										</div>
									</div>
								{/each}
							</div>
						{:else if imgSearch.trim()}
							<div class="px-5 py-3 text-center text-[10px] text-fyra-gray-600">No matches</div>
						{:else}
							<div class="flex items-center justify-center gap-1.5 py-3 text-fyra-gray-600">
								<Upload class="h-3 w-3" />
								<p class="text-[10px]">No uploaded images</p>
							</div>
						{/if}
					</div>
				</div>

			{:else if activeTab === 'snapshots'}
				<div>
					<div class="flex items-center justify-between border-b border-fyra-gray-800 px-5 py-3">
						<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500"
							>Snapshots</span
						>
						<Button
							variant="outline"
							size="sm"
							class="h-7 gap-1.5 px-3 text-xs"
							onclick={() => (createSnapOpen = true)}
						>
							<Camera class="h-3 w-3" />
							Take Snapshot
						</Button>
					</div>
					<table class="w-full">
						<thead>
							<tr class="border-b border-fyra-gray-800/50">
								<th class="px-5 py-2.5 text-left text-xs font-medium text-fyra-gray-500"
									>Name</th
								>
								<th class="px-5 py-2.5 text-left text-xs font-medium text-fyra-gray-500"
									>Size</th
								>
								<th class="px-5 py-2.5 text-left text-xs font-medium text-fyra-gray-500"
									>Date</th
								>
								<th class="px-5 py-2.5 text-right text-xs font-medium text-fyra-gray-500"
								></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-fyra-gray-800/30">
							{#each snapshots as snap (snap.id)}
								<tr class="transition-colors duration-100 hover:bg-fyra-gray-800/20">
									<td class="px-5 py-2.5">
										<span class="text-sm font-medium text-fyra-gray-100">{snap.name}</span>
										<span class="ml-2 text-xs text-fyra-gray-600">{snap.id}</span>
									</td>
									<td class="px-5 py-2.5 text-sm text-fyra-gray-300">{snap.size}</td>
									<td class="px-5 py-2.5 text-sm text-fyra-gray-400">{snap.date}</td>
									<td class="px-5 py-2.5 text-right">
										<div class="flex items-center justify-end gap-1">
											<Button variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
												<Download class="h-3 w-3" />
												Restore
											</Button>
											<Button
												variant="ghost"
												size="sm"
												class="h-7 w-7 p-0 text-fyra-red-400 hover:text-fyra-red-300"
												onclick={() => deleteSnapshot(snap.id)}
											>
												<Trash2 class="h-3 w-3" />
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if snapshots.length === 0}
						<div
							class="flex flex-col items-center justify-center py-16 text-fyra-gray-500"
						>
							<Camera class="mb-3 h-8 w-8" />
							<p class="text-sm">No snapshots</p>
							<p class="mt-1 text-xs text-fyra-gray-600">
								Take a snapshot to save your server's current state.
							</p>
						</div>
					{/if}
				</div>

			{:else if activeTab === 'backups'}
				<div>
					<div
						class="flex items-center justify-between border-b border-fyra-gray-800 px-5 py-3"
					>
						<div class="flex items-center gap-2">
							<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500"
								>Automatic Backups</span
							>
							<Badge
								variant="outline"
								class="text-[10px] {selectedServer.backups
									? 'border-emerald-800 bg-emerald-950/40 text-emerald-400'
									: 'text-fyra-gray-500'}"
							>
								{selectedServer.backups ? 'Enabled' : 'Disabled'}
							</Badge>
						</div>
						<Switch
							checked={selectedServer.backups}
							onCheckedChange={(v) => (servers[selectedServerIdx].backups = v)}
							size="sm"
						/>
					</div>

					{#if selectedServer.backups}
						<div class="border-b border-fyra-gray-800/50 px-5 py-2.5">
							<p class="text-xs text-fyra-gray-500">
								Backups run daily at 03:00 UTC. Last 7 backups are retained. Cost: $1/mo
								(20% of plan).
							</p>
						</div>
						<table class="w-full">
							<thead>
								<tr class="border-b border-fyra-gray-800/50">
									<th class="px-5 py-2.5 text-left text-xs font-medium text-fyra-gray-500"
										>Date</th
									>
									<th class="px-5 py-2.5 text-left text-xs font-medium text-fyra-gray-500"
										>Size</th
									>
									<th class="px-5 py-2.5 text-left text-xs font-medium text-fyra-gray-500"
										>Status</th
									>
									<th class="px-5 py-2.5 text-right text-xs font-medium text-fyra-gray-500"
									></th>
								</tr>
							</thead>
							<tbody class="divide-y divide-fyra-gray-800/30">
								{#each backups as backup (backup.id)}
									<tr class="transition-colors duration-100 hover:bg-fyra-gray-800/20">
										<td class="px-5 py-2.5 text-sm text-fyra-gray-200">{backup.date}</td>
										<td class="px-5 py-2.5 text-sm text-fyra-gray-300">{backup.size}</td>
										<td class="px-5 py-2.5">
											<Badge
												variant="outline"
												class="border-emerald-800 bg-emerald-950/40 text-[10px] text-emerald-400"
												>{backup.status}</Badge
											>
										</td>
										<td class="px-5 py-2.5 text-right">
											<Button variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
												<Download class="h-3 w-3" />
												Restore
											</Button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<div
							class="flex flex-col items-center justify-center py-16 text-fyra-gray-500"
						>
							<Clock class="mb-3 h-8 w-8" />
							<p class="text-sm">Backups are disabled</p>
							<p class="mt-1 text-xs text-fyra-gray-600">
								Enable automatic daily backups for this server.
							</p>
						</div>
					{/if}
				</div>

			{:else if activeTab === 'rebuild'}
				<div class="max-w-xl px-5 py-5">
					<h3 class="text-sm font-semibold text-fyra-gray-100">Rebuild Server</h3>
					<p class="mt-1 text-xs text-fyra-gray-400">
						This will wipe all data and reinstall the operating system. This action cannot be
						undone.
					</p>

					<div class="mt-5 flex flex-col gap-4">
						<div class="flex flex-col gap-2">
							<Label class="text-xs">Operating System</Label>
							<select
								bind:value={rebuildOs}
								class="w-full appearance-none border border-fyra-gray-700 bg-fyra-gray-800 px-3 py-2 text-sm text-fyra-gray-100 focus:border-fyra-gray-500 focus:outline-none"
							>
								{#each osOptions as os (os)}
									<option value={os}>{os}</option>
								{/each}
							</select>
						</div>
						<div class="flex flex-col gap-2">
							<Label class="text-xs">Type server name to confirm</Label>
							<Input bind:value={rebuildConfirm} placeholder={selectedServer.id} class="font-mono" />
						</div>
						<Button
							variant="outline"
							size="sm"
							class="w-fit gap-1.5 border-fyra-red-700 px-4 text-xs text-fyra-red-400 hover:bg-fyra-red-950"
							disabled={rebuildConfirm !== selectedServer.id || rebuilding}
							onclick={doRebuild}
						>
							{#if rebuilding}
								<RotateCw class="h-3 w-3 animate-spin" />
								Rebuilding...
							{:else}
								<RotateCw class="h-3 w-3" />
								Rebuild Server
							{/if}
						</Button>
					</div>
				</div>

			{:else if activeTab === 'resize'}
				<div class="px-5 py-5">
					<h3 class="text-sm font-semibold text-fyra-gray-100">Resize Server</h3>
					<p class="mt-1 text-xs text-fyra-gray-400">
						Upgrade or change your server plan. The server will restart during the resize.
					</p>

					<div class="mt-5 grid grid-cols-2 gap-3">
						{#each resizePlans as plan (plan.name)}
							<button
								class="flex flex-col border px-4 py-3 text-left transition-colors duration-100 {plan.name ===
								selectedServer.plan
									? 'cursor-default border-fyra-gray-600 bg-fyra-gray-800/40 opacity-50'
									: resizePlan === plan.name
										? 'border-fyra-red-500 bg-fyra-red-950/20'
										: 'border-fyra-gray-700 hover:border-fyra-gray-600'}"
								disabled={plan.name === selectedServer.plan}
								onclick={() => (resizePlan = plan.name)}
							>
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-fyra-gray-100">{plan.name}</span>
									<span class="text-sm font-medium text-fyra-gray-400">{plan.price}</span>
								</div>
								<span class="mt-1 text-xs text-fyra-gray-500">
									{plan.vcpu} vCPU &bull; {plan.ram} RAM &bull; {plan.disk} SAS3
								</span>
								{#if plan.name === selectedServer.plan}
									<Badge variant="secondary" class="mt-2 w-fit text-[10px]">Current</Badge>
								{/if}
							</button>
						{/each}
					</div>

					{#if resizePlan && resizePlan !== selectedServer.plan}
						<Button
							size="sm"
							class="mt-4 gap-1.5 px-4 text-xs"
							onclick={doResize}
						>
							<ArrowUpDown class="h-3 w-3" />
							Resize to {resizePlan}
						</Button>
					{/if}
				</div>

			{:else if activeTab === 'rescue'}
				<div class="max-w-xl px-5 py-5">
					<h3 class="text-sm font-semibold text-fyra-gray-100">Rescue Mode</h3>
					<p class="mt-1 text-xs text-fyra-gray-400">
						Boot into a minimal rescue system to recover data or fix boot issues.
					</p>

					<div class="mt-5">
						{#if rescueEnabled}
							<div
								class="flex flex-col gap-3 border border-amber-800/50 bg-amber-950/20 p-4"
							>
								<div class="flex items-center gap-2">
									<span
										class="h-2 w-2 animate-pulse rounded-full bg-amber-500"
									></span>
									<span class="text-sm font-medium text-amber-400"
										>Rescue mode is active</span
									>
								</div>
								<div>
									<p class="text-xs text-fyra-gray-400">Root password:</p>
									<div class="mt-1 flex items-center gap-2">
										<code
											class="bg-fyra-gray-800 px-2 py-1 font-mono text-sm text-fyra-gray-100"
											>{rescuePassword}</code
										>
										<button
											class="text-fyra-gray-500 hover:text-fyra-gray-300"
											onclick={() =>
												copyToClipboard(rescuePassword, 'rescue-pw')}
										>
											{#if copied === 'rescue-pw'}
												<Check class="h-3 w-3 text-emerald-500" />
											{:else}
												<Copy class="h-3 w-3" />
											{/if}
										</button>
									</div>
								</div>
								<Button
									variant="outline"
									size="sm"
									class="w-fit gap-1.5 px-4 text-xs"
									onclick={toggleRescue}
								>
									<Power class="h-3 w-3" />
									Disable Rescue Mode
								</Button>
							</div>
						{:else}
							<Button
								variant="outline"
								size="sm"
								class="gap-1.5 px-4 text-xs"
								onclick={toggleRescue}
								disabled={selectedServer.status === 'stopped'}
							>
								<Terminal class="h-3 w-3" />
								Enable Rescue Mode
							</Button>
						{/if}
					</div>
				</div>

			{:else if activeTab === 'settings'}
				<div class="divide-y divide-fyra-gray-800/50">
					<!-- Rename -->
					<div class="flex items-center justify-between px-5 py-4">
						<div>
							<p class="text-sm font-medium text-fyra-gray-100">Server Name</p>
							{#if editingName}
								<div class="mt-2 flex items-center gap-2">
									<Input bind:value={nameValue} class="h-7 w-48 text-xs" />
									<Button
										variant="ghost"
										size="sm"
										class="h-7 w-7 p-0 text-emerald-500"
										onclick={saveName}
									>
										<Check class="h-3 w-3" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										class="h-7 w-7 p-0"
										onclick={() => (editingName = false)}
									>
										<X class="h-3 w-3" />
									</Button>
								</div>
							{:else}
								<p class="mt-0.5 text-xs text-fyra-gray-400">{selectedServer.name}</p>
							{/if}
						</div>
						{#if !editingName}
							<Button
								variant="ghost"
								size="sm"
								class="h-7 gap-1.5 px-2 text-xs"
								onclick={() => {
									nameValue = selectedServer.name;
									editingName = true;
								}}
							>
								<Pencil class="h-3 w-3" />
								Edit
							</Button>
						{/if}
					</div>

					<!-- Backups toggle -->
					<div class="flex items-center justify-between px-5 py-4">
						<div>
							<p class="text-sm font-medium text-fyra-gray-100">Automatic Backups</p>
							<p class="mt-0.5 text-xs text-fyra-gray-400">
								Daily backups at 03:00 UTC — $1/mo
							</p>
						</div>
						<Switch
							checked={selectedServer.backups}
							onCheckedChange={(v) => (servers[selectedServerIdx].backups = v)}
							size="sm"
						/>
					</div>

					<!-- Danger zone -->
					<div class="px-5 py-4">
						<p class="text-sm font-medium text-fyra-red-400">Danger Zone</p>
						<p class="mt-0.5 text-xs text-fyra-gray-500">
							Permanently delete this server and all associated data.
						</p>
						<Button
							variant="outline"
							size="sm"
							class="mt-3 gap-1.5 border-fyra-red-700 px-4 text-xs text-fyra-red-400 hover:bg-fyra-red-950"
							onclick={() => (deleteOpen = true)}
						>
							<Trash2 class="h-3 w-3" />
							Delete Server
						</Button>
					</div>
				</div>
			{/if}
			</div>
		{/if}
		</div>
	{/if}
</div>

<!-- Add IPv6 Address Dialog -->
<Dialog.Root bind:open={addIpv6Open}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add IPv6 Address</Dialog.Title>
			<Dialog.Description>Add an address from your /64 subnet.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-4 py-4">
			<div class="flex flex-col gap-2">
				<Label>IPv6 Address</Label>
				<Input bind:value={newIpv6Addr} placeholder="2607:f8b0:4004:0800::3" class="font-mono" />
			</div>
			<div class="flex flex-col gap-2">
				<Label>Reverse DNS (optional)</Label>
				<Input bind:value={newIpv6Rdns} placeholder="hostname.example.com" />
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (addIpv6Open = false)}>Cancel</Button>
			<Button size="sm" onclick={addIpv6Entry} disabled={!newIpv6Addr.trim()}>Add</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Create Snapshot Dialog -->
<Dialog.Root bind:open={createSnapOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Take Snapshot</Dialog.Title>
			<Dialog.Description>
				Create a point-in-time snapshot of {selectedServer.name}.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-2 py-4">
			<Label>Snapshot Name</Label>
			<Input bind:value={newSnapName} placeholder="my-snapshot" />
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (createSnapOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={createSnapshot} disabled={!newSnapName.trim()}>Create</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete Server Dialog -->
<Dialog.Root bind:open={deleteOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete Server</Dialog.Title>
			<Dialog.Description>
				This will permanently destroy <strong>{selectedServer.name}</strong> and all its data. This
				cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-2 py-4">
			<Label>Type server name to confirm</Label>
			<Input bind:value={deleteConfirm} placeholder={selectedServer.id} class="font-mono" />
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (deleteOpen = false)}>Cancel</Button>
			<Button
				variant="outline"
				size="sm"
				class="border-fyra-red-700 text-fyra-red-400 hover:bg-fyra-red-950"
				disabled={deleteConfirm !== selectedServer.id}
				onclick={doDelete}
			>
				Delete Server
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Image Detail Sheet -->
<Sheet.Root bind:open={imgSheetOpen} onOpenChange={(v) => { if (!v) closeImageDetail(); }}>
	<Sheet.Content side="right" class="border-fyra-gray-800 bg-fyra-gray-900 px-6 py-5 sm:max-w-md">
		{#if selectedOfficialImage}
			<Sheet.Header class="border-b border-fyra-gray-800 pb-4">
				<div class="flex items-start gap-4">
					<div class="shrink-0">
						{#if selectedOfficialImage.icon}
							<svg viewBox="0 0 24 24" class="h-14 w-14" fill="var(--fyra-gray-300)"><path d={selectedOfficialImage.icon} /></svg>
						{:else}
							<span class="flex h-14 w-14 items-center justify-center text-2xl font-bold text-fyra-gray-300">{selectedOfficialImage.shortName}</span>
						{/if}
					</div>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<Sheet.Title class="text-base">{selectedOfficialImage.name}</Sheet.Title>
							{#if selectedOfficialImage.paid}
								<Badge variant="outline" class="border-fyra-red-700 bg-fyra-red-950/40 text-[9px] text-fyra-red-400">
									<DollarSign class="mr-0.5 h-2 w-2" /> {selectedOfficialImage.price}
								</Badge>
							{/if}
						</div>
						<Sheet.Description class="mt-1 text-xs leading-relaxed">{selectedOfficialImage.description}</Sheet.Description>
					</div>
				</div>
			</Sheet.Header>

			<div class="flex-1 overflow-auto py-4">
				<span class="text-[10px] font-semibold uppercase tracking-wider text-fyra-gray-500">Available Versions</span>
				<div class="mt-3 divide-y divide-fyra-gray-800/30">
					{#each selectedOfficialImage.versions as ver (ver.version)}
						<div class="flex items-center justify-between py-3">
							<div class="flex items-center gap-3">
								<span class="text-sm font-medium text-fyra-gray-100">{ver.version}</span>
								<div class="flex gap-1">
									{#each ver.archs as arch (arch)}
										<span class="border border-fyra-gray-700 px-1.5 py-0.5 font-mono text-[9px] text-fyra-gray-400">{arch}</span>
									{/each}
								</div>
							</div>
							<div class="flex items-center gap-2">
								<Badge variant="outline" class="text-[8px] {imageTypeColors[ver.type]}">{ver.type.toUpperCase()}</Badge>
								<span class="text-[10px] text-fyra-gray-500">{ver.size}</span>
							</div>
						</div>
						<div class="flex items-center gap-2 pb-3">
							<Button variant="ghost" size="sm" class="h-7 gap-1.5 px-3 text-xs" onclick={() => { mountOfficialVersion(selectedOfficialImage!.name, ver.version); }}>
								<Disc class="h-3 w-3" /> Mount
							</Button>
							<Button variant="outline" size="sm" class="h-7 gap-1.5 border-fyra-red-700 px-3 text-xs text-fyra-red-400 hover:bg-fyra-red-950" onclick={() => { startRebuild(selectedOfficialImage!.name, ver.version); imgSheetOpen = false; }}>
								<RotateCw class="h-3 w-3" /> Rebuild Server
							</Button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>

<!-- Upload Image Dialog (VM) -->
<Dialog.Root bind:open={imgUploadOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Upload Image</Dialog.Title>
			<Dialog.Description>Upload a .iso, .img, or .qcow2 file to use with your servers.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-4 py-4">
			<div class="flex flex-col gap-2">
				<Label>Image Name</Label>
				<Input bind:value={imgUploadName} placeholder="my-custom-image" />
			</div>
			<div class="flex flex-col gap-2">
				<Label>Source</Label>
				<div class="flex gap-2">
					<button class="flex-1 border px-3 py-2 text-center text-xs font-medium transition-colors {imgUploadMethod === 'file' ? 'border-fyra-red-500 bg-fyra-red-950/20 text-fyra-gray-100' : 'border-fyra-gray-700 text-fyra-gray-400 hover:border-fyra-gray-600'}" onclick={() => (imgUploadMethod = 'file')}>File Upload</button>
					<button class="flex-1 border px-3 py-2 text-center text-xs font-medium transition-colors {imgUploadMethod === 'url' ? 'border-fyra-red-500 bg-fyra-red-950/20 text-fyra-gray-100' : 'border-fyra-gray-700 text-fyra-gray-400 hover:border-fyra-gray-600'}" onclick={() => (imgUploadMethod = 'url')}>URL Import</button>
				</div>
			</div>
			{#if imgUploadMethod === 'file'}
				<label class="flex cursor-pointer flex-col items-center justify-center border border-dashed border-fyra-gray-600 bg-fyra-gray-800/30 px-4 py-6 text-center transition-colors hover:border-fyra-gray-500 hover:bg-fyra-gray-800/50">
					<Upload class="mb-2 h-6 w-6 text-fyra-gray-500" />
					{#if imgUploadFile}
						<span class="text-xs font-medium text-fyra-gray-200">{imgUploadFile}</span>
						{#if imgUploadDetectedType}<span class="mt-1 text-[10px] text-fyra-gray-500">Detected: .{imgUploadDetectedType}</span>{/if}
					{:else}
						<span class="text-xs text-fyra-gray-400">Drop or click to browse (.iso, .img, .qcow2)</span>
					{/if}
					<input type="file" accept=".iso,.img,.qcow2" class="hidden" onchange={handleImgFileSelect} />
				</label>
			{:else}
				<div class="flex flex-col gap-2">
					<Label>Image URL</Label>
					<Input bind:value={imgUploadUrl} placeholder="https://example.com/image.iso" oninput={handleImgUrlChange} />
					{#if imgUploadDetectedType}
						<p class="text-xs text-fyra-gray-500">Detected: .{imgUploadDetectedType}</p>
					{:else if imgUploadUrl}
						<p class="text-xs text-amber-500">Could not detect format. Will default to .img</p>
					{/if}
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (imgUploadOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={startImgUpload} disabled={!imgUploadName.trim() && !imgUploadFile && !imgUploadUrl}>
				<Upload class="h-3 w-3" /> Upload
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Create VM Dialog -->
<Dialog.Root bind:open={createVmOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Create Server</Dialog.Title>
			<Dialog.Description>Provision a new virtual machine.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-4 py-4">
			{#if createVmError}
				<div class="flex items-center gap-2 border border-fyra-red-700 bg-fyra-red-950 px-3 py-2 text-sm text-fyra-red-400">
					<AlertTriangle class="h-3.5 w-3.5 shrink-0" />
					{createVmError}
				</div>
			{/if}

			<div class="flex flex-col gap-2">
				<Label>Server Name</Label>
				<Input bind:value={createVmName} placeholder="my-server" />
			</div>

			<!-- Plan selection -->
			<div class="flex flex-col gap-2">
				<Label>Plan</Label>
				{#if vmTypes.length === 0}
					<p class="text-xs text-fyra-gray-500">No plans available. <a href="/admin" class="text-fyra-red-400 hover:text-fyra-red-300">Create one in Admin</a>.</p>
				{:else}
					<div class="grid grid-cols-2 gap-2">
						{#each vmTypes as vt (vt.id)}
							<button
								class="border px-3 py-2 text-left text-xs transition-colors {createVmType === vt.id ? 'border-fyra-red-500 bg-fyra-red-950/30 text-fyra-gray-100' : 'border-fyra-gray-800 text-fyra-gray-400 hover:border-fyra-gray-700'}"
								onclick={() => (createVmType = vt.id)}
							>
								<p class="font-semibold text-fyra-gray-100">{vt.name}</p>
								<p class="mt-0.5">{vt.cores} vCPU &bull; {vt.ramCapacity} MB &bull; {vt.storageAmount} GB</p>
								<p class="mt-0.5 text-fyra-gray-500">${vt.rate}/mo</p>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Image selection -->
			<div class="flex flex-col gap-2">
				<Label>Image</Label>
				{#if dbImages.length === 0}
					<p class="text-xs text-fyra-gray-500">No images configured. <a href="/admin" class="text-fyra-red-400 hover:text-fyra-red-300">Add one in Admin</a>.</p>
				{:else}
					<div class="grid grid-cols-3 gap-2">
						{#each dbImages as img (img.id)}
							<button
								class="flex items-center gap-2 border px-3 py-2 text-left text-xs transition-colors {createVmImage === img.filePath ? 'border-fyra-red-500 bg-fyra-red-950/30 text-fyra-gray-100' : 'border-fyra-gray-800 text-fyra-gray-400 hover:border-fyra-gray-700'}"
								onclick={() => (createVmImage = img.filePath)}
							>
								<span class="flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-bold text-white {img.color}">
									{#if img.icon}
										{@html img.icon}
									{:else}
										{img.shortName || img.name.slice(0, 2).toUpperCase()}
									{/if}
								</span>
								<div class="min-w-0">
									<p class="truncate font-medium text-fyra-gray-100">{img.name}</p>
									<p class="text-[10px] text-fyra-gray-500">{img.version}</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- SSH Keys -->
			{#if data.sshKeys?.length}
				<div class="flex flex-col gap-2">
					<Label>SSH Keys <span class="font-normal text-fyra-gray-500">(optional)</span></Label>
					<div class="flex flex-col gap-1.5">
						{#each data.sshKeys as key (key.id)}
							<label class="flex items-center gap-2 text-xs text-fyra-gray-300">
								<input
									type="checkbox"
									class="accent-fyra-red-500"
									checked={createVmSshKeys.includes(key.id)}
									onchange={() => {
										if (createVmSshKeys.includes(key.id)) {
											createVmSshKeys = createVmSshKeys.filter((k) => k !== key.id);
										} else {
											createVmSshKeys = [...createVmSshKeys, key.id];
										}
									}}
								/>
								{key.name}
								<span class="font-mono text-[10px] text-fyra-gray-600">{key.fingerprint.slice(0, 20)}...</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (createVmOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={doCreateVm} disabled={creatingVm || !createVmName.trim() || !createVmType}>
				{#if creatingVm}
					<Loader2 class="h-3 w-3 animate-spin" /> Creating...
				{:else}
					<Plus class="h-3 w-3" /> Create
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
