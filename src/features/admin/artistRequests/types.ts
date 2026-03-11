export const STATUS_OPTIONS = ['pending', 'approved', 'rejected'] as const;

export type StatusOption = (typeof STATUS_OPTIONS)[number];

export const STATUS_LABELS: Record<StatusOption, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const ARTIST_REQUESTS_ENDPOINT = '/api/admin/artist-access-requests';
export const ARTIST_REQUESTS_LIMIT = 20;

export type SocialItem = {
  platform: string;
  profileLink: string;
};

export type ArtistRequest = {
  id: string;
  createdAt: string;
  status: string;
  source: string;
  labelId?: string | null;
  artistName: string;
  handle: string;
  email: string;
  phone: string;
  socials: SocialItem[];
  aboutMe: string;
  profilePhotoUrl: string;
  messageForFans: string;
  requestedPlanType: string;
  rejectionComment: string;
};

export type ApproveFieldErrors = {
  finalPlanType?: string;
  paymentMode?: string;
  transactionId?: string;
  approvalPassword?: string;
};

export type SaveAction = 'approve' | 'reject';
