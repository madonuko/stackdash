export const featureFlagKeys = ['colocation', 'firewall', 'images', 'volumes'] as const;

export type FeatureFlagKey = (typeof featureFlagKeys)[number];

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const defaultFeatureFlags: FeatureFlags = {
	colocation: false,
	firewall: false,
	images: false,
	volumes: false
};

export const developmentFeatureFlags: FeatureFlags = {
	colocation: true,
	firewall: true,
	images: true,
	volumes: true
};

export const featureFlagLabels: Record<FeatureFlagKey, string> = {
	colocation: 'Colocation',
	firewall: 'Firewall',
	images: 'Images',
	volumes: 'Volumes'
};
