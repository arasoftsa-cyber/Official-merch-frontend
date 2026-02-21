import { VITE_API_BASE_URL } from '../_env';

export const getApiUrl = (path: string) =>
  `${VITE_API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

