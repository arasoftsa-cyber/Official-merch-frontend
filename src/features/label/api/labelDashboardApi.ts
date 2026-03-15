import { apiFetch } from '../../../shared/api/http';
import { mapLabelSummaryDto, type LabelSummaryDto } from './labelDashboardDtos';
export { EMPTY_LABEL_SUMMARY, mapLabelSummaryDto, type LabelSummaryDto } from './labelDashboardDtos';

export type LabelArtistAccessRequestInput = {
  artistName: string;
  handle: string;
  contactEmail: string;
  contactPhone: string;
  socialLink: string;
  pitch: string;
};

const toText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export async function fetchLabelDashboardSummary(): Promise<LabelSummaryDto> {
  const payload = await apiFetch('/labels/dashboard/summary');
  return mapLabelSummaryDto(payload);
}

export async function submitLabelArtistAccessRequest(
  input: LabelArtistAccessRequestInput
): Promise<void> {
  const socialLink = toText(input.socialLink);

  await apiFetch('/artist-access-requests', {
    method: 'POST',
    body: {
      artist_name: toText(input.artistName),
      handle: toText(input.handle) || null,
      contact_email: toText(input.contactEmail).toLowerCase() || null,
      contact_phone: toText(input.contactPhone) || null,
      socials: socialLink
        ? [{ platform: 'link', profile_link: socialLink }]
        : [],
      pitch: toText(input.pitch) || null,
    },
  });
}
