export type SocialRow = {
  platform: string;
  url: string;
};

export type FormState = {
  artistName: string;
  handle: string;
  email: string;
  phone: string;
  requestedPlanType: string;
  socials: SocialRow[];
  aboutMe: string;
  messageForFans: string;
  profilePhoto: File | null;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
export const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
export const HTTP_RE = /^https?:\/\//i;
export const MAX_SOCIAL_ROWS = 5;
export const SOCIAL_PLATFORMS = ['instagram', 'youtube', 'spotify', 'facebook', 'x', 'website', 'other'];
export const PLAN_OPTIONS = [
  { value: 'basic', label: 'Basic' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'premium', label: 'Premium (Coming soon)', disabled: true },
];

export const INITIAL_FORM: FormState = {
  artistName: '',
  handle: '',
  email: '',
  phone: '',
  requestedPlanType: 'basic',
  socials: [],
  aboutMe: '',
  messageForFans: '',
  profilePhoto: null,
};

export type ValidationErrors = Record<string, string>;

export const normalizeHandle = (value: string) => value.trim().replace(/^@+/, '').toLowerCase();
export const normalizePhone = (value: string) => value.trim().replace(/\D+/g, '');
export const buildSocialsArray = (rows: SocialRow[]) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      platform: String(row?.platform ?? '').trim(),
      url: String(row?.url ?? '').trim(),
    }))
    .filter((row) => row.platform && row.url)
    .slice(0, MAX_SOCIAL_ROWS);

export const buildConflictMessage = (field: string) => {
  if (field === 'email') return 'That email is already in use.';
  if (field === 'phone') return 'That phone number is already in use.';
  if (field === 'handle') return 'That handle is already in use.';
  return 'A conflicting request already exists.';
};

export const mapValidationDetails = (details: any[]): ValidationErrors => {
  const next: ValidationErrors = {};
  for (const detail of details || []) {
    const field = String(detail?.field || '').trim();
    const message = String(detail?.message || 'Invalid value').trim();
    if (!field) continue;
    if (field === 'artist_name') next.artistName = message;
    else if (field === 'handle') next.handle = message;
    else if (field === 'email') next.email = message;
    else if (field === 'phone') next.phone = message;
    else if (field === 'requested_plan_type' || field === 'planType') next.requestedPlanType = message;
    else if (field === 'about') next.aboutMe = message;
    else if (field === 'message_for_fans') next.messageForFans = message;
    else if (field.startsWith('socials[')) {
      const idx = field.match(/^socials\[(\d+)\]/)?.[1];
      if (idx != null) next[`socials.${idx}`] = message;
    }
  }
  return next;
};

export const validateFormState = (state: FormState): ValidationErrors => {
  const next: ValidationErrors = {};
  const normalizedPhone = normalizePhone(state.phone);
  if (!state.artistName.trim()) next.artistName = 'Artist Name is required.';
  if (!state.handle.trim()) next.handle = 'Handle is required.';
  if (!state.email.trim()) next.email = 'Email is required.';
  if (!normalizedPhone) next.phone = 'Phone number is required';
  if (!state.requestedPlanType.trim()) next.requestedPlanType = 'Plan Type is required.';
  if (state.handle.trim() && normalizeHandle(state.handle).length < 2) {
    next.handle = 'Handle must be at least 2 characters.';
  }
  if (state.email.trim() && !EMAIL_RE.test(state.email.trim())) {
    next.email = 'Enter a valid email address.';
  }
  if (normalizedPhone && !INDIAN_MOBILE_RE.test(normalizedPhone)) {
    next.phone = 'Enter a valid 10-digit Indian mobile number';
  }
  state.socials.forEach((row, index) => {
    if (!row.platform.trim() || !row.url.trim()) {
      next[`socials.${index}`] = 'Platform and URL are required.';
      return;
    }
    if (!HTTP_RE.test(row.url.trim())) {
      next[`socials.${index}`] = 'URL must start with http or https.';
    }
  });
  return next;
};

