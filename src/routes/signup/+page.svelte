<script lang="ts">
	import '../layout.css';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { authClient } from '$lib/auth-client';
	import { UserPlus, Eye, EyeOff, AlertCircle, Loader2 } from '@lucide/svelte';
	import { LogoGithub } from 'carbon-icons-svelte';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirm = $state('');
	let showPassword = $state(false);
	let error = $state('');
	let loading = $state(false);

	async function handleSignup() {
		if (!name || !email || !password) return;
		if (password !== confirm) {
			error = 'Passwords do not match';
			return;
		}
		error = '';
		loading = true;

		const res = await authClient.signUp.email({ name, email, password });

		if (res.error) {
			error = res.error.message ?? 'Signup failed';
			loading = false;
			return;
		}

		goto('/');
	}

	async function handleGithub() {
		await authClient.signIn.social({ provider: 'github', callbackURL: '/' });
	}

	async function handleGoogle() {
		await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-950 px-4">
	<div class="w-full max-w-xs">
		<div class="mb-10 flex items-center justify-center gap-2">
			<img src="/logo.svg" alt="Stack" class="h-5 w-5" />
			<span class="text-base font-semibold tracking-tight text-gray-50">Stack</span>
		</div>

		<div class="space-y-4">
			<h1 class="text-center text-lg font-medium text-gray-50">Create account</h1>

			{#if error}
				<div
					class="flex items-center gap-2 border border-red-700 bg-red-950 px-3 py-2 text-sm text-red-400"
				>
					<AlertCircle class="h-3.5 w-3.5 shrink-0" />
					{error}
				</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSignup();
				}}
				class="space-y-3"
			>
				<Input type="text" bind:value={name} placeholder="Full name" required />
				<Input type="email" bind:value={email} placeholder="Email" required />

				<div class="relative">
					<Input
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						placeholder="Password"
						required
					/>
					<button
						type="button"
						class="absolute top-1/2 right-2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
						onclick={() => (showPassword = !showPassword)}
					>
						{#if showPassword}<EyeOff class="h-3.5 w-3.5" />{:else}<Eye class="h-3.5 w-3.5" />{/if}
					</button>
				</div>

				<Input type="password" bind:value={confirm} placeholder="Confirm password" required />
				{#if confirm && password !== confirm}
					<p class="text-xs text-red-400">Passwords do not match.</p>
				{/if}

				<Button
					type="submit"
					class="w-full"
					disabled={loading || (!!confirm && password !== confirm)}
				>
					{#if loading}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
					{:else}
						Create account
					{/if}
				</Button>
			</form>

			<div class="flex items-center gap-2">
				<div class="h-px flex-1 bg-gray-800"></div>
				<span class="text-[10px] text-gray-600">or</span>
				<div class="h-px flex-1 bg-gray-800"></div>
			</div>

			<div class="flex gap-2">
				<Button variant="outline" size="sm" class="flex-1 gap-1.5" onclick={handleGithub}>
					<LogoGithub class="h-3.5 w-3.5" />
					GitHub
				</Button>
				<Button variant="outline" size="sm" class="flex-1 gap-1.5" onclick={handleGoogle}>
					<LogoGithub class="h-3.5 w-3.5" />
					Google
				</Button>
			</div>

			<p class="text-center text-xs text-gray-500">
				Already have an account? <a href="/login" class="text-red-400 hover:text-red-300">Sign in</a
				>
			</p>
		</div>
	</div>
</div>
