export type ArtistPortfolioRowDto = {
  artistId: string;
  artistName: string;
  orders30d: number;
  gross30d: number;
  units30d: number;
  activeProductsCount: number;
};

export type LabelSummaryDto = {
  totalArtists: number;
  activeArtists30d: number;
  inactiveArtists: number;
  totalGross: number;
  artists: ArtistPortfolioRowDto[];
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const EMPTY_LABEL_SUMMARY: LabelSummaryDto = {
  totalArtists: 0,
  activeArtists30d: 0,
  inactiveArtists: 0,
  totalGross: 0,
  artists: [],
};

export const mapLabelSummaryDto = (payload: any): LabelSummaryDto => {
  const artistsRaw = Array.isArray(payload?.artists) ? payload.artists : [];
  const artists = artistsRaw.map((artist: any) => ({
    artistId: toText(artist?.artistId ?? artist?.id),
    artistName:
      toText(artist?.artistName) ||
      toText(artist?.name) ||
      toText(artist?.handle) ||
      toText(artist?.artistId) ||
      'Unknown',
    orders30d: toNumber(artist?.orders30d),
    gross30d: toNumber(artist?.gross30d),
    units30d: toNumber(artist?.units30d),
    activeProductsCount: toNumber(artist?.activeProductsCount),
  }));

  const totalArtists = payload?.totalArtists !== undefined ? toNumber(payload.totalArtists) : artists.length;
  const activeArtists30d = toNumber(payload?.activeArtists30d);

  return {
    totalArtists,
    activeArtists30d,
    inactiveArtists:
      payload?.inactiveArtists !== undefined
        ? toNumber(payload.inactiveArtists)
        : Math.max(totalArtists - activeArtists30d, 0),
    totalGross: toNumber(payload?.totalGross ?? payload?.grossCents ?? payload?.grossAllTimeCents),
    artists,
  };
};
