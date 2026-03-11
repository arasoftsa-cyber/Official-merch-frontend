import React from 'react';
import type { AdminArtistSubscription } from '../../hooks/useAdminArtistSubscription';
import AdminSectionSurface from '../shared/AdminSectionSurface';
import {
  ADVANCED_PAYMENT_MODE_OPTIONS,
  SUBSCRIPTION_STATUS_OPTIONS,
  toDateOnly,
  toText,
  toTitleCase,
  type SubscriptionFormState,
} from './types';

type ArtistSubscriptionSectionProps = {
  subscription: AdminArtistSubscription | null;
  subscriptionLoading: boolean;
  subscriptionLoadError: string | null;
  subscriptionForm: SubscriptionFormState;
  setSubscriptionForm: React.Dispatch<React.SetStateAction<SubscriptionFormState>>;
  subscriptionFieldErrors: Record<string, string>;
  subscriptionSaveError: string | null;
  saving: boolean;
  isAdvancedSubscription: boolean;
  focusOnPointerDown: (
    event: React.MouseEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>
  ) => void;
};

export default function ArtistSubscriptionSection({
  subscription,
  subscriptionLoading,
  subscriptionLoadError,
  subscriptionForm,
  setSubscriptionForm,
  subscriptionFieldErrors,
  subscriptionSaveError,
  saving,
  isAdvancedSubscription,
  focusOnPointerDown,
}: ArtistSubscriptionSectionProps) {
  return (
    <AdminSectionSurface as="fieldset">
      <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <span className="w-1 h-3 bg-indigo-500 dark:bg-emerald-500 rounded-full"></span>
        Subscription
      </legend>
      {subscriptionLoading && (
        <p className="text-sm text-slate-500 dark:text-slate-300 animate-pulse">
          Loading subscription...
        </p>
      )}
      {!subscriptionLoading && subscriptionLoadError && (
        <p className="text-sm text-rose-600 dark:text-rose-300 font-medium">{subscriptionLoadError}</p>
      )}
      {!subscriptionLoading && !subscriptionLoadError && !subscription && (
        <p className="text-sm text-slate-500 dark:text-slate-400 italic">No active subscription</p>
      )}
      {!subscriptionLoading && !subscriptionLoadError && subscription && (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Requested Plan
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {toTitleCase(subscription.requestedPlanType)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Approved Plan
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {toTitleCase(subscription.approvedPlanType)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Start Date
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {toDateOnly(subscription.startDate) || '-'}
            </p>
          </div>

          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Subscription Status
            <select
              value={subscriptionForm.status}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({ ...prev, status: event.target.value }))
              }
              onMouseDown={focusOnPointerDown}
              disabled={saving}
              className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition appearance-none cursor-pointer"
            >
              {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option} className="dark:bg-slate-900">
                  {option}
                </option>
              ))}
            </select>
            {subscriptionFieldErrors.status && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                {subscriptionFieldErrors.status}
              </p>
            )}
          </label>

          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            End Date
            <input
              type="date"
              value={subscriptionForm.endDate}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({ ...prev, endDate: event.target.value }))
              }
              disabled={saving}
              className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition"
            />
            {subscriptionFieldErrors.endDate && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                {subscriptionFieldErrors.endDate}
              </p>
            )}
          </label>

          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Payment Mode
            <select
              value={isAdvancedSubscription ? subscriptionForm.paymentMode : 'NA'}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({ ...prev, paymentMode: event.target.value }))
              }
              onMouseDown={focusOnPointerDown}
              disabled={!isAdvancedSubscription || saving}
              className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition appearance-none cursor-pointer disabled:bg-slate-100 dark:disabled:bg-black/30 disabled:text-slate-400 dark:disabled:text-slate-500"
            >
              {isAdvancedSubscription ? (
                <>
                  <option value="">Select payment mode</option>
                  {ADVANCED_PAYMENT_MODE_OPTIONS.map((option) => (
                    <option key={option} value={option} className="dark:bg-slate-900">
                      {option}
                    </option>
                  ))}
                </>
              ) : (
                <option value="NA">NA</option>
              )}
            </select>
            {subscriptionFieldErrors.paymentMode && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                {subscriptionFieldErrors.paymentMode}
              </p>
            )}
          </label>

          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Transaction ID
            <input
              value={isAdvancedSubscription ? subscriptionForm.transactionId : 'NA'}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({ ...prev, transactionId: event.target.value }))
              }
              disabled={!isAdvancedSubscription || saving}
              className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition disabled:bg-slate-100 dark:disabled:bg-black/30 disabled:text-slate-400 dark:disabled:text-slate-500"
            />
            {subscriptionFieldErrors.transactionId && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                {subscriptionFieldErrors.transactionId}
              </p>
            )}
          </label>
        </div>
      )}
      {subscriptionSaveError && (
        <p className="mt-4 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20">
          {subscriptionSaveError}
        </p>
      )}
    </AdminSectionSurface>
  );
}
