export const ONBOARDING_SKU_TYPES = [
  'regular_tshirt',
  'oversized_tshirt',
  'hoodie',
  'oversized_hoodie',
] as const;

export type OnboardingSkuType = (typeof ONBOARDING_SKU_TYPES)[number];

const ONBOARDING_SKU_LABELS: Record<OnboardingSkuType, string> = {
  regular_tshirt: 'Regular T-Shirt',
  oversized_tshirt: 'Oversized T-Shirt',
  hoodie: 'Hoodie',
  oversized_hoodie: 'Oversized Hoodie',
};

const ONBOARDING_SKU_TYPE_ALIASES: Record<string, OnboardingSkuType> = {
  regulartshirt: 'regular_tshirt',
  oversizedtshirt: 'oversized_tshirt',
  hoodie: 'hoodie',
  oversizedhoodie: 'oversized_hoodie',
};

const normalizeOnboardingSkuType = (value: string): OnboardingSkuType | '' =>
  {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';

    const snake = raw
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (Object.prototype.hasOwnProperty.call(ONBOARDING_SKU_LABELS, snake)) {
      return snake as OnboardingSkuType;
    }

    const collapsed = raw.replace(/[^a-z]/g, '');
    return ONBOARDING_SKU_TYPE_ALIASES[collapsed] || '';
  };

export const formatOnboardingSkuTypeLabel = (value: string): string => {
  const normalized = normalizeOnboardingSkuType(value);
  if (normalized && Object.prototype.hasOwnProperty.call(ONBOARDING_SKU_LABELS, normalized)) {
    return ONBOARDING_SKU_LABELS[normalized];
  }
  return String(value || '')
    .trim()
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};
