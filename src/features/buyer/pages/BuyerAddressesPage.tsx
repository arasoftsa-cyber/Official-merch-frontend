import React, { useEffect, useMemo, useState } from 'react';
import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
  type AddressDto,
  type AddressInput,
} from '../../../shared/api/addressesApi';
import { Card } from '../../../shared/ui/Page';
import { useConfirm } from '../../../shared/ui/ConfirmService';
import { safeErrorMessage } from '../../../shared/utils/safeError';

const emptyForm: AddressInput = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  addressType: 'home',
  isDefault: false,
};

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/15 dark:bg-black/20 dark:text-white';

const labelClass =
  'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/60';

export default function BuyerAddressesPage() {
  const { confirm } = useConfirm();
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [form, setForm] = useState<AddressInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sortedAddresses = useMemo(
    () => [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    [addresses],
  );

  const loadAddresses = async () => {
    setLoading(true);
    setError(null);
    try {
      setAddresses(await getAddresses());
    } catch (err) {
      setError(safeErrorMessage(err) || 'Failed to load addresses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  const updateField = <Key extends keyof AddressInput>(
    key: Key,
    value: AddressInput[Key],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setMessage(null);
  };

  const validateForm = () => {
    if (!form.fullName.trim()) return 'Full name is required.';
    if (!form.phone.trim()) return 'Phone number is required.';
    if (!form.line1.trim()) return 'Address line 1 is required.';
    if (!form.city.trim()) return 'City is required.';
    if (!form.state.trim()) return 'State is required.';
    if (!form.postalCode.trim()) return 'Postal code is required.';
    if (!form.country.trim()) return 'Country is required.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (editingId) {
        const updatedAddresses = await updateAddress(editingId, form);
        setAddresses(updatedAddresses);
        setMessage('Address updated.');
      } else {
        const createdAddress = await createAddress(form);
        setAddresses((prev) => [createdAddress, ...prev]);
        setMessage('Address added.');
      }
      setForm(emptyForm);
      setEditingId(null);
      loadAddresses();
    } catch (err) {
      setError(safeErrorMessage(err) || 'Could not save address.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (address: AddressDto) => {
    setEditingId(address.id);
    setForm({
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'India',
      addressType: address.addressType || 'home',
      isDefault: address.isDefault,
    });
    setError(null);
    setMessage(null);
  };

  const handleDelete = async (address: AddressDto) => {
    const confirmed = await confirm({
      title: 'Delete address',
      message: `Delete address for ${address.fullName || 'this recipient'}?`,
      confirmText: 'Delete',
      cancelText: 'Keep',
      danger: true,
    });
    if (!confirmed) return;

    setDeletingId(address.id);
    setError(null);
    setMessage(null);
    try {
      await deleteAddress(address.id);
      setAddresses((prev) => prev.filter((entry) => entry.id !== address.id));
      if (editingId === address.id) resetForm();
      setMessage('Address deleted.');
    } catch (err) {
      setError(safeErrorMessage(err) || 'Could not delete address.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-white/60">
          Manage
        </p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
          Addresses
        </h1>
        <p className="text-sm text-slate-600 dark:text-white/70">
          Your saved shipping and billing destinations.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-4">
          {loading && (
            <Card className="p-8">
              <p className="text-sm text-slate-500 dark:text-white/50">
                Loading addresses...
              </p>
            </Card>
          )}

          {!loading && sortedAddresses.length === 0 && (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
              <p className="text-sm text-slate-500 dark:text-white/40">
                No addresses saved yet.
              </p>
              <p className="mt-2 text-xs text-slate-400 dark:text-white/30">
                Add one using the form.
              </p>
            </Card>
          )}

          {!loading &&
            sortedAddresses.map((address) => (
              <Card key={address.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {address.fullName || 'Unnamed recipient'}
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-white/70">
                        {address.addressType || 'home'}
                      </span>
                      {address.isDefault && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-white/70">
                      {address.phone}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-white/80">
                      {[address.line1, address.line2, address.landmark]
                        .filter(Boolean)
                        .join(', ')}
                      <br />
                      {[address.city, address.state, address.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                      <br />
                      {address.country}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(address)}
                      className="rounded-full border border-slate-300 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white dark:border-white/20 dark:text-white dark:hover:border-white dark:hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDelete(address);
                      }}
                      disabled={deletingId === address.id}
                      className="rounded-full border border-rose-300 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      {deletingId === address.id ? 'Deleting' : 'Delete'}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
        </div>

        <Card className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/50">
                  {editingId ? 'Edit' : 'Add'}
                </p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingId ? 'Update address' : 'New address'}
                </h2>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold uppercase tracking-widest text-slate-500 transition hover:text-slate-900 dark:text-white/50 dark:hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>

            <label className={labelClass}>
              Full name
              <input
                className={inputClass}
                value={form.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                placeholder="Recipient name"
              />
            </label>

            <label className={labelClass}>
              Phone
              <input
                className={inputClass}
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                placeholder="6294175525"
              />
            </label>

            <label className={labelClass}>
              Address line 1
              <input
                className={inputClass}
                value={form.line1}
                onChange={(event) => updateField('line1', event.target.value)}
                placeholder="Street, area, building"
              />
            </label>

            <label className={labelClass}>
              Address line 2
              <input
                className={inputClass}
                value={form.line2}
                onChange={(event) => updateField('line2', event.target.value)}
                placeholder="Apartment, suite, floor"
              />
            </label>

            <label className={labelClass}>
              Landmark
              <input
                className={inputClass}
                value={form.landmark}
                onChange={(event) => updateField('landmark', event.target.value)}
                placeholder="Near 206 foot bridge"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                City
                <input
                  className={inputClass}
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                  placeholder="Kolkata"
                />
              </label>
              <label className={labelClass}>
                State
                <input
                  className={inputClass}
                  value={form.state}
                  onChange={(event) => updateField('state', event.target.value)}
                  placeholder="West Bengal"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Postal code
                <input
                  className={inputClass}
                  value={form.postalCode}
                  onChange={(event) => updateField('postalCode', event.target.value)}
                  placeholder="700102"
                />
              </label>
              <label className={labelClass}>
                Country
                <input
                  className={inputClass}
                  value={form.country}
                  onChange={(event) => updateField('country', event.target.value)}
                  placeholder="India"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Address type
                <select
                  className={inputClass}
                  value={form.addressType}
                  onChange={(event) => updateField('addressType', event.target.value)}
                >
                  <option value="home">Home</option>
                  <option value="work">Work</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="flex items-center gap-3 pt-7 text-sm font-semibold text-slate-700 dark:text-white/80">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) => updateField('isDefault', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Set as default
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-slate-900 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-slate-200"
            >
              {saving ? 'Saving...' : editingId ? 'Update address' : 'Add address'}
            </button>
          </form>
        </Card>
      </div>
    </section>
  );
}
