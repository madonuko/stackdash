#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

channel="${1:-stream}"
mkdir -p .cache

case "$channel" in
	stream)
		iso_url=$(curl -fsSL https://vyos.net/get/stream/ | grep -oE 'https://[^"]+-generic-amd64\.iso' | head -n1)
		;;
	rolling)
		iso_url=$(curl -fsSL https://api.github.com/repos/vyos/vyos-nightly-build/releases/latest |
			grep -oE 'https://[^"]+-rolling-generic-amd64\.iso' | head -n1)
		;;
	*)
		echo "usage: $0 [stream|rolling]" >&2
		exit 1
		;;
esac

[[ -n $iso_url ]] || { echo "could not resolve latest $channel ISO" >&2; exit 1; }

iso=".cache/$(basename "$iso_url")"
version=$(basename "$iso" | sed 's/^vyos-//; s/-generic-amd64\.iso$//')

if [[ -f $iso ]]; then
	echo "using cached $iso"
else
	echo "downloading $iso_url"
	curl -fL --progress-bar -o "$iso.part" "$iso_url"
	mv "$iso.part" "$iso"
fi

image="localhost/fyrastack/vyos"
podman build --dns "${VYOS_BUILD_DNS:-1.1.1.1}" -f Containerfile --build-arg ISO="$iso" \
	-t "$image:$version" -t "$image:$channel" .

cat <<EOF

built $image:$version ($image:$channel)

run it (VyOS needs an IPv6-enabled network):
  podman network exists vyos-dev >/dev/null 2>&1 || podman network create --ipv6 vyos-dev
  podman run -d --name vyos --privileged --network vyos-dev -p 8443:443 \\
    -v /lib/modules:/lib/modules:ro $image:$channel

dashboard .env:
  VYOS_API_URL="https://127.0.0.1:8443"
  VYOS_API_KEY="vyos-dev"
  VYOS_USE_VPC="false"
  VYOS_VERIFY_SSL="false"
EOF
