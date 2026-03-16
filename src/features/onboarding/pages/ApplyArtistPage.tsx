import React, { useEffect } from 'react';
import ArtistAccessRequestForm from '../components/ArtistAccessRequestForm';
import { Container, Page } from '../../../shared/ui/Page';

export default function ApplyArtistPage() {
  useEffect(() => {
    document.title = 'Artist Request';
  }, []);

  return (
    <Page>
      <Container className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Apply</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Artist Request</h1>
        </div>
        <ArtistAccessRequestForm />
      </Container>
    </Page>
  );
}
