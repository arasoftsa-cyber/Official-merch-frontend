export type DropRow = {
  id: string;
  handle?: string;
  title: string;
  status: string;
  artistId?: string;
  artistName?: string;
  description?: string | null;
  heroImageUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  quizJson?: any;
  mappedProductsCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ArtistOption = {
  id: string;
  name: string;
};

export type ProductOption = {
  id: string;
  title: string;
  artistId?: string;
};

export type DropNotice = {
  type: 'success' | 'error';
  text: string;
};

export type HeroUploadStatus = {
  type: 'success' | 'error' | 'info';
  text: string;
};

export type DropLifecycleAction = 'publish' | 'unpublish' | 'archive';
