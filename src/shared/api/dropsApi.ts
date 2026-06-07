import { apiFetch } from './http';

export type DropDto = {
    id: string;
    title: string;
    description?: string | null;
    artistId?: string | null;
    handle?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    heroImageUrl?: string | null;
    status?: string;
    quizJson?: any | null;
    mappedProductsCount?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type DropInput = {
    title: string;
    description?: string | null;
    artistId: string;
    handle?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    heroImageUrl?: string | null;
};

export type DropUpdateInput = Partial<Omit<DropInput, 'artistId'>> & {
    artistId?: string;
};

export type ArtistDto = {
    id: string;
    handle?: string;
    name: string;
    story?: string | null;
    status?: string;
    profile_photo_url?: string | null;
    profilePhotoUrl?: string | null;
    coverImageUrl?: string | null;
    coverUrl?: string | null;
    theme?: Record<string, any>;
};

const readText = (value: unknown): string | null => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (value == null) return null;
    const stringified = String(value).trim();
    return stringified.length > 0 ? stringified : null;
};

const readDropList = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.drops)) return payload.drops;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
};

const readDropObject = (payload: any): any => {
    if (payload?.drop && typeof payload.drop === 'object') return payload.drop;
    if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        return payload.data;
    }
    return payload;
};

const readArtistList = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.artists)) return payload.artists;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

export const normalizeDrop = (raw: any): DropDto => ({
    id: readText(raw?.id ?? raw?.dropId ?? raw?._id) || '',
    title: readText(raw?.title) || '',
    description: readText(raw?.description),
    artistId: readText(raw?.artistId ?? raw?.artist_id),
    handle: readText(raw?.handle),
    startsAt: readText(raw?.startsAt ?? raw?.starts_at),
    endsAt: readText(raw?.endsAt ?? raw?.ends_at),
    heroImageUrl: readText(raw?.heroImageUrl ?? raw?.hero_image_url ?? raw?.coverUrl),
    status: readText(raw?.status) || 'draft',
    quizJson: raw?.quizJson ?? raw?.quiz_json ?? null,
    mappedProductsCount: typeof raw?.mappedProductsCount === 'number' ? raw.mappedProductsCount :
        typeof raw?.mapped_products_count === 'number' ? raw.mapped_products_count : null,
    createdAt: readText(raw?.createdAt ?? raw?.created_at),
    updatedAt: readText(raw?.updatedAt ?? raw?.updated_at),
});

export const normalizeArtist = (raw: any): ArtistDto => ({
    id: readText(raw?.id ?? raw?._id) || '',
    handle: readText(raw?.handle),
    name: readText(raw?.name) || '',
    story: readText(raw?.story),
    status: readText(raw?.status) || 'active',
    profile_photo_url: readText(raw?.profile_photo_url ?? raw?.profilePhotoUrl),
    profilePhotoUrl: readText(raw?.profilePhotoUrl ?? raw?.profile_photo_url),
    coverImageUrl: readText(raw?.coverImageUrl ?? raw?.cover_image_url),
    coverUrl: readText(raw?.coverUrl ?? raw?.cover_url),
    theme: raw?.theme ?? {},
});

const toCreatePayload = (input: DropInput) => ({
    title: input.title.trim(),
    description: input.description?.trim() || null,
    artistId: input.artistId.trim(),
    handle: input.handle?.trim() || null,
    startsAt: input.startsAt?.trim() || null,
    endsAt: input.endsAt?.trim() || null,
    heroImageUrl: input.heroImageUrl?.trim() || null,
});

const toUpdatePayload = (input: DropUpdateInput) => {
    const payload: any = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.description !== undefined) payload.description = input.description?.trim() || null;
    if (input.artistId !== undefined) payload.artistId = input.artistId.trim();
    if (input.handle !== undefined) payload.handle = input.handle?.trim() || null;
    if (input.startsAt !== undefined) payload.startsAt = input.startsAt?.trim() || null;
    if (input.endsAt !== undefined) payload.endsAt = input.endsAt?.trim() || null;
    if (input.heroImageUrl !== undefined) payload.heroImageUrl = input.heroImageUrl?.trim() || null;
    return payload;
};

export async function getDrops(): Promise<DropDto[]> {
    const payload = await apiFetch('/drops');
    return readDropList(payload)
        .map(normalizeDrop)
        .filter((drop) => drop && drop.id && drop.title);
}

export async function getAdminDrops(): Promise<DropDto[]> {
    const payload = await apiFetch('/admin/drops');
    return readDropList(payload)
        .map(normalizeDrop)
        .filter((drop) => drop && drop.id && drop.title);
}

export async function getArtists(): Promise<ArtistDto[]> {
    const payload = await apiFetch('/artists');
    return readArtistList(payload)
        .map(normalizeArtist)
        .filter((artist) => artist && artist.id && artist.name);
}

export async function getDropById(id: string): Promise<DropDto> {
    const payload = await apiFetch(`/drops/${encodeURIComponent(id)}`);
    return normalizeDrop(readDropObject(payload));
}

export async function createDrop(input: DropInput): Promise<DropDto> {
    const payload = await apiFetch('/drops', {
        method: 'POST',
        body: JSON.stringify(toCreatePayload(input)),
    });
    return normalizeDrop(readDropObject(payload));
}

export async function updateDrop(id: string, input: DropUpdateInput): Promise<DropDto> {
    const payload = await apiFetch(`/drops/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(toUpdatePayload(input)),
    });
    return normalizeDrop(readDropObject(payload));
}

export async function deleteDrop(id: string): Promise<void> {
    await apiFetch(`/drops/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
