import React from 'react';

type PublicCatalogGridProps = {
  children: React.ReactNode;
};

export default function PublicCatalogGrid({ children }: PublicCatalogGridProps) {
  return (
    <div
      data-testid="public-catalog-grid"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {children}
    </div>
  );
}
