import { getApiUrl } from './urls';

export { getApiUrl };

export const readResponseSnippet = async (response: any) =>
  (await response.text().catch(() => '<unavailable>')).replace(/\s+/g, ' ').trim().slice(0, 600);

export const assertOkResponse = async (response: any, context: string) => {
  if (response?.ok?.()) return;
  const status = Number(response?.status?.() ?? 0);
  const body = await readResponseSnippet(response);
  throw new Error(`${context} failed (${status}): ${body}`);
};
