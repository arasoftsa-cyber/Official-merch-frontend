import {
  formatOnboardingSkuTypeLabel,
  type OnboardingSkuType,
} from '../../../shared/utils/onboardingSkuTypes';

export type ProductStatus = 'pending' | 'inactive' | 'active' | 'rejected';
export type StatusFilter = 'all' | ProductStatus;
export type SkuType = OnboardingSkuType;

export type NewMerchFormState = {
  merchName: string;
  merchStory: string;
  designImage: File | null;
  skuTypes: Record<SkuType, boolean>;
};

export type NewMerchErrors = {
  merchName?: string;
  merchStory?: string;
  designImage?: string;
  skuTypes?: string;
};

export const SKU_OPTIONS: Array<{ value: SkuType; label: string; testId: string }> = [
  {
    value: 'regular_tshirt',
    label: formatOnboardingSkuTypeLabel('regular_tshirt'),
    testId: 'artist-sku-regular-tshirt',
  },
  {
    value: 'oversized_tshirt',
    label: formatOnboardingSkuTypeLabel('oversized_tshirt'),
    testId: 'artist-sku-oversized-tshirt',
  },
  { value: 'hoodie', label: formatOnboardingSkuTypeLabel('hoodie'), testId: 'artist-sku-hoodie' },
  {
    value: 'oversized_hoodie',
    label: formatOnboardingSkuTypeLabel('oversized_hoodie'),
    testId: 'artist-sku-oversized-hoodie',
  },
];

export const ALLOWED_DESIGN_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']);
export const ALLOWED_DESIGN_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg'];

export const defaultSkuSelection = (): Record<SkuType, boolean> => ({
  regular_tshirt: false,
  oversized_tshirt: false,
  hoodie: false,
  oversized_hoodie: false,
});

export const initialNewMerchForm = (): NewMerchFormState => ({
  merchName: '',
  merchStory: '',
  designImage: null,
  skuTypes: defaultSkuSelection(),
});

export const formatUpdatedDate = (product: any) => {
  const raw =
    product?.updated_at ??
    product?.updatedAt ??
    product?.created_at ??
    product?.createdAt ??
    null;
  if (!raw) return '-';
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? String(raw)
    : date.toLocaleString('en-US', { hour12: false });
};

export const getProductId = (product: any) => product?.id ?? product?.productId ?? null;

export const normalizeProductStatus = (product: any): ProductStatus => {
  const rawStatus = String(product?.status ?? '').trim().toLowerCase();
  if (
    rawStatus === 'pending' ||
    rawStatus === 'inactive' ||
    rawStatus === 'active' ||
    rawStatus === 'rejected'
  ) {
    return rawStatus;
  }
  if (typeof product?.is_active === 'boolean') {
    return product.is_active ? 'active' : 'inactive';
  }
  if (typeof product?.isActive === 'boolean') {
    return product.isActive ? 'active' : 'inactive';
  }
  return 'active';
};

export const isProductActive = (product: any) => normalizeProductStatus(product) === 'active';

export const isProductToggleable = (product: any) => {
  const status = normalizeProductStatus(product);
  return status === 'active' || status === 'inactive';
};

export const readProductStory = (product: any) =>
  String(product?.merch_story ?? product?.merchStory ?? product?.description ?? '').trim();

export const readProductDesignImageUrl = (product: any) =>
  String(product?.designImageUrl ?? product?.design_image_url ?? '').trim();

export const readProductSkuTypes = (product: any): string[] => {
  const raw = Array.isArray(product?.skuTypes)
    ? product.skuTypes
    : Array.isArray(product?.sku_types)
      ? product.sku_types
      : [];
  return raw
    .map((entry: any) => String(entry ?? '').trim())
    .filter(Boolean);
};

export const readRejectionReason = (product: any) =>
  String(product?.rejectionReason ?? product?.rejection_reason ?? '').trim();

export const formatStatusLabel = (status: ProductStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1);

export const getStatusPillClass = (status: ProductStatus) => {
  if (status === 'active') {
    return 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
  }
  if (status === 'pending') {
    return 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300';
  }
  if (status === 'rejected') {
    return 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300';
  }
  return 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400';
};

export const getSelectedSkuTypes = (skuTypes: Record<SkuType, boolean>) =>
  SKU_OPTIONS.filter((entry) => skuTypes[entry.value]).map((entry) => entry.value);

export const isAllowedDesignImage = (file: File) => {
  const fileName = file.name.toLowerCase();
  const extensionAllowed = ALLOWED_DESIGN_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (extensionAllowed) return true;
  const mimeType = String(file.type || '').toLowerCase();
  return ALLOWED_DESIGN_MIME_TYPES.has(mimeType);
};

export const normalizeServerFieldMessage = (field: string, message: string) => {
  const normalizedField = field.toLowerCase();
  const normalizedMessage = message.toLowerCase();

  if (normalizedField.includes('merch_name')) return 'Merch name is required.';
  if (normalizedField.includes('merch_story')) return 'Merch story is required.';
  if (normalizedField.includes('design_image')) return 'Design image is required.';
  if (normalizedField.includes('sku_types')) return 'Select at least one SKU type.';

  if (normalizedMessage.includes('unsupported sku')) {
    return 'Select only supported SKU types.';
  }
  if (normalizedMessage.includes('design image') && normalizedMessage.includes('png')) {
    return 'Upload a PNG, JPG, or SVG file.';
  }
  return message;
};

export const parseFormErrorMessage = (err: any) => {
  const raw = String(err?.message ?? err?.payload?.error ?? err?.payload?.message ?? '').toLowerCase();
  if (!raw) return 'We could not submit your merch request right now.';
  if (raw.includes('forbidden')) return 'You are not allowed to submit merch requests from this account.';
  if (raw.includes('validation')) return 'Please review the highlighted fields and try again.';
  if (raw.includes('bad_request') || raw.includes('request_validation_failed') || raw.includes('invalid')) {
    return 'Please review your request details and try again.';
  }
  return 'We could not submit your merch request right now.';
};

