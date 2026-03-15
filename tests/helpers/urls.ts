import { API_BASE_URL } from '../_env';

export const getApiUrl = (path: string) =>
  `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
