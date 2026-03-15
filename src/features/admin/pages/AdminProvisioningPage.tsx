import React, { useCallback, useState } from 'react';
import { Container, Page } from '../../../shared/ui/Page';
import { apiFetch } from '../../../shared/api/http';

const defaultArtist = { handle: '', name: '', theme: '' };
const defaultLabel = { handle: '', name: '' };
const defaultLinkArtistUser = { artistId: '', userId: '' };
const defaultLinkLabelArtist = { labelId: '', artistId: '' };

const formClass = 'space-y-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 shadow-sm';
const inputClass =
  'block w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none transition';

const useFormLoader = () => {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<void>) => {
    setStatus('submitting');
    setError(null);
    try {
      await fn();
      setStatus('success');
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error');
      setStatus('idle');
    }
  }, []);
  return { status, error, run };
};

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/70 p-5 shadow-sm">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Admin Control</p>
      <h2 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h2>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    {children}
  </section>
);

export default function AdminProvisioningPage() {
  const [artist, setArtist] = useState(defaultArtist);
  const [label, setLabel] = useState(defaultLabel);
  const [linkArtistUser, setLinkArtistUser] = useState(defaultLinkArtistUser);
  const [linkLabelArtist, setLinkLabelArtist] = useState(defaultLinkLabelArtist);

  const artistForm = useFormLoader();
  const labelForm = useFormLoader();
  const linkArtistUserForm = useFormLoader();
  const linkLabelArtistForm = useFormLoader();
  const unlinkLabelArtistForm = useFormLoader();

  const handleArtistSubmit = useCallback(async () => {
    await apiFetch('/api/admin/provisioning/create-artist', {
      method: 'POST',
      body: {
        handle: artist.handle.trim(),
        name: artist.name.trim(),
        theme: artist.theme ? JSON.parse(artist.theme) : {},
      },
    });
    setArtist(defaultArtist);
  }, [artist]);

  const handleLabelSubmit = useCallback(async () => {
    await apiFetch('/api/admin/provisioning/create-label', {
      method: 'POST',
      body: {
        handle: label.handle.trim(),
        name: label.name.trim(),
      },
    });
    setLabel(defaultLabel);
  }, [label]);

  const handleLinkArtistUserSubmit = useCallback(async () => {
    await apiFetch('/api/admin/provisioning/link-artist-user', {
      method: 'POST',
      body: {
        artistId: linkArtistUser.artistId.trim(),
        userId: linkArtistUser.userId.trim(),
      },
    });
    setLinkArtistUser(defaultLinkArtistUser);
  }, [linkArtistUser]);

  const handleLinkLabelArtistSubmit = useCallback(async () => {
    await apiFetch('/api/admin/provisioning/link-label-artist', {
      method: 'POST',
      body: {
        labelId: linkLabelArtist.labelId.trim(),
        artistId: linkLabelArtist.artistId.trim(),
      },
    });
    setLinkLabelArtist(defaultLinkLabelArtist);
  }, [linkLabelArtist]);

  const handleUnlinkLabelArtistSubmit = useCallback(async () => {
    await apiFetch('/api/admin/provisioning/unlink-label-artist', {
      method: 'DELETE',
      body: {
        labelId: linkLabelArtist.labelId.trim(),
        artistId: linkLabelArtist.artistId.trim(),
      },
    });
  }, [linkLabelArtist]);

  return (
    <Page>
      <Container className="space-y-6">
        <Section title="Provisioning" description="Create artists, labels, and manage links between entities.">
          <div className="space-y-4">
            <div className={formClass}>
              <p className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Create artist</p>
              <input
                placeholder="Handle (e.g. artistname)"
                className={inputClass}
                value={artist.handle}
                onChange={(event) => setArtist((prev) => ({ ...prev, handle: event.target.value }))}
              />
              <input
                placeholder="Display Name"
                className={inputClass}
                value={artist.name}
                onChange={(event) => setArtist((prev) => ({ ...prev, name: event.target.value }))}
              />
              <textarea
                placeholder="Theme JSON (optional)"
                className="block w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none transition"
                rows={3}
                value={artist.theme}
                onChange={(event) => setArtist((prev) => ({ ...prev, theme: event.target.value }))}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => artistForm.run(handleArtistSubmit)}
                  disabled={artistForm.status === 'submitting'}
                  className="rounded-full bg-slate-900 dark:bg-white px-6 py-2 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Create Artist
                </button>
                {artistForm.status === 'success' && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest animate-pulse">Created</span>}
                {artistForm.error && <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{artistForm.error}</span>}
              </div>
            </div>

            <div className={formClass}>
              <p className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Create label</p>
              <input
                placeholder="Handle"
                className={inputClass}
                value={label.handle}
                onChange={(event) => setLabel((prev) => ({ ...prev, handle: event.target.value }))}
              />
              <input
                placeholder="Name"
                className={inputClass}
                value={label.name}
                onChange={(event) => setLabel((prev) => ({ ...prev, name: event.target.value }))}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => labelForm.run(handleLabelSubmit)}
                  disabled={labelForm.status === 'submitting'}
                  className="rounded-full bg-slate-900 dark:bg-white px-6 py-2 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Create Label
                </button>
                {labelForm.status === 'success' && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest animate-pulse">Created</span>}
                {labelForm.error && <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{labelForm.error}</span>}
              </div>
            </div>

            <div className={formClass}>
                <p className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Link artist to user</p>
              <input
                placeholder="Artist ID"
                className={inputClass}
                value={linkArtistUser.artistId}
                onChange={(event) => setLinkArtistUser((prev) => ({ ...prev, artistId: event.target.value }))}
              />
              <input
                placeholder="User ID"
                className={inputClass}
                value={linkArtistUser.userId}
                onChange={(event) => setLinkArtistUser((prev) => ({ ...prev, userId: event.target.value }))}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => linkArtistUserForm.run(handleLinkArtistUserSubmit)}
                  disabled={linkArtistUserForm.status === 'submitting'}
                  className="rounded-full bg-slate-900 dark:bg-white px-6 py-2 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Link Artist User
                </button>
                {linkArtistUserForm.status === 'success' && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest animate-pulse">Linked</span>}
                {linkArtistUserForm.error && <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{linkArtistUserForm.error}</span>}
              </div>
            </div>

            <div className={formClass}>
                <p className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Link label to artist</p>
              <input
                placeholder="Label ID"
                className={inputClass}
                value={linkLabelArtist.labelId}
                onChange={(event) => setLinkLabelArtist((prev) => ({ ...prev, labelId: event.target.value }))}
              />
              <input
                placeholder="Artist ID"
                className={inputClass}
                value={linkLabelArtist.artistId}
                onChange={(event) => setLinkLabelArtist((prev) => ({ ...prev, artistId: event.target.value }))}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => linkLabelArtistForm.run(handleLinkLabelArtistSubmit)}
                  disabled={linkLabelArtistForm.status === 'submitting'}
                  className="rounded-full bg-slate-900 dark:bg-white px-6 py-2 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Link Label Artist
                </button>
                <button
                  type="button"
                  onClick={() => unlinkLabelArtistForm.run(handleUnlinkLabelArtistSubmit)}
                  disabled={unlinkLabelArtistForm.status === 'submitting'}
                  className="rounded-full border border-slate-200 dark:border-white/20 bg-white dark:bg-transparent px-6 py-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white hover:border-slate-900 dark:hover:border-white transition-all disabled:opacity-50"
                >
                  Unlink Label Artist
                </button>
                {linkLabelArtistForm.status === 'success' && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest animate-pulse">Linked</span>}
                {unlinkLabelArtistForm.status === 'success' && <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest animate-pulse">Unlinked</span>}
                {(linkLabelArtistForm.error || unlinkLabelArtistForm.error) && (
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                    {linkLabelArtistForm.error || unlinkLabelArtistForm.error}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Section>
      </Container>
    </Page>
  );
}
