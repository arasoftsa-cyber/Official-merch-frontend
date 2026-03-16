import { resolveMediaUrl } from '../shared/utils/media';
import { createApiContractError, readArrayEnvelope, readObjectEnvelope } from '../shared/api/contract';

export type DropData = {
  id: string;
  handle: string;
  title: string;
  description?: string;
  heroImageUrl?: string | null;
  quizJson?: {
    title?: string;
    questions?: QuizQuestion[];
  } | null;
};

export type ProductCard = {
  id: string;
  title: string;
};

export type QuizQuestion = {
  id: string;
  type: 'single_choice' | 'text';
  prompt: string;
  options?: string[];
  required?: boolean;
};

export const formatDropTitle = (drop?: DropData) => drop?.title ?? 'Drop';
const DROP_PAGE_DOMAIN = 'catalog.drop';

export const parseDropPayload = (payload: unknown): DropData => {
  const source = readObjectEnvelope(payload, 'drop', DROP_PAGE_DOMAIN, { allowDirect: false });
  const id = String(source.id ?? '').trim();
  const handle = String(source.handle ?? '').trim();
  const title = String(source.title ?? '').trim();

  if (!id || !handle || !title) {
    throw createApiContractError(
      DROP_PAGE_DOMAIN,
      'Drop response is missing canonical id, handle, or title fields.'
    );
  }

  return {
    id,
    handle,
    title,
    description: typeof source.description === 'string' ? source.description : undefined,
    heroImageUrl: resolveMediaUrl(
      typeof source.heroImageUrl === 'string'
        ? source.heroImageUrl
        : typeof source.coverUrl === 'string'
          ? source.coverUrl
          : null
    ),
    quizJson: source.quizJson ?? source.quiz_json ?? null,
  };
};

export const parseDropProductsPayload = (payload: unknown): ProductCard[] =>
  readArrayEnvelope(payload, 'items', `${DROP_PAGE_DOMAIN}.products`)
    .map((entry: any) => ({
      id: entry?.id,
      title:
        (typeof entry?.title === 'string' && entry.title.trim()) ||
        'Untitled product',
    }))
    .filter((item): item is ProductCard => Boolean(item.id));
