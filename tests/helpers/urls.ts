import { getBrowserAppEnv } from '../_env';

export const getApiUrl = (path: string) =>
  `${getBrowserAppEnv().API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
