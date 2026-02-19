import React, { useCallback, useState } from 'react';
import { Container, Page } from '../../ui/Page';
import { apiFetch } from '../../shared/api/http';

const defaultArtist = { handle: '', name: '', theme: '' };
const defaultLabel = { handle: '', name: '' };
const defaultLinkArtistUser = { artistId: '', userId: '' };
const defaultLinkLabelArtist = { labelId: '', artistId: '' };

const formClass = 'space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5';
const inputClass =
  'block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none';

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
  <section className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Admin</p>
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      {description && <p className="text-sm text-slate-400">{description}</p>}
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
        <Section title="Provisioning" description="Create artists, labels, and manage links.">
          <div className="space-y-4">
            <div className={formClass}>
              <p className="text-sm font-semibold text-white">Create artist</p>
              <input
                placeholder="Handle"
                className={inputClass}
                value={artist.handle}
                onChange={(event) => setArtist((prev) => ({ ...prev, handle: event.target.value }))}
              />
              <input
                placeholder="Name"
                className={inputClass}
                value={artist.name}
                onChange={(event) => setArtist((prev) => ({ ...prev, name: event.target.value }))}
              />
              <textarea
                placeholder="Theme JSON (optional)"
                className="block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
                rows={3}
                value={artist.theme}
                onChange={(event) => setArtist((prev) => ({ ...prev, theme: event.target.value }))}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => artistForm.run(handleArtistSubmit)}
                  disabled={artistForm.status === 'submitting'}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Create Artist
                </button>
                {artistForm.status === 'success' && <span className="text-sm text-emerald-300">Created</span>}
                {artistForm.error && <span className="text-sm text-rose-300">{artistForm.error}</span>}
              </div>
            </div>
            <div className={formClass}>
              <p className="text-sm font-semibold text-white">Create label</p>
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
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Create Label
                </button>
                {labelForm.status === 'success' && <span className="text-sm text-emerald-300">Created</span>}
                {labelForm.error && <span className="text-sm text-rose-300">{labelForm.error}</span>}
              </div>
            </div>
            <div className={formClass}>
              <p className="text-sm font-semibold text-white">Link artist ↔ user</p>
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
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Link Artist User
                </button>
                {linkArtistUserForm.status === 'success' && <span className="text-sm text-emerald-300">Linked</span>}
                {linkArtistUserForm.error && <span className="text-sm text-rose-300">{linkArtistUserForm.error}</span>}
              </div>
            </div>
            <div className={formClass}>
              <p className="text-sm font-semibold text-white">Link label ↔ artist</p>
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
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Link Label Artist
                </button>
                <button
                  type="button"
                  onClick={() => unlinkLabelArtistForm.run(handleUnlinkLabelArtistSubmit)}
                  disabled={unlinkLabelArtistForm.status === 'submitting'}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Unlink Label Artist
                </button>
                {linkLabelArtistForm.status === 'success' && <span className="text-sm text-emerald-300">Linked</span>}
                {unlinkLabelArtistForm.status === 'success' && <span className="text-sm text-amber-200">Unlinked</span>}
                {(linkLabelArtistForm.error || unlinkLabelArtistForm.error) && (
                  <span className="text-sm text-rose-300">
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
