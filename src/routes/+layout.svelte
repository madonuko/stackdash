<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Command from '$lib/components/ui/command';
	import { goto } from '$app/navigation';
	import {
		Server,
		HardDrive,
		Shield,
		Warehouse,
		Disc,
		Search,
		ArrowRight,
		User,
		Key,
		KeyRound,
		CreditCard,
		LogOut,
		Check,
		Copy,
		Plus,
		Trash2,
		Eye,
		EyeOff,
		ChevronDown,
		FolderOpen
	} from '@lucide/svelte';

	let { children } = $props();

	// Projects
	type Project = { id: string; name: string };
	const projects: Project[] = [
		{ id: 'proj-prod', name: 'Production' },
		{ id: 'proj-staging', name: 'Staging' },
		{ id: 'proj-personal', name: 'Personal' }
	];
	let selectedProjectId = $state('proj-prod');
	let selectedProject = $derived(projects.find((p) => p.id === selectedProjectId) ?? projects[0]);

	let createProjectOpen = $state(false);
	let newProjectName = $state('');

	function createProject() {
		if (!newProjectName.trim()) return;
		projects.push({ id: `proj-${Date.now()}`, name: newProjectName.trim() });
		selectedProjectId = projects[projects.length - 1].id;
		newProjectName = '';
		createProjectOpen = false;
	}

	const navItems = [
		{ icon: Server, label: 'Servers', href: '/' },
		{ icon: Warehouse, label: 'Colocation', href: '/colocation' },
		{ icon: HardDrive, label: 'Volumes', href: '/volumes' },
		{ icon: Shield, label: 'Firewall', href: '/firewall' },
		{ icon: Disc, label: 'Images', href: '/images' }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	// User profile state
	let profileOpen = $state(false);
	let profileName = $state('Addison LeClair');
	let profileEmail = $state('addison@fyralabs.com');
	let profileSaved = $state(false);

	function saveProfile() {
		profileSaved = true;
		setTimeout(() => (profileSaved = false), 1500);
	}

	// Change password
	let passwordOpen = $state(false);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let passwordSaved = $state(false);

	function savePassword() {
		if (newPassword !== confirmPassword || !currentPassword) return;
		passwordSaved = true;
		setTimeout(() => {
			passwordSaved = false;
			passwordOpen = false;
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		}, 1200);
	}

	// SSH Keys
	let sshOpen = $state(false);
	let sshKeys = $state([
		{ id: 1, name: 'macbook-pro', fingerprint: 'SHA256:nThbg6kXUpJWGl7E1IGOCsp...' },
		{ id: 2, name: 'work-desktop', fingerprint: 'SHA256:2Fg3tH9kLMnO5pQrStU7vW...' }
	]);
	let newKeyName = $state('');
	let newKeyValue = $state('');
	let sshKeyCounter = $state(2);

	function addSshKey() {
		if (!newKeyName.trim() || !newKeyValue.trim()) return;
		sshKeyCounter++;
		sshKeys.push({
			id: sshKeyCounter,
			name: newKeyName.trim(),
			fingerprint: `SHA256:${Math.random().toString(36).slice(2, 26)}...`
		});
		newKeyName = '';
		newKeyValue = '';
	}

	function deleteSshKey(id: number) {
		sshKeys = sshKeys.filter((k) => k.id !== id);
	}

	// API Tokens
	let tokensOpen = $state(false);
	let tokens = $state([
		{ id: 1, name: 'ci-deploy', token: 'sk-stack-****************************a3f1', created: '2026-03-12' },
		{ id: 2, name: 'monitoring', token: 'sk-stack-****************************b7e2', created: '2026-02-05' }
	]);
	let newTokenName = $state('');
	let generatedToken = $state('');
	let tokenCounter = $state(2);
	let copied = $state('');

	function generateToken() {
		if (!newTokenName.trim()) return;
		tokenCounter++;
		const fullToken = `sk-stack-${Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`;
		generatedToken = fullToken;
		tokens.push({
			id: tokenCounter,
			name: newTokenName.trim(),
			token: `sk-stack-****************************${fullToken.slice(-4)}`,
			created: new Date().toISOString().slice(0, 10)
		});
		newTokenName = '';
	}

	function revokeToken(id: number) {
		tokens = tokens.filter((t) => t.id !== id);
	}

	function copyText(text: string, label: string) {
		navigator.clipboard.writeText(text);
		copied = label;
		setTimeout(() => (copied = ''), 1500);
	}

	// Billing
	let billingOpen = $state(false);

	// Command palette
	let commandOpen = $state(false);
	type CmdFilter = 'all' | 'servers' | 'colo' | 'navigate' | 'account';
	let cmdFilter = $state<CmdFilter>('all');

	const cmdFilters: { id: CmdFilter; label: string; icon: typeof Server }[] = [
		{ id: 'all', label: 'All', icon: Search },
		{ id: 'servers', label: 'Servers', icon: Server },
		{ id: 'colo', label: 'Colo', icon: Warehouse },
		{ id: 'navigate', label: 'Pages', icon: ArrowRight },
		{ id: 'account', label: 'Account', icon: User }
	];

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			cmdFilter = 'all';
			commandOpen = !commandOpen;
		}
		if (commandOpen && e.key === 'Tab') {
			e.preventDefault();
			const ids = cmdFilters.map((f) => f.id);
			const idx = ids.indexOf(cmdFilter);
			cmdFilter = ids[(idx + (e.shiftKey ? ids.length - 1 : 1)) % ids.length];
		}
	}

	function runCommand(fn: () => void) {
		commandOpen = false;
		fn();
	}

	// Searchable resources
	const cmdServers = [
		{ id: 'vps-747762', label: 'vps-747762', detail: '2 vCPU · 2GB · running' },
		{ id: 'vps-742736', label: 'vps-742736', detail: '4 vCPU · 8GB · running' },
		{ id: 'vps-711980', label: 'vps-711980', detail: '2 vCPU · 2GB · stopped' }
	];

	const cmdColo = [
		{ id: 'colo-001', label: 'db-primary', detail: '1U · Rack A12' },
		{ id: 'colo-002', label: 'storage-node', detail: '2U · Rack A12' },
		{ id: 'colo-003', label: 'gpu-worker', detail: '4U · Rack B03' }
	];

</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Stack / Dashboard</title>
</svelte:head>

<div class="flex h-screen flex-col overflow-hidden bg-fyra-gray-900">
	<!-- Top bar -->
	<header
		class="flex h-12 shrink-0 items-center justify-between border-b border-fyra-gray-800 px-4"
	>
		<div class="flex items-center gap-2">
			<a href="/" class="flex items-center gap-2">
				<svg
					class="h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<rect x="3" y="4" width="18" height="4" rx="0.5" fill="#c6716d" />
					<rect x="3" y="10" width="18" height="4" rx="0.5" fill="#c6716d" opacity="0.75" />
					<rect x="3" y="16" width="18" height="4" rx="0.5" fill="#c6716d" opacity="0.5" />
				</svg>
				<span class="text-sm font-semibold tracking-tight text-fyra-gray-50">Stack</span>
			</a>
			<span class="text-sm text-fyra-gray-600">/</span>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="flex items-center gap-1 px-1.5 py-0.5 text-sm font-medium text-fyra-gray-200 transition-colors hover:bg-fyra-gray-800 hover:text-fyra-gray-50">
					{selectedProject.name}
					<ChevronDown class="h-3 w-3 text-fyra-gray-500" />
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start" class="w-52 border-fyra-gray-800 bg-fyra-gray-900">
					<DropdownMenu.Label class="text-[10px] uppercase tracking-wider text-fyra-gray-500">Projects</DropdownMenu.Label>
					{#each projects as project (project.id)}
						<DropdownMenu.Item
							class="gap-2"
							onclick={() => (selectedProjectId = project.id)}
						>
							<FolderOpen class="h-3.5 w-3.5 {selectedProjectId === project.id ? 'text-fyra-red-500' : 'text-fyra-gray-500'}" />
							<span class={selectedProjectId === project.id ? 'text-fyra-gray-50' : ''}>{project.name}</span>
							{#if selectedProjectId === project.id}
								<Check class="ml-auto h-3 w-3 text-fyra-red-500" />
							{/if}
						</DropdownMenu.Item>
					{/each}
					<DropdownMenu.Separator class="bg-fyra-gray-800" />
					<DropdownMenu.Item class="gap-2" onclick={() => (createProjectOpen = true)}>
						<Plus class="h-3.5 w-3.5" />
						Create Project
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>

		<div class="flex flex-1 items-center justify-end gap-3">
			<!-- Search trigger -->
			<button
				class="flex items-center gap-2 border border-fyra-gray-800 bg-fyra-gray-800/30 px-3 py-1.5 text-xs text-fyra-gray-500 transition-colors hover:border-fyra-gray-700 hover:text-fyra-gray-400"
				onclick={() => (commandOpen = true)}
			>
				<Search class="h-3 w-3" />
				<span>Search...</span>
				<kbd class="ml-2 border border-fyra-gray-700 bg-fyra-gray-800 px-1.5 py-0.5 text-[10px] text-fyra-gray-500">⌘K</kbd>
			</button>

			<!-- Avatar dropdown -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="flex items-center gap-2.5 rounded-xs px-2 py-1 transition-colors hover:bg-fyra-gray-800">
				<div class="text-right">
					<p class="text-sm font-medium leading-tight text-fyra-gray-100">{profileName}</p>
					<p class="text-xs leading-tight text-fyra-gray-500">@addi</p>
				</div>
				<Avatar.Root class="h-8 w-8 rounded-xs border border-fyra-gray-700">
					<Avatar.Fallback class="rounded-xs bg-fyra-gray-800 text-xs text-fyra-gray-400">AL</Avatar.Fallback>
				</Avatar.Root>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-56 border-fyra-gray-800 bg-fyra-gray-900">
				<DropdownMenu.Label class="text-fyra-gray-400">
					<div>
						<p class="text-sm font-medium text-fyra-gray-100">{profileName}</p>
						<p class="text-xs text-fyra-gray-500">{profileEmail}</p>
					</div>
				</DropdownMenu.Label>
				<DropdownMenu.Separator class="bg-fyra-gray-800" />
				<DropdownMenu.Item class="gap-2" onclick={() => (profileOpen = true)}>
					<User class="h-3.5 w-3.5" />
					Profile
				</DropdownMenu.Item>
				<DropdownMenu.Item class="gap-2" onclick={() => (passwordOpen = true)}>
					<KeyRound class="h-3.5 w-3.5" />
					Change Password
				</DropdownMenu.Item>
				<DropdownMenu.Separator class="bg-fyra-gray-800" />
				<DropdownMenu.Item class="gap-2" onclick={() => (sshOpen = true)}>
					<Key class="h-3.5 w-3.5" />
					SSH Keys
				</DropdownMenu.Item>
				<DropdownMenu.Item class="gap-2" onclick={() => (tokensOpen = true)}>
					<KeyRound class="h-3.5 w-3.5" />
					API Tokens
				</DropdownMenu.Item>
				<DropdownMenu.Separator class="bg-fyra-gray-800" />
				<DropdownMenu.Item class="gap-2" onclick={() => (billingOpen = true)}>
					<CreditCard class="h-3.5 w-3.5" />
					Billing
				</DropdownMenu.Item>
				<DropdownMenu.Separator class="bg-fyra-gray-800" />
				<DropdownMenu.Item class="gap-2 text-fyra-red-400 focus:text-fyra-red-300">
					<LogOut class="h-3.5 w-3.5" />
					Sign Out
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
		</div>
	</header>

	<!-- Body -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Icon sidebar -->
		<aside
			class="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-fyra-gray-800 py-3"
		>
			{#each navItems as item (item.label)}
				<Tooltip.Root>
					<Tooltip.Trigger>
						<a
							href={item.href}
							class="flex h-8 w-8 items-center justify-center transition-colors duration-100 {isActive(
								item.href
							)
								? 'border border-fyra-red-500 text-fyra-gray-50'
								: 'text-fyra-gray-500 hover:bg-fyra-gray-800/50 hover:text-fyra-gray-200'}"
						>
							<item.icon class="h-4 w-4" />
						</a>
					</Tooltip.Trigger>
					<Tooltip.Content side="right">
						<p>{item.label}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			{/each}
		</aside>

		<!-- Page content -->
		<div class="flex flex-1 overflow-hidden">
			{@render children()}
		</div>
	</div>
</div>

<!-- Profile Dialog -->
<Dialog.Root bind:open={profileOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Profile</Dialog.Title>
			<Dialog.Description>Update your account details.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-4 py-4">
			<div class="flex flex-col gap-2">
				<Label>Full Name</Label>
				<Input bind:value={profileName} />
			</div>
			<div class="flex flex-col gap-2">
				<Label>Email Address</Label>
				<Input bind:value={profileEmail} type="email" />
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (profileOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={saveProfile}>
				{#if profileSaved}
					<Check class="h-3 w-3" /> Saved
				{:else}
					Save
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Change Password Dialog -->
<Dialog.Root bind:open={passwordOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Change Password</Dialog.Title>
			<Dialog.Description>Update your account password.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-4 py-4">
			<div class="flex flex-col gap-2">
				<Label>Current Password</Label>
				<div class="relative">
					<Input
						bind:value={currentPassword}
						type={showPassword ? 'text' : 'password'}
						placeholder="********"
					/>
					<button
						class="absolute right-2 top-1/2 -translate-y-1/2 text-fyra-gray-500 hover:text-fyra-gray-300"
						onclick={() => (showPassword = !showPassword)}
					>
						{#if showPassword}
							<EyeOff class="h-3.5 w-3.5" />
						{:else}
							<Eye class="h-3.5 w-3.5" />
						{/if}
					</button>
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<Label>New Password</Label>
				<Input bind:value={newPassword} type="password" placeholder="********" />
			</div>
			<div class="flex flex-col gap-2">
				<Label>Confirm New Password</Label>
				<Input bind:value={confirmPassword} type="password" placeholder="********" />
				{#if confirmPassword && newPassword !== confirmPassword}
					<p class="text-xs text-fyra-red-400">Passwords do not match.</p>
				{/if}
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (passwordOpen = false)}>Cancel</Button>
			<Button
				size="sm"
				onclick={savePassword}
				disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
			>
				{#if passwordSaved}
					<Check class="h-3 w-3" /> Updated
				{:else}
					Update Password
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- SSH Keys Dialog -->
<Dialog.Root bind:open={sshOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>SSH Keys</Dialog.Title>
			<Dialog.Description>Manage SSH keys for server access.</Dialog.Description>
		</Dialog.Header>
		<div class="py-4">
			<!-- Existing keys -->
			<div class="divide-y divide-fyra-gray-800/50">
				{#each sshKeys as key (key.id)}
					<div class="flex items-center justify-between py-2.5">
						<div>
							<p class="text-sm font-medium text-fyra-gray-100">{key.name}</p>
							<p class="mt-0.5 font-mono text-[11px] text-fyra-gray-500">{key.fingerprint}</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							class="h-7 w-7 p-0 text-fyra-red-400 hover:text-fyra-red-300"
							onclick={() => deleteSshKey(key.id)}
						>
							<Trash2 class="h-3 w-3" />
						</Button>
					</div>
				{/each}
			</div>

			{#if sshKeys.length === 0}
				<p class="py-4 text-center text-xs text-fyra-gray-500">No SSH keys added.</p>
			{/if}

			<!-- Add key form -->
			<div class="mt-4 flex flex-col gap-3 border-t border-fyra-gray-800 pt-4">
				<div class="flex gap-3">
					<Input bind:value={newKeyName} placeholder="Key name" class="h-8 text-xs" />
				</div>
				<textarea
					bind:value={newKeyValue}
					placeholder="ssh-ed25519 AAAA..."
					rows="3"
					class="w-full resize-none border border-fyra-gray-700 bg-fyra-gray-800 px-3 py-2 font-mono text-xs text-fyra-gray-100 placeholder:text-fyra-gray-600 focus:border-fyra-gray-500 focus:outline-none"
				></textarea>
				<Button
					variant="outline"
					size="sm"
					class="w-fit gap-1.5 text-xs"
					onclick={addSshKey}
					disabled={!newKeyName.trim() || !newKeyValue.trim()}
				>
					<Plus class="h-3 w-3" />
					Add Key
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- API Tokens Dialog -->
<Dialog.Root bind:open={tokensOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>API Tokens</Dialog.Title>
			<Dialog.Description>Manage API tokens for programmatic access.</Dialog.Description>
		</Dialog.Header>
		<div class="py-4">
			<!-- Generated token alert -->
			{#if generatedToken}
				<div class="mb-4 border border-amber-800/50 bg-amber-950/20 p-3">
					<p class="text-xs font-medium text-amber-400">
						Copy this token now — it won't be shown again.
					</p>
					<div class="mt-2 flex items-center gap-2">
						<code class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-fyra-gray-800 px-2 py-1 font-mono text-xs text-fyra-gray-100">
							{generatedToken}
						</code>
						<button
							class="shrink-0 text-fyra-gray-500 hover:text-fyra-gray-300"
							onclick={() => copyText(generatedToken, 'token')}
						>
							{#if copied === 'token'}
								<Check class="h-3.5 w-3.5 text-emerald-500" />
							{:else}
								<Copy class="h-3.5 w-3.5" />
							{/if}
						</button>
					</div>
				</div>
			{/if}

			<!-- Existing tokens -->
			<div class="divide-y divide-fyra-gray-800/50">
				{#each tokens as token (token.id)}
					<div class="flex items-center justify-between py-2.5">
						<div>
							<p class="text-sm font-medium text-fyra-gray-100">{token.name}</p>
							<p class="mt-0.5 font-mono text-[11px] text-fyra-gray-500">
								{token.token}
								<span class="ml-2 font-sans text-fyra-gray-600">Created {token.created}</span>
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							class="h-7 px-2 text-xs text-fyra-red-400 hover:text-fyra-red-300"
							onclick={() => revokeToken(token.id)}
						>
							Revoke
						</Button>
					</div>
				{/each}
			</div>

			{#if tokens.length === 0}
				<p class="py-4 text-center text-xs text-fyra-gray-500">No API tokens.</p>
			{/if}

			<!-- Generate token -->
			<div class="mt-4 flex items-center gap-3 border-t border-fyra-gray-800 pt-4">
				<Input bind:value={newTokenName} placeholder="Token name" class="h-8 text-xs" />
				<Button
					variant="outline"
					size="sm"
					class="shrink-0 gap-1.5 text-xs"
					onclick={generateToken}
					disabled={!newTokenName.trim()}
				>
					<Plus class="h-3 w-3" />
					Generate
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Billing Dialog -->
<Dialog.Root bind:open={billingOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Billing</Dialog.Title>
			<Dialog.Description>Your current billing summary.</Dialog.Description>
		</Dialog.Header>
		<div class="py-4">
			<div class="divide-y divide-fyra-gray-800/50">
				<div class="flex items-center justify-between py-2.5">
					<span class="text-sm text-fyra-gray-400">Current Balance</span>
					<span class="text-sm font-semibold text-fyra-gray-100">$0.00</span>
				</div>
				<div class="flex items-center justify-between py-2.5">
					<span class="text-sm text-fyra-gray-400">Monthly Estimate</span>
					<span class="text-sm font-medium text-fyra-gray-200">$26.00</span>
				</div>
				<div class="flex items-center justify-between py-2.5">
					<span class="text-sm text-fyra-gray-400">Payment Method</span>
					<span class="text-sm text-fyra-gray-200">Visa ending 4242</span>
				</div>
				<div class="flex items-center justify-between py-2.5">
					<span class="text-sm text-fyra-gray-400">Next Invoice</span>
					<span class="text-sm text-fyra-gray-200">May 1, 2026</span>
				</div>
			</div>

			<div class="mt-4 border-t border-fyra-gray-800 pt-4">
				<p class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500">
					Active Resources
				</p>
				<div class="mt-2 divide-y divide-fyra-gray-800/30">
					<div class="flex items-center justify-between py-2">
						<span class="text-xs text-fyra-gray-300">vps-747762 (STACK-XXS)</span>
						<span class="text-xs text-fyra-gray-400">$5.00/mo</span>
					</div>
					<div class="flex items-center justify-between py-2">
						<span class="text-xs text-fyra-gray-300">vps-742736 (STACK-SM)</span>
						<span class="text-xs text-fyra-gray-400">$20.00/mo</span>
					</div>
					<div class="flex items-center justify-between py-2">
						<span class="text-xs text-fyra-gray-300">Backups (2 servers)</span>
						<span class="text-xs text-fyra-gray-400">$1.00/mo</span>
					</div>
				</div>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (billingOpen = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Create Project Dialog -->
<Dialog.Root bind:open={createProjectOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create Project</Dialog.Title>
			<Dialog.Description>Projects group your servers, volumes, and other resources.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-2 py-4">
			<Label>Project Name</Label>
			<Input bind:value={newProjectName} placeholder="my-project" />
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (createProjectOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={createProject} disabled={!newProjectName.trim()}>Create</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Command Palette -->
<Command.Dialog bind:open={commandOpen} class="top-1/2! max-w-xl! -translate-y-1/2! border-fyra-gray-800 bg-fyra-gray-900">
	<Command.Input placeholder="Search resources, actions..." class="border-b border-fyra-gray-800" />
	<!-- Filter buttons -->
	<div class="flex gap-1 border-b border-fyra-gray-800 px-3 py-2">
		{#each cmdFilters as f (f.id)}
			<button
				class="flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors {cmdFilter === f.id ? 'bg-fyra-gray-800 text-fyra-gray-100' : 'text-fyra-gray-500 hover:text-fyra-gray-300'}"
				onclick={() => (cmdFilter = f.id)}
			>
				<f.icon class="h-3 w-3" />
				{f.label}
			</button>
		{/each}
	</div>
	<Command.List class="max-h-[350px] bg-fyra-gray-900">
		<Command.Empty>No results found.</Command.Empty>

		{#if cmdFilter === 'all' || cmdFilter === 'servers'}
			<Command.Group heading="Servers">
				{#each cmdServers as srv (srv.id)}
					<Command.Item onSelect={() => runCommand(() => goto(`/?server=${srv.id}`))} class="gap-2">
						<Server class="h-3.5 w-3.5 shrink-0 text-fyra-gray-500" />
						<div class="flex flex-1 items-center justify-between"><span>{srv.label}</span><span class="text-[10px] text-fyra-gray-500">{srv.detail}</span></div>
					</Command.Item>
				{/each}
			</Command.Group>
			<Command.Separator class="bg-fyra-gray-800" />
		{/if}

		{#if cmdFilter === 'all' || cmdFilter === 'colo'}
			<Command.Group heading="Colocation">
				{#each cmdColo as unit (unit.id)}
					<Command.Item onSelect={() => runCommand(() => goto(`/colocation?unit=${unit.id}`))} class="gap-2">
						<Warehouse class="h-3.5 w-3.5 shrink-0 text-fyra-gray-500" />
						<div class="flex flex-1 items-center justify-between"><span>{unit.label}</span><span class="text-[10px] text-fyra-gray-500">{unit.detail}</span></div>
					</Command.Item>
				{/each}
			</Command.Group>
			<Command.Separator class="bg-fyra-gray-800" />
		{/if}

		{#if cmdFilter === 'all' || cmdFilter === 'navigate'}
			<Command.Group heading="Navigate">
				<Command.Item onSelect={() => runCommand(() => goto('/'))} class="gap-2">
					<Server class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>Servers</span>
					<Command.Shortcut><ArrowRight class="h-3 w-3" /></Command.Shortcut>
				</Command.Item>
				<Command.Item onSelect={() => runCommand(() => goto('/colocation'))} class="gap-2">
					<Warehouse class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>Colocation</span>
					<Command.Shortcut><ArrowRight class="h-3 w-3" /></Command.Shortcut>
				</Command.Item>
				<Command.Item onSelect={() => runCommand(() => goto('/volumes'))} class="gap-2">
					<HardDrive class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>Volumes</span>
					<Command.Shortcut><ArrowRight class="h-3 w-3" /></Command.Shortcut>
				</Command.Item>
				<Command.Item onSelect={() => runCommand(() => goto('/firewall'))} class="gap-2">
					<Shield class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>Firewall</span>
					<Command.Shortcut><ArrowRight class="h-3 w-3" /></Command.Shortcut>
				</Command.Item>
				<Command.Item onSelect={() => runCommand(() => goto('/images'))} class="gap-2">
					<Disc class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>Images</span>
					<Command.Shortcut><ArrowRight class="h-3 w-3" /></Command.Shortcut>
				</Command.Item>
			</Command.Group>
			<Command.Separator class="bg-fyra-gray-800" />
		{/if}

		{#if cmdFilter === 'all' || cmdFilter === 'account'}
			<Command.Group heading="Account">
				<Command.Item onSelect={() => runCommand(() => (profileOpen = true))} class="gap-2">
					<User class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>Profile</span>
				</Command.Item>
				<Command.Item onSelect={() => runCommand(() => (sshOpen = true))} class="gap-2">
					<Key class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>SSH Keys</span>
				</Command.Item>
				<Command.Item onSelect={() => runCommand(() => (tokensOpen = true))} class="gap-2">
					<KeyRound class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>API Tokens</span>
				</Command.Item>
				<Command.Item onSelect={() => runCommand(() => (billingOpen = true))} class="gap-2">
					<CreditCard class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>Billing</span>
				</Command.Item>
				<Command.Item onSelect={() => runCommand(() => (passwordOpen = true))} class="gap-2">
					<KeyRound class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>Change Password</span>
				</Command.Item>
			</Command.Group>
			<Command.Separator class="bg-fyra-gray-800" />
		{/if}

		{#if cmdFilter === 'all'}
			<Command.Group heading="Quick Actions">
				<Command.Item onSelect={() => runCommand(() => (createProjectOpen = true))} class="gap-2">
					<Plus class="h-3.5 w-3.5 text-fyra-gray-500" />
					<span>Create Project</span>
				</Command.Item>
			</Command.Group>
		{/if}
	</Command.List>
</Command.Dialog>
