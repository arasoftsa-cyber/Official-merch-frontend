type ApiContractError = Error & {
  code: 'api_contract_error';
  domain: string;
};

export const createApiContractError = (domain: string, message: string): ApiContractError => {
  const error = new Error(message) as ApiContractError;
  error.name = 'ApiContractError';
  error.code = 'api_contract_error';
  error.domain = domain;
  return error;
};

export const expectRecord = (
  value: unknown,
  domain: string,
  message: string
): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createApiContractError(domain, message);
  }
  return value as Record<string, any>;
};

export const readObjectEnvelope = (
  payload: unknown,
  key: string,
  domain: string,
  options: { allowDirect?: boolean; legacyKey?: string } = {}
): Record<string, any> => {
  const { allowDirect = true, legacyKey } = options;
  const source = expectRecord(payload, domain, `${domain} response must be an object.`);
  const candidate = source[key];
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as Record<string, any>;
  }

  if (legacyKey) {
    const legacyCandidate = source[legacyKey];
    if (legacyCandidate && typeof legacyCandidate === 'object' && !Array.isArray(legacyCandidate)) {
      return legacyCandidate as Record<string, any>;
    }
  }

  if (allowDirect) {
    return source;
  }

  throw createApiContractError(domain, `${domain} response is missing the "${key}" object.`);
};

export const readArrayEnvelope = (
  payload: unknown,
  key: string,
  domain: string,
  options: { allowDirectArray?: boolean; legacyKey?: string } = {}
): any[] => {
  const { allowDirectArray = false, legacyKey } = options;
  if (allowDirectArray && Array.isArray(payload)) {
    return payload;
  }

  const source = expectRecord(payload, domain, `${domain} response must be an object.`);
  if (Array.isArray(source[key])) {
    return source[key];
  }
  if (legacyKey && Array.isArray(source[legacyKey])) {
    return source[legacyKey];
  }

  throw createApiContractError(domain, `${domain} response is missing the "${key}" array.`);
};
