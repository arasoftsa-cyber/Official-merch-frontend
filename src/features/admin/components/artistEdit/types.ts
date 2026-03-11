import { resolveMediaUrl } from '../../../../shared/utils/media';

export type SocialRow = {
  platform: string;
  value: string;
};

export type ArtistCapabilities = {
  canEditName: boolean;
  canEditHandle: boolean;
  canEditEmail: boolean;
  canEditStatus: boolean;
  canEditFeatured: boolean;
  canEditPhone: boolean;
  canEditAboutMe: boolean;
  canEditMessageForFans: boolean;
  canEditSocials: boolean;
  canEditProfilePhoto: boolean;
  canUploadProfilePhoto: boolean;
};

export type ArtistDetail = {
  id: string;
  name: string;
  handle: string;
  email: string;
  status: string;
  is_featured: boolean;
  phone: string;
  about: string;
  message_for_fans: string;
  profilePhotoUrl: string;
  socials: SocialRow[];
  statusOptions: string[];
  capabilities: ArtistCapabilities;
};

export type ArtistFormState = {
  name: string;
  handle: string;
  email: string;
  status: string;
  is_featured: boolean;
  phone: string;
  about: string;
  message_for_fans: string;
  socials: SocialRow[];
  profilePhotoUrl: string;
};

export type SubscriptionFormState = {
  status: string;
  endDate: string;
  paymentMode: string;
  transactionId: string;
};

export const DEFAULT_CAPABILITIES: ArtistCapabilities = {
  canEditName: true,
  canEditHandle: false,
  canEditEmail: true,
  canEditStatus: true,
  canEditFeatured: true,
  canEditPhone: true,
  canEditAboutMe: true,
  canEditMessageForFans: true,
  canEditSocials: true,
  canEditProfilePhoto: true,
  canUploadProfilePhoto: false,
};

export const DEFAULT_STATUS_OPTIONS = ['approved', 'active', 'inactive', 'rejected'];
export const SUBSCRIPTION_STATUS_OPTIONS = ['active', 'expired', 'cancelled'] as const;
export const ADVANCED_PAYMENT_MODE_OPTIONS = ['cash', 'online'] as const;
export const EMPTY_SOCIAL_ROW: SocialRow = { platform: '', value: '' };

export const toText = (value: unknown) => String(value ?? '').trim();

export const toTitleCase = (value: unknown) => {
  const text = toText(value).toLowerCase();
  if (!text) return '-';
  return text
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const toDateOnly = (value: unknown) => {
  const text = toText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

export const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const normalizeDetail = (payload: any): ArtistDetail => {
  const row = payload?.item ?? payload?.artist ?? payload ?? {};
  const rawSocials = Array.isArray(row?.socials) ? row.socials : [];
  const socials = rawSocials
    .map((entry: any) => ({
      platform: String(entry?.platform ?? entry?.name ?? '').trim(),
      value: String(
        entry?.value ?? entry?.profileLink ?? entry?.url ?? entry?.link ?? entry?.handle ?? ''
      ).trim(),
    }))
    .filter((entry: SocialRow) => entry.platform || entry.value);

  const statusOptions = Array.isArray(row?.statusOptions)
    ? row.statusOptions.map((s: any) => String(s || '').trim().toLowerCase()).filter(Boolean)
    : DEFAULT_STATUS_OPTIONS;

  return {
    id: String(row?.id ?? ''),
    name: String(row?.name ?? row?.artist_name ?? '').trim(),
    handle: String(row?.handle ?? '').replace(/^@+/, '').trim(),
    email: String(row?.email ?? row?.contact_email ?? '').trim(),
    status: String(row?.status ?? '').trim().toLowerCase() || 'active',
    is_featured: Boolean(row?.is_featured ?? row?.isFeatured),
    phone: String(row?.phone ?? row?.contact_phone ?? '').trim(),
    about: String(row?.about ?? row?.aboutMe ?? row?.about_me ?? '').trim(),
    message_for_fans: String(row?.message_for_fans ?? row?.messageForFans ?? '').trim(),
    profilePhotoUrl:
      resolveMediaUrl(String(row?.profilePhotoUrl ?? row?.profile_photo_url ?? '').trim() || null) ?? '',
    socials,
    statusOptions: statusOptions.length ? statusOptions : DEFAULT_STATUS_OPTIONS,
    capabilities: { ...DEFAULT_CAPABILITIES, ...(row?.capabilities || {}) },
  };
};

export const createInitialFormState = (): ArtistFormState => ({
  name: '',
  handle: '',
  email: '',
  status: 'active',
  is_featured: false,
  phone: '',
  about: '',
  message_for_fans: '',
  socials: [EMPTY_SOCIAL_ROW],
  profilePhotoUrl: '',
});

export const createInitialSubscriptionFormState = (): SubscriptionFormState => ({
  status: 'active',
  endDate: '',
  paymentMode: 'NA',
  transactionId: 'NA',
});
