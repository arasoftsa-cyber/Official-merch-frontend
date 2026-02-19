import React from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main>
      <h1>Not Found</h1>
      <p>We couldn't find that page.</p>
      <Link to="/">Return Home</Link>
    </main>
  );
}

export function ForbiddenPage() {
  return (
    <main>
      <h1>Forbidden</h1>
      <p>You don't have access to that area.</p>
      <Link to="/">Return Home</Link>
    </main>
  );
}

export function ErrorPage({ message }: { message?: string }) {
  return (
    <main>
      <h1>Error</h1>
      <p>{message ?? 'An error occurred.'}</p>
      <Link to="/">Return Home</Link>
    </main>
  );
}
