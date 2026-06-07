import { apiFetch } from './http';

export type AddressDto = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  addressType: string;
  isDefault: boolean;
};

export type AddressInput = Omit<AddressDto, 'id'>;

const readText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const readAddressList = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.addresses)) return payload.addresses;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const readAddressObject = (payload: any): any => {
  if (payload?.address && typeof payload.address === 'object') return payload.address;
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
};

export const normalizeAddress = (raw: any): AddressDto => ({
  id: readText(raw?.id ?? raw?.addressId ?? raw?._id),
  fullName: readText(raw?.fullName ?? raw?.name ?? raw?.recipientName),
  phone: readText(raw?.phone ?? raw?.phoneNumber ?? raw?.mobile),
  line1: readText(raw?.line1 ?? raw?.addressLine1 ?? raw?.address1 ?? raw?.street1),
  line2: readText(raw?.line2 ?? raw?.addressLine2 ?? raw?.address2 ?? raw?.street2),
  landmark: readText(raw?.landmark),
  city: readText(raw?.city),
  state: readText(raw?.state ?? raw?.province ?? raw?.region),
  postalCode: readText(raw?.postalCode ?? raw?.zipCode ?? raw?.zip ?? raw?.pincode),
  country: readText(raw?.country) || 'India',
  addressType: readText(raw?.addressType ?? raw?.type ?? raw?.kind) || 'home',
  isDefault: Boolean(raw?.isDefault ?? raw?.default ?? raw?.defaultAddress),
});

const toApiPayload = (input: AddressInput) => ({
  fullName: input.fullName.trim(),
  phone: input.phone.trim(),
  line1: input.line1.trim(),
  line2: input.line2.trim(),
  landmark: input.landmark.trim(),
  city: input.city.trim(),
  state: input.state.trim(),
  postalCode: input.postalCode.trim(),
  country: input.country.trim(),
  addressType: input.addressType.trim() || 'home',
  isDefault: input.isDefault,
});

export async function getAddresses(): Promise<AddressDto[]> {
  const payload = await apiFetch('/addresses');
  return readAddressList(payload).map(normalizeAddress).filter((address) => address.id);
}

export async function createAddress(input: AddressInput): Promise<AddressDto> {
  const payload = await apiFetch('/addresses', {
    method: 'POST',
    body: toApiPayload(input),
  });
  return normalizeAddress(readAddressObject(payload));
}

export async function updateAddress(id: string, input: AddressInput): Promise<AddressDto[]> {
  const payload = await apiFetch(`/addresses/${id}`, {
    method: 'PATCH',
    body: toApiPayload(input),
  });
  const addresses = readAddressList(payload);
  if (addresses.length > 0) {
    return addresses.map(normalizeAddress).filter((address) => address.id);
  }
  return [normalizeAddress(readAddressObject(payload))].filter((address) => address.id);
}

export async function deleteAddress(id: string): Promise<void> {
  await apiFetch(`/addresses/${id}`, { method: 'DELETE' });
}
