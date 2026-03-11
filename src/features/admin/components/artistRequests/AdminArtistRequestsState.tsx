import React from 'react';
import LoadingSkeleton from '../../../../shared/components/ux/LoadingSkeleton';
import { Container, Page } from '../../../../shared/ui/Page';
import AdminArtistRequestsIntro from './AdminArtistRequestsIntro';

type AdminArtistRequestsStateProps = {
  mode: 'auth' | 'loading';
};

export default function AdminArtistRequestsState({ mode }: AdminArtistRequestsStateProps) {
  return (
    <Page>
      <Container className="space-y-3">
        <AdminArtistRequestsIntro />
        {mode === 'auth' ? (
          <p className="text-slate-600 dark:text-slate-400">Authentication required.</p>
        ) : (
          <LoadingSkeleton count={3} />
        )}
      </Container>
    </Page>
  );
}
