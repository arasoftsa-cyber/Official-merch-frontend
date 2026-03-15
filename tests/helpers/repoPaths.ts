import { dirname, resolve } from 'path';

export const resolveFrontendPathFromTest = (testFilePath: string, ...segments: string[]) =>
  resolve(dirname(testFilePath), '..', '..', ...segments);
