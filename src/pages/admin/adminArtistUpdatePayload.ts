export type AdminArtistSocialRow = {
  platform: string;
  value: string;
};

export type AdminArtistCapabilitiesForUpdate = {
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
};

export type AdminArtistUpdateComparable = {
  name: string;
  handle: string;
  email: string;
  status: string;
  is_featured: boolean;
  phone: string;
  about: string;
  message_for_fans: string;
  socials: AdminArtistSocialRow[];
  profilePhotoUrl: string;
};

const toText = (value: unknown) => String(value ?? '').trim();
const toLowerText = (value: unknown) => toText(value).toLowerCase();
const toNullableTrimmed = (value: unknown) => {
  const text = toText(value);
  return text ? text : null;
};

export const normalizeSocialRows = (rows: unknown): AdminArtistSocialRow[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((entry: any) => ({
      platform: toText(entry?.platform ?? entry?.name),
      value: toText(
        entry?.value ?? entry?.profileLink ?? entry?.url ?? entry?.link ?? entry?.handle
      ),
    }))
    .filter((entry) => entry.platform || entry.value);
};

const sameSocials = (left: AdminArtistSocialRow[], right: AdminArtistSocialRow[]) =>
  JSON.stringify(left) === JSON.stringify(right);

export const buildAdminArtistUpdatePayload = ({
  initial,
  current,
  capabilities,
}: {
  initial: AdminArtistUpdateComparable;
  current: AdminArtistUpdateComparable;
  capabilities: AdminArtistCapabilitiesForUpdate;
}): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  if (capabilities.canEditName) {
    const next = toText(current.name);
    if (next !== toText(initial.name)) payload.name = next;
  }

  if (capabilities.canEditHandle) {
    const next = toText(current.handle).replace(/^@+/, '');
    if (next !== toText(initial.handle).replace(/^@+/, '')) payload.handle = next;
  }

  if (capabilities.canEditEmail) {
    const next = toLowerText(current.email);
    if (next !== toLowerText(initial.email)) payload.email = next;
  }

  if (capabilities.canEditStatus) {
    const next = toLowerText(current.status);
    if (next !== toLowerText(initial.status)) payload.status = next;
  }

  if (capabilities.canEditFeatured) {
    const next = Boolean(current.is_featured);
    if (next !== Boolean(initial.is_featured)) payload.is_featured = next;
  }

  if (capabilities.canEditPhone) {
    const next = toNullableTrimmed(current.phone);
    if (next !== toNullableTrimmed(initial.phone)) payload.phone = next;
  }

  if (capabilities.canEditAboutMe) {
    const next = toNullableTrimmed(current.about);
    if (next !== toNullableTrimmed(initial.about)) payload.about = next;
  }

  if (capabilities.canEditMessageForFans) {
    const next = toNullableTrimmed(current.message_for_fans);
    if (next !== toNullableTrimmed(initial.message_for_fans)) {
      payload.message_for_fans = next;
    }
  }

  if (capabilities.canEditSocials) {
    const next = normalizeSocialRows(current.socials);
    const base = normalizeSocialRows(initial.socials);
    if (!sameSocials(next, base)) payload.socials = next;
  }

  if (capabilities.canEditProfilePhoto) {
    const next = toNullableTrimmed(current.profilePhotoUrl);
    if (next !== toNullableTrimmed(initial.profilePhotoUrl)) {
      payload.profile_photo_url = next;
    }
  }

  return payload;
};
