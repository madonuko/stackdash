<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Disc, Upload, Trash2, Search, DollarSign, ChevronLeft, ChevronRight } from '@lucide/svelte';

	type ImageType = 'iso' | 'img' | 'qcow2';

	type ImageVersion = {
		version: string;
		archs: string[];
		size: string;
		type: ImageType;
	};

	type OfficialImage = {
		id: string;
		name: string;
		shortName: string;
		description: string;
		color: string;
		iconColor: string;
		icon?: string;
		paid: boolean;
		price?: string;
		versions: ImageVersion[];
	};

	const officialImages: OfficialImage[] = [
		{
			id: 'ultramarine', name: 'Ultramarine Linux', shortName: 'UL', color: 'bg-blue-500', iconColor: '#3b82f6',
			description: 'First-class Stack integration. Optimized kernel, automatic updates, and built-in monitoring agent.',
			paid: false,
			versions: [
				{ version: '40', archs: ['x86_64', 'aarch64'], size: '2.1 GB', type: 'iso' },
				{ version: '39', archs: ['x86_64', 'aarch64'], size: '2.0 GB', type: 'iso' }
			]
		},
		{
			id: 'fedora', name: 'Fedora Server', shortName: 'Fe', color: 'bg-sky-600', iconColor: '#51A2DA',
			icon: 'M12.001 0C5.376 0 .008 5.369.004 11.992H.002v9.287h.002A2.726 2.726 0 0 0 2.73 24h9.275c6.626-.004 11.993-5.372 11.993-11.997C23.998 5.375 18.628 0 12 0zm2.431 4.94c2.015 0 3.917 1.543 3.917 3.671 0 .197.001.395-.03.619a1.002 1.002 0 0 1-1.137.893 1.002 1.002 0 0 1-.842-1.175 2.61 2.61 0 0 0 .013-.337c0-1.207-.987-1.672-1.92-1.672-.934 0-1.775.784-1.777 1.672.016 1.027 0 2.046 0 3.07l1.732-.012c1.352-.028 1.368 2.009.016 1.998l-1.748.013c-.004.826.006.677.002 1.093 0 0 .015 1.01-.016 1.776-.209 2.25-2.124 4.046-4.424 4.046-2.438 0-4.448-1.993-4.448-4.437.073-2.515 2.078-4.492 4.603-4.469l1.409-.01v1.996l-1.409.013h-.007c-1.388.04-2.577.984-2.6 2.47a2.438 2.438 0 0 0 2.452 2.439c1.356 0 2.441-.987 2.441-2.437l-.001-7.557c0-.14.005-.252.02-.407.23-1.848 1.883-3.256 3.754-3.256z',
			description: 'Cutting-edge packages with SELinux, Cockpit web console, and modular repositories.',
			paid: false,
			versions: [
				{ version: '42', archs: ['x86_64', 'aarch64'], size: '2.4 GB', type: 'iso' },
				{ version: '41', archs: ['x86_64', 'aarch64'], size: '2.3 GB', type: 'iso' },
				{ version: '40', archs: ['x86_64', 'aarch64'], size: '2.2 GB', type: 'iso' }
			]
		},
		{
			id: 'debian', name: 'Debian', shortName: 'De', color: 'bg-red-700', iconColor: '#A81D33',
			icon: 'M13.88 12.685c-.4 0 .08.2.601.28.14-.1.27-.22.39-.33a3.001 3.001 0 01-.99.05m2.14-.53c.23-.33.4-.69.47-1.06-.06.27-.2.5-.33.73-.75.47-.07-.27 0-.56-.8 1.01-.11.6-.14.89m.781-2.05c.05-.721-.14-.501-.2-.221.07.04.13.5.2.22M12.38.31c.2.04.45.07.42.12.23-.05.28-.1-.43-.12m.43.12l-.15.03.14-.01V.43m6.633 9.944c.02.64-.2.95-.38 1.5l-.35.181c-.28.54.03.35-.17.78-.44.39-1.34 1.22-1.62 1.301-.201 0 .14-.25.19-.34-.591.4-.481.6-1.371.85l-.03-.06c-2.221 1.04-5.303-1.02-5.253-3.842-.03.17-.07.13-.12.2a3.551 3.552 0 012.001-3.501 3.361 3.362 0 013.732.48 3.341 3.342 0 00-2.721-1.3c-1.18.01-2.281.76-2.651 1.57-.6.38-.67 1.47-.93 1.661-.361 2.601.66 3.722 2.38 5.042.27.19.08.21.12.35a4.702 4.702 0 01-1.53-1.16c.23.33.47.66.8.91-.55-.18-1.27-1.3-1.48-1.35.93 1.66 3.78 2.921 5.261 2.3a6.203 6.203 0 01-2.33-.28c-.33-.16-.77-.51-.7-.57a5.802 5.803 0 005.902-.84c.44-.35.93-.94 1.07-.95-.2.32.04.16-.12.44.44-.72-.2-.3.46-1.24l.24.33c-.09-.6.74-1.321.66-2.262.19-.3.2.3 0 .97.29-.74.08-.85.15-1.46.08.2.18.42.23.63-.18-.7.2-1.2.28-1.6-.09-.05-.28.3-.32-.53 0-.37.1-.2.14-.28-.08-.05-.26-.32-.38-.861.08-.13.22.33.34.34-.08-.42-.2-.75-.2-1.08-.34-.68-.12.1-.4-.3-.34-1.091.3-.25.34-.74.54.77.84 1.96.981 2.46-.1-.6-.28-1.2-.49-1.76.16.07-.26-1.241.21-.37A7.823 7.824 0 0017.702 1.6c.18.17.42.39.33.42-.75-.45-.62-.48-.73-.67-.61-.25-.65.02-1.06 0C15.082.73 14.862.8 13.8.4l.05.23c-.77-.25-.9.1-1.73 0-.05-.04.27-.14.53-.18-.741.1-.701-.14-1.431.03.17-.13.36-.21.55-.32-.6.04-1.44.35-1.18.07C9.6.68 7.847 1.3 6.867 2.22L6.838 2c-.45.54-1.96 1.611-2.08 2.311l-.131.03c-.23.4-.38.85-.57 1.261-.3.52-.45.2-.4.28-.6 1.22-.9 2.251-1.16 3.102.18.27 0 1.65.07 2.76-.3 5.463 3.84 10.776 8.363 12.006.67.23 1.65.23 2.49.25-.99-.28-1.12-.15-2.08-.49-.7-.32-.85-.7-1.34-1.13l.2.35c-.971-.34-.57-.42-1.361-.67l.21-.27c-.31-.03-.83-.53-.97-.81l-.34.01c-.41-.501-.63-.871-.61-1.161l-.111.2c-.13-.21-1.52-1.901-.8-1.511-.13-.12-.31-.2-.5-.55l.14-.17c-.35-.44-.64-1.02-.62-1.2.2.24.32.3.45.33-.88-2.172-.93-.12-1.601-2.202l.15-.02c-.1-.16-.18-.34-.26-.51l.06-.6c-.63-.74-.18-3.102-.09-4.402.07-.54.53-1.1.88-1.981l-.21-.04c.4-.71 2.341-2.872 3.241-2.761.43-.55-.09 0-.18-.14.96-.991 1.26-.7 1.901-.88.7-.401-.6.16-.27-.151 1.2-.3.85-.7 2.421-.85.16.1-.39.14-.52.26 1-.49 3.151-.37 4.562.27 1.63.77 3.461 3.011 3.531 5.132l.08.02c-.04.85.13 1.821-.17 2.711l.2-.42M9.54 13.236l-.05.28c.26.35.47.73.8 1.01-.24-.47-.42-.66-.75-1.3m.62-.02c-.14-.15-.22-.34-.31-.52.08.32.26.6.43.88l-.12-.36m10.945-2.382l-.07.15c-.1.76-.34 1.511-.69 2.212.4-.73.65-1.541.75-2.362M12.45.12c.27-.1.66-.05.95-.12-.37.03-.74.05-1.1.1l.15.02M3.006 5.142c.07.57-.43.8.11.42.3-.66-.11-.18-.1-.42m-.64 2.661c.12-.39.15-.62.2-.84-.35.44-.17.53-.2.83',
			description: 'Rock-solid stability. Minimal footprint, long-term security updates, vast package archive.',
			paid: false,
			versions: [
				{ version: '12 (Bookworm)', archs: ['amd64', 'arm64'], size: '628 MB', type: 'iso' },
				{ version: '11 (Bullseye)', archs: ['amd64', 'arm64'], size: '694 MB', type: 'iso' }
			]
		},
		{
			id: 'ubuntu', name: 'Ubuntu Server', shortName: 'Ub', color: 'bg-orange-600', iconColor: '#E95420',
			icon: 'M17.61.455a3.41 3.41 0 0 0-3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41zM12.92.8C8.923.777 5.137 2.941 3.148 6.451a4.5 4.5 0 0 1 .26-.007 4.92 4.92 0 0 1 2.585.737A8.316 8.316 0 0 1 12.688 3.6 4.944 4.944 0 0 1 13.723.834 11.008 11.008 0 0 0 12.92.8zm9.226 4.994a4.915 4.915 0 0 1-1.918 2.246 8.36 8.36 0 0 1-.273 8.303 4.89 4.89 0 0 1 1.632 2.54 11.156 11.156 0 0 0 .559-13.089zM3.41 7.932A3.41 3.41 0 0 0 0 11.342a3.41 3.41 0 0 0 3.41 3.409 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41zm2.027 7.866a4.908 4.908 0 0 1-2.915.358 11.1 11.1 0 0 0 7.991 6.698 11.234 11.234 0 0 0 2.422.249 4.879 4.879 0 0 1-.999-2.85 8.484 8.484 0 0 1-.836-.136 8.304 8.304 0 0 1-5.663-4.32zm11.405.928a3.41 3.41 0 0 0-3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41z',
			description: 'Industry-standard LTS. Snap packages, Livepatch kernel updates, 10-year support.',
			paid: false,
			versions: [
				{ version: '24.04 LTS', archs: ['amd64', 'arm64'], size: '1.8 GB', type: 'iso' },
				{ version: '22.04 LTS', archs: ['amd64', 'arm64'], size: '1.6 GB', type: 'iso' },
				{ version: '24.10', archs: ['amd64', 'arm64'], size: '1.9 GB', type: 'iso' }
			]
		},
		{
			id: 'centos', name: 'CentOS Stream', shortName: 'CS', color: 'bg-yellow-600', iconColor: '#262577',
			icon: 'M12.076.066L8.883 3.28H3.348v5.434L0 12.01l3.349 3.298v5.39h5.374l3.285 3.236 3.285-3.236h5.43v-5.374L24 12.026l-3.232-3.252V3.321H15.31zm0 .749l2.49 2.506h-1.69v6.441l-.8.805-.81-.815V3.28H9.627zm-8.2 2.991h4.483L6.485 5.692l4.253 4.279v.654H9.94L5.674 6.423l-1.798 1.77zm5.227 0h1.635v5.415l-3.509-3.53zm4.302.043h1.687l1.83 1.842-3.517 3.539zm2.431 0h4.404v4.394l-1.83-1.842-4.241 4.267h-.764v-.69l4.261-4.287zm2.574 3.3l1.83 1.843v1.676h-5.327zm-12.735.013l3.515 3.462H3.876v-1.69zM3.348 9.454v1.697h6.377l.871.858-.782.77H3.35v1.786L.753 12.01zm17.42.068l2.488 2.503-2.533 2.55v-1.796h-6.41l-.75-.754.825-.83h6.38zm-9.502.978l.81.815.186-.188.614-.618v.686h.768l-.825.83.75.754h-.719v.808l-.842-.83-.741.73v-.707h-.7l.781-.77-.188-.186-.682-.672h.788zm-7.39 2.807h5.402l-3.603 3.55-1.798-1.772zm6.154 0h.708v.7l-4.404 4.338 1.852 1.824h-4.31v-4.342l1.798 1.77zm3.348 0h.715l4.317 4.343.186-.187 1.599-1.61v4.316h-4.366l1.853-1.825-.188-.185-4.116-4.054zm1.46 0h5.357v1.798l-1.785 1.796zm-2.83.191l.842.829v6.37h1.691l-2.532 2.495-2.533-2.495h1.79V14.23zm-1.27 1.251v5.42H8.939l-1.852-1.823zm2.64.097l3.552 3.499-1.853 1.825h-1.7z',
			description: 'Continuously delivered distro tracking just ahead of RHEL. Rolling preview of the next RHEL minor release.',
			paid: false,
			versions: [
				{ version: '10', archs: ['x86_64', 'aarch64'], size: '1.9 GB', type: 'iso' },
				{ version: '9', archs: ['x86_64', 'aarch64'], size: '1.8 GB', type: 'iso' }
			]
		},
		{
			id: 'alma', name: 'AlmaLinux', shortName: 'AL', color: 'bg-indigo-600', iconColor: '#0F4266',
			icon: 'M23.994 15.133c.079 1.061-.668 1.927-1.69 2.005a1.8 1.8 0 0 1-1.928-1.651c-.078-1.062.63-1.849 1.691-1.967 1.023-.078 1.849.59 1.927 1.613zm-12.623 4.955c-.944 0-1.73.786-1.73 1.809 0 1.14.747 1.848 1.887 1.848.904-.04 1.691-.865 1.691-1.809 0-.983-.904-1.848-1.848-1.848zm1.061-9.675c-.039-.865-.078-1.73.08-2.556.156-.944.314-1.887.904-2.674.707-.983 1.809-.944 2.399.118.314.511.432 1.062.471 1.652 0 .354.158.432.472.393.944-.157 1.888-.157 2.792.197.118.039.236.118.394 0 .314-.276.393-1.652.196-2.006-.354-.63-.904-.55-1.455-.55-.629.039-1.18-.158-1.612-.67-.393-.471-.511-1.06-.59-1.65-.04-.276-.079-.512-.315-.709-.55-.55-1.809-.432-2.477.118-2.556 2.045-2.989 5.467-1.534 8.18.04.118.118.236.275.157zm7.984 3.658c.354-.511.865-.747 1.415-.983a.973.973 0 0 0 .59-.472c.354-.669-.078-1.81-.747-2.36-2.595-2.006-5.938-1.612-8.18.433-.118.078-.157.196-.078.314.786-.236 1.612-.472 2.477-.51.905-.08 1.848-.158 2.753.235 1.14.472 1.337 1.534.472 2.36-.393.393-.905.668-1.455.825-.315.08-.354.236-.236.551.354.865.59 1.77.472 2.753-.04.157-.079.275.078.393.354.236 1.691 0 1.967-.275.511-.472.314-1.023.196-1.534-.157-.63-.078-1.219.276-1.73zm-7.197-2.045c-.118-.079-.197-.118-.315 0 .472.708.905 1.455 1.259 2.241.314.866.668 1.73.55 2.714-.118 1.18-1.1 1.69-2.123 1.101-.511-.275-.905-.669-1.22-1.14-.196-.276-.393-.276-.629-.08-.747.63-1.533 1.102-2.516 1.26-.158 0-.315 0-.394.157-.118.393.472 1.612.826 1.809.59.354 1.062 0 1.534-.276.55-.314 1.101-.432 1.73-.236.59.197.983.63 1.337 1.102.158.196.315.353.63.432.747.197 1.77-.59 2.084-1.376 1.18-3.028-.157-6.135-2.753-7.708zm-2.556 2.438c.472-.669.826-1.416.983-2.202-.157-.04-.197.04-.315.078-.904.944-1.848 1.849-3.067 2.478-.472.236-.983.433-1.534.433-.865 0-1.376-.551-1.298-1.416a2.92 2.92 0 0 1 .787-1.849c.236-.275.236-.432-.04-.668-.786-.55-1.494-1.22-1.848-2.124-.078-.275-.275-.275-.51-.157a4.293 4.293 0 0 0-.434.236c-1.022.63-1.14 1.416-.275 2.28.63.63.944 1.338.708 2.203-.118.433-.354.747-.63 1.101a.95.95 0 0 0-.235.787c.079.747.826 1.494 1.73 1.573 2.517.236 4.562-.63 5.978-2.753zm-4.68-5.152c1.376 1.18 3.067 1.455 4.837 1.377.157 0 .315 0 .354-.118.04-.197-.157-.197-.275-.236-.826-.354-1.691-.63-2.438-1.14S6.848 8.25 6.534 7.266c-.236-.747.078-1.415.825-1.651.669-.236 1.337-.236 1.967 0 .393.157.55.078.629-.354.118-.747.354-1.455.826-2.085.55-.786.55-.865-.354-1.376-.04 0-.04-.04-.079-.04-.865-.471-1.534-.196-1.848.709-.472 1.376-1.377 1.887-2.832 1.612-.196-.04-.393-.079-.472-.079-.747.118-1.18.55-1.297 1.14-.158 1.81.786 3.107 2.084 4.17zm-2.32 3.658c-.079-.944-1.023-1.652-2.045-1.534-.905.079-1.691 1.022-1.613 1.966.08.983 1.023 1.77 1.967 1.652 1.14-.079 1.73-1.18 1.69-2.084zm15.18-8.298c.943-.079 1.73-.983 1.651-1.927-.078-.983-1.022-1.77-2.005-1.691-1.023.079-1.73.983-1.652 1.966s.983 1.73 2.006 1.652zm-12.27-.826c1.062-.157 1.77-1.023 1.652-2.045C8.107.897 7.163.149 6.18.267c-1.062.118-1.691.944-1.573 2.085.118.865 1.061 1.612 1.966 1.494z',
			description: 'Community-driven RHEL fork. Binary-compatible, free, and backed by the AlmaLinux OS Foundation.',
			paid: false,
			versions: [
				{ version: '9.4', archs: ['x86_64', 'aarch64'], size: '1.9 GB', type: 'iso' },
				{ version: '8.10', archs: ['x86_64', 'aarch64'], size: '1.8 GB', type: 'iso' }
			]
		},
		{
			id: 'alpine', name: 'Alpine Linux', shortName: 'Al', color: 'bg-cyan-700', iconColor: '#0D597F',
			icon: 'M5.998 1.607L0 12l5.998 10.393h12.004L24 12 18.002 1.607H5.998zM9.965 7.12L12.66 9.9l1.598 1.595.002-.002 2.41 2.363c-.2.14-.386.252-.563.344a3.756 3.756 0 01-.496.217 2.702 2.702 0 01-.425.111c-.131.023-.25.034-.358.034-.13 0-.242-.014-.338-.034a1.317 1.317 0 01-.24-.072.95.95 0 01-.2-.113l-1.062-1.092-3.039-3.041-1.1 1.053-3.07 3.072a.974.974 0 01-.2.111 1.274 1.274 0 01-.237.073c-.096.02-.209.033-.338.033-.108 0-.227-.009-.358-.031a2.7 2.7 0 01-.425-.114 3.748 3.748 0 01-.496-.217 5.228 5.228 0 01-.563-.343l6.803-6.727zm4.72.785l4.579 4.598 1.382 1.353a5.24 5.24 0 01-.564.344 3.73 3.73 0 01-.494.217 2.697 2.697 0 01-.426.111c-.13.023-.251.034-.36.034-.129 0-.241-.014-.337-.034a1.285 1.285 0 01-.385-.146c-.033-.02-.05-.036-.053-.04l-1.232-1.218-2.111-2.111-.334.334L12.79 9.8l1.896-1.897zm-5.966 4.12v2.529a2.128 2.128 0 01-.356-.035 2.765 2.765 0 01-.422-.116 3.708 3.708 0 01-.488-.214 5.217 5.217 0 01-.555-.34l1.82-1.825Z',
			description: 'Ultralight musl-based distribution. Perfect for containers and minimal installs.',
			paid: false,
			versions: [
				{ version: '3.20', archs: ['x86_64', 'aarch64'], size: '210 MB', type: 'iso' },
				{ version: '3.19', archs: ['x86_64', 'aarch64'], size: '195 MB', type: 'iso' }
			]
		},
		{
			id: 'rhel', name: 'Red Hat Enterprise Linux', shortName: 'RH', color: 'bg-red-600', iconColor: '#EE0000',
			icon: 'M16.009 13.386c1.577 0 3.86-.326 3.86-2.202a1.765 1.765 0 0 0-.04-.431l-.94-4.08c-.216-.898-.406-1.305-1.982-2.093-1.223-.625-3.888-1.658-4.676-1.658-.733 0-.947.946-1.822.946-.842 0-1.467-.706-2.255-.706-.757 0-1.25.515-1.63 1.576 0 0-1.06 2.99-1.197 3.424a.81.81 0 0 0-.028.245c0 1.162 4.577 4.974 10.71 4.974m4.101-1.435c.218 1.032.218 1.14.218 1.277 0 1.765-1.984 2.745-4.593 2.745-5.895.004-11.06-3.451-11.06-5.734a2.326 2.326 0 0 1 .19-.925C2.746 9.415 0 9.794 0 12.217c0 3.969 9.405 8.861 16.851 8.861 5.71 0 7.149-2.582 7.149-4.62 0-1.605-1.387-3.425-3.887-4.512',
			description: 'Enterprise-grade stability with 10-year lifecycle, certified hardware support, and Red Hat support portal access.',
			paid: true, price: '$14/mo',
			versions: [
				{ version: '9.4', archs: ['x86_64', 'aarch64'], size: '1.9 GB', type: 'iso' },
				{ version: '8.10', archs: ['x86_64', 'aarch64'], size: '1.8 GB', type: 'iso' }
			]
		}
	];

	// Carousel pagination
	const perPage = 9;
	let page = $state(0);
	let totalPages = $derived(Math.ceil(filteredOfficialList().length / perPage));

	function filteredOfficialList() {
		if (!search.trim()) return officialImages;
		const q = search.toLowerCase();
		return officialImages.filter((i) => i.name.toLowerCase().includes(q) || i.versions.some((v) => v.version.toLowerCase().includes(q)));
	}

	let pagedImages = $derived(() => {
		const list = filteredOfficialList();
		return list.slice(page * perPage, (page + 1) * perPage);
	});

	// Detail view (inline, replaces grid)
	let selectedImage = $state<OfficialImage | null>(null);

	function openDetail(img: OfficialImage) {
		selectedImage = img;
		sheetOpen = true;
	}

	let sheetOpen = $state(false);

	function closeDetail() {
		sheetOpen = false;
		setTimeout(() => (selectedImage = null), 200);
	}

	// User images
	type UserImage = {
		id: string;
		name: string;
		type: ImageType;
		size: string;
		uploaded: string;
		status: 'ready' | 'uploading' | 'processing';
		progress: number;
	};

	let userImages = $state<UserImage[]>([
		{ id: 'img-008', name: 'custom-webserver', type: 'qcow2', size: '8.4 GB', uploaded: '2026-03-28', status: 'ready', progress: 100 },
		{ id: 'img-009', name: 'db-snapshot-apr', type: 'img', size: '12.1 GB', uploaded: '2026-04-02', status: 'ready', progress: 100 },
		{ id: 'img-010', name: 'nixos-24.11-minimal', type: 'iso', size: '1.1 GB', uploaded: '2026-04-04', status: 'ready', progress: 100 }
	]);

	let search = $state('');

	let filteredUser = $derived(() => {
		if (!search.trim()) return userImages;
		const q = search.toLowerCase();
		return userImages.filter((i) => i.name.toLowerCase().includes(q));
	});

	// Upload
	let uploadOpen = $state(false);
	let uploadName = $state('');
	let uploadFile = $state('');
	let uploadDetectedType = $state<ImageType | null>(null);
	let uploadUrl = $state('');
	let uploadMethod = $state<'file' | 'url'>('file');
	let imageCounter = $state(10);

	function detectType(filename: string): ImageType | null {
		const ext = filename.split('.').pop()?.toLowerCase();
		if (ext === 'iso') return 'iso';
		if (ext === 'img') return 'img';
		if (ext === 'qcow2') return 'qcow2';
		return null;
	}

	function handleFileSelect(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		uploadFile = f.name;
		uploadDetectedType = detectType(f.name);
		if (!uploadName) uploadName = f.name.replace(/\.[^.]+$/, '');
	}

	function handleUrlChange() {
		if (uploadUrl) {
			uploadDetectedType = detectType(uploadUrl.split('/').pop() ?? '');
		}
	}

	function startUpload() {
		if (!uploadName.trim()) return;
		const type = uploadDetectedType ?? 'img';
		imageCounter++;
		const sizes = ['1.2 GB', '2.8 GB', '4.5 GB', '680 MB', '9.1 GB', '3.3 GB'];
		const newImg: UserImage = {
			id: `img-${String(imageCounter).padStart(3, '0')}`,
			name: uploadName.trim(), type,
			size: sizes[Math.floor(Math.random() * sizes.length)],
			uploaded: new Date().toISOString().slice(0, 10),
			status: 'uploading', progress: 0
		};
		userImages.push(newImg);
		uploadOpen = false;
		uploadName = ''; uploadFile = ''; uploadUrl = ''; uploadDetectedType = null;

		const idx = userImages.length - 1;
		const tick = setInterval(() => {
			if (userImages[idx].progress >= 100) {
				userImages[idx].status = 'processing';
				clearInterval(tick);
				setTimeout(() => { userImages[idx].status = 'ready'; userImages[idx].progress = 100; }, 1500);
				return;
			}
			userImages[idx].progress += Math.floor(Math.random() * 15 + 5);
			if (userImages[idx].progress > 100) userImages[idx].progress = 100;
		}, 400);
	}

	function deleteImage(id: string) {
		userImages = userImages.filter((i) => i.id !== id);
	}

	const typeColors: Record<ImageType, string> = {
		iso: 'border-blue-800 bg-blue-950/40 text-blue-400',
		img: 'border-amber-800 bg-amber-950/40 text-amber-400',
		qcow2: 'border-purple-800 bg-purple-950/40 text-purple-400'
	};
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<!-- Header -->
	<div class="flex h-10 shrink-0 items-center justify-between border-b border-fyra-gray-800 px-5">
		<div class="flex items-center gap-2">
			<Disc class="h-4 w-4 text-fyra-gray-400" />
			<span class="text-sm font-semibold text-fyra-gray-100">Images</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="relative">
				<Search class="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-fyra-gray-500" />
				<input
					bind:value={search}
					placeholder="Search images..."
					class="h-7 w-44 border border-fyra-gray-700 bg-fyra-gray-800 pl-7 pr-2 text-xs text-fyra-gray-100 placeholder:text-fyra-gray-600 focus:border-fyra-gray-500 focus:outline-none"
				/>
			</div>
			<Button variant="outline" size="sm" class="h-7 gap-1.5 px-3 text-xs" onclick={() => { uploadOpen = true; uploadMethod = 'file'; uploadFile = ''; uploadUrl = ''; uploadName = ''; uploadDetectedType = null; }}>
				<Upload class="h-3 w-3" />
				Upload Image
			</Button>
		</div>
	</div>

	<div class="flex-1 overflow-auto">
		<!-- Official Images -->
		<div class="flex items-center justify-between border-b border-fyra-gray-800 px-5 py-3">
			<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500">Official Images</span>
			{#if totalPages > 1 && !selectedImage}
				<div class="flex items-center gap-1.5">
					<button class="flex h-6 w-6 items-center justify-center text-fyra-gray-500 transition-colors hover:text-fyra-gray-300 disabled:opacity-30" disabled={page === 0} onclick={() => page--}>
						<ChevronLeft class="h-3.5 w-3.5" />
					</button>
					<span class="text-[10px] text-fyra-gray-500">{page + 1}/{totalPages}</span>
					<button class="flex h-6 w-6 items-center justify-center text-fyra-gray-500 transition-colors hover:text-fyra-gray-300 disabled:opacity-30" disabled={page >= totalPages - 1} onclick={() => page++}>
						<ChevronRight class="h-3.5 w-3.5" />
					</button>
				</div>
			{/if}
		</div>

		<div class="border-b border-fyra-gray-800">
			<!-- Card grid -->
			<div class="grid grid-cols-3 gap-px bg-fyra-gray-900">
				{#each pagedImages() as img (img.id)}
					<button
						class="relative flex gap-4 overflow-hidden bg-fyra-gray-900 p-5 text-left transition-colors hover:bg-fyra-gray-800/40"
						onclick={() => openDetail(img)}
					>
						<!-- Brand color mist -->
						<div
							class="pointer-events-none absolute inset-0 opacity-[0.05]"
							style="background: linear-gradient(135deg, {img.iconColor} 0%, transparent 60%)"
						></div>
						<div class="relative">
							{#if img.icon}
								<svg viewBox="0 0 24 24" class="h-12 w-12" fill="var(--fyra-gray-300)"><path d={img.icon} /></svg>
							{:else}
								<span class="flex h-12 w-12 items-center justify-center text-xl font-bold text-fyra-gray-300">{img.shortName}</span>
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
							<p class="mt-auto pt-2 text-[10px] leading-none text-fyra-gray-600">
								{img.versions[0].archs.join('  ')} | {img.versions.length} version{img.versions.length > 1 ? 's' : ''}
							</p>
						</div>
					</button>
				{/each}
			</div>
			{#if filteredOfficialList().length === 0 && search.trim()}
				<div class="px-5 py-8 text-center text-xs text-fyra-gray-500">No official images match "{search}"</div>
			{/if}

		</div>

		<!-- User Uploaded Images (compact, pinned to bottom) -->
		<div class="flex items-center justify-between border-b border-fyra-gray-800 px-5 py-2.5">
			<span class="text-xs font-semibold uppercase tracking-wider text-fyra-gray-500">
				Your Images ({userImages.length})
			</span>
		</div>

		{#if filteredUser().length > 0}
			<div class="divide-y divide-fyra-gray-800/20">
				{#each filteredUser() as img (img.id)}
					<div class="flex items-center justify-between px-5 py-4 transition-colors hover:bg-fyra-gray-800/20">
						<div class="flex items-center gap-2">
							<Disc class="h-2.5 w-2.5 shrink-0 text-fyra-gray-600" />
							<span class="text-xs text-fyra-gray-200">{img.name}</span>
							<Badge variant="outline" class="text-[7px] {typeColors[img.type]}">.{img.type}</Badge>
							<span class="text-[10px] text-fyra-gray-600">{img.size}</span>
						</div>
						<div class="flex items-center gap-1.5">
							{#if img.status === 'ready'}
								<span class="text-[10px] text-fyra-gray-600">{img.uploaded}</span>
							{:else if img.status === 'uploading'}
								<div class="flex items-center gap-1">
									<div class="h-0.5 w-12 bg-fyra-gray-800">
										<div class="h-full bg-fyra-red-500 transition-all" style="width: {img.progress}%"></div>
									</div>
									<span class="text-[9px] text-fyra-gray-500">{img.progress}%</span>
								</div>
							{:else}
								<span class="text-[9px] text-amber-500">Processing</span>
							{/if}
							<Button variant="ghost" size="sm" class="h-5 w-5 p-0 text-fyra-gray-600 hover:text-fyra-red-400" onclick={() => deleteImage(img.id)} disabled={img.status !== 'ready'}>
								<Trash2 class="h-2.5 w-2.5" />
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{:else if search.trim()}
			<div class="px-5 py-3 text-center text-[10px] text-fyra-gray-600">No matches</div>
		{:else}
			<div class="flex items-center justify-center gap-1.5 py-3 text-fyra-gray-600">
				<Upload class="h-3 w-3" />
				<p class="text-[10px]">No uploaded images</p>
			</div>
		{/if}
	</div>
</div>

<!-- Image Detail Sheet -->
<Sheet.Root bind:open={sheetOpen} onOpenChange={(v) => { if (!v) closeDetail(); }}>
	<Sheet.Content side="right" class="border-fyra-gray-800 bg-fyra-gray-900 px-6 py-5 sm:max-w-md">
		{#if selectedImage}
			<Sheet.Header class="border-b border-fyra-gray-800 pb-4">
				<div class="flex items-start gap-4">
					<div class="shrink-0">
						{#if selectedImage.icon}
							<svg viewBox="0 0 24 24" class="h-14 w-14" fill="var(--fyra-gray-300)"><path d={selectedImage.icon} /></svg>
						{:else}
							<span class="flex h-14 w-14 items-center justify-center text-2xl font-bold text-fyra-gray-300">{selectedImage.shortName}</span>
						{/if}
					</div>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<Sheet.Title class="text-base">{selectedImage.name}</Sheet.Title>
							{#if selectedImage.paid}
								<Badge variant="outline" class="border-fyra-red-700 bg-fyra-red-950/40 text-[9px] text-fyra-red-400">
									<DollarSign class="mr-0.5 h-2 w-2" /> {selectedImage.price}
								</Badge>
							{/if}
						</div>
						<Sheet.Description class="mt-1 text-xs leading-relaxed">{selectedImage.description}</Sheet.Description>
					</div>
				</div>
			</Sheet.Header>

			<div class="flex-1 overflow-auto py-4">
				<span class="text-[10px] font-semibold uppercase tracking-wider text-fyra-gray-500">Available Versions</span>
				<div class="mt-3 divide-y divide-fyra-gray-800/30">
					{#each selectedImage.versions as ver (ver.version)}
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
								<Badge variant="outline" class="text-[8px] {typeColors[ver.type]}">{ver.type.toUpperCase()}</Badge>
								<span class="text-[10px] text-fyra-gray-500">{ver.size}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>

<!-- Upload Image Dialog -->
<Dialog.Root bind:open={uploadOpen}>
	<Dialog.Content class="border-fyra-gray-800 bg-fyra-gray-900 sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Upload Image</Dialog.Title>
			<Dialog.Description>Upload a .iso, .img, or .qcow2 file to use with your servers.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-4 py-4">
			<div class="flex flex-col gap-2">
				<Label>Image Name</Label>
				<Input bind:value={uploadName} placeholder="my-custom-image" />
			</div>
			<div class="flex flex-col gap-2">
				<Label>Source</Label>
				<div class="flex gap-2">
					<button
						class="flex-1 border px-3 py-2 text-center text-xs font-medium transition-colors {uploadMethod === 'file' ? 'border-fyra-red-500 bg-fyra-red-950/20 text-fyra-gray-100' : 'border-fyra-gray-700 text-fyra-gray-400 hover:border-fyra-gray-600'}"
						onclick={() => (uploadMethod = 'file')}
					>File Upload</button>
					<button
						class="flex-1 border px-3 py-2 text-center text-xs font-medium transition-colors {uploadMethod === 'url' ? 'border-fyra-red-500 bg-fyra-red-950/20 text-fyra-gray-100' : 'border-fyra-gray-700 text-fyra-gray-400 hover:border-fyra-gray-600'}"
						onclick={() => (uploadMethod = 'url')}
					>URL Import</button>
				</div>
			</div>
			{#if uploadMethod === 'file'}
				<label class="flex cursor-pointer flex-col items-center justify-center border border-dashed border-fyra-gray-600 bg-fyra-gray-800/30 px-4 py-6 text-center transition-colors hover:border-fyra-gray-500 hover:bg-fyra-gray-800/50">
					<Upload class="mb-2 h-6 w-6 text-fyra-gray-500" />
					{#if uploadFile}
						<span class="text-xs font-medium text-fyra-gray-200">{uploadFile}</span>
						{#if uploadDetectedType}
							<span class="mt-1 text-[10px] text-fyra-gray-500">Detected: .{uploadDetectedType}</span>
						{/if}
					{:else}
						<span class="text-xs text-fyra-gray-400">Drop or click to browse (.iso, .img, .qcow2)</span>
					{/if}
					<input type="file" accept=".iso,.img,.qcow2" class="hidden" onchange={handleFileSelect} />
				</label>
			{:else}
				<div class="flex flex-col gap-2">
					<Label>Image URL</Label>
					<Input bind:value={uploadUrl} placeholder="https://example.com/image.iso" oninput={handleUrlChange} />
					{#if uploadDetectedType}
						<p class="text-xs text-fyra-gray-500">Detected: .{uploadDetectedType}</p>
					{:else if uploadUrl}
						<p class="text-xs text-amber-500">Could not detect format. Will default to .img</p>
					{/if}
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (uploadOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={startUpload} disabled={!uploadName.trim() && !uploadFile && !uploadUrl}>
				<Upload class="h-3 w-3" />
				Upload
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
