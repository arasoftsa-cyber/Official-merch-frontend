import React from 'react';

type AdminSectionSurfaceProps = {
  as?: 'section' | 'fieldset' | 'div';
  className?: string;
  children: React.ReactNode;
};

export const ADMIN_SECTION_SURFACE_CLASS =
  'rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-5';

export default function AdminSectionSurface({
  as = 'section',
  className = '',
  children,
}: AdminSectionSurfaceProps) {
  const Component = as;
  const mergedClassName = className
    ? `${ADMIN_SECTION_SURFACE_CLASS} ${className}`
    : ADMIN_SECTION_SURFACE_CLASS;
  return <Component className={mergedClassName}>{children}</Component>;
}
