import React from 'react';
import { Link } from 'react-router-dom';

const footerLinks = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
  { label: 'Apply as Artist', to: '/apply/artist' },
];

const socialLinks = [
  { label: 'Instagram', href: '#' },
  { label: 'YouTube', href: '#' },
  { label: 'X', href: '#' },
];

export default function BlackFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-8 px-4 py-8 md:grid-cols-3 md:px-6">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Navigate</p>
          <div className="flex flex-col gap-2">
            {footerLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-white/90 transition dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Social</p>
          <div className="flex flex-col gap-2">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                aria-label={`${link.label} (placeholder)`}
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-white/80 transition dark:hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Legal</p>
          <p className="text-sm text-slate-500 dark:text-white/80">© OfficialMerch.in. All rights reserved.</p>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <a href="#" className="text-slate-500 hover:text-slate-700 dark:text-white/70 transition dark:hover:text-white">
              Privacy
            </a>
            <span className="text-slate-300 dark:text-white/30">•</span>
            <a href="#" className="text-slate-500 hover:text-slate-700 dark:text-white/70 transition dark:hover:text-white">
              Terms
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-white/10 px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-500 md:px-6">
        OfficialMerch
      </div>
    </footer>
  );
}
