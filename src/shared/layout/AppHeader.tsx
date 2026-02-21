import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearTokens, getAccessToken } from '../../shared/auth/tokenStore';
import { getMe } from '../../shared/api/appApi';

type AppHeaderProps = {
  variant?: 'public' | 'buyer';
};

const navItems = [
  { label: 'Artists', to: '/artists' },
  { label: 'Drops', to: '/drops' },
  { label: 'Products', to: '/products' },
];

function readCartCount(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  try {
    const raw = window.localStorage.getItem('om_cart_v1');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce((sum, item) => {
      const qty = Number(item?.quantity);
      if (!Number.isFinite(qty) || qty <= 0) return sum;
      return sum + qty;
    }, 0);
  } catch {
    return 0;
  }
}

export default function AppHeader({ variant = 'public' }: AppHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartCount, setCartCount] = useState<number>(readCartCount());
  const [loggedIn, setLoggedIn] = useState(Boolean(getAccessToken()));
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    const syncCount = () => setCartCount(readCartCount());
    syncCount();
    const onStorage = () => syncCount();
    window.addEventListener('storage', onStorage);
    const intervalId = window.setInterval(syncCount, 1000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setCartCount(readCartCount());
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const token = getAccessToken();
    setLoggedIn(Boolean(token));
    if (!token) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    let active = true;
    setRoleLoading(true);
    getMe()
      .then((me) => {
        if (!active) return;
        setRole(me?.role ?? me?.user?.role ?? null);
      })
      .catch(() => {
        if (active) setRole(null);
      })
      .finally(() => {
        if (active) setRoleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const handleLogout = () => {
    clearTokens();
    sessionStorage.clear();
    setLoggedIn(false);
    setRole(null);
    navigate('/', { replace: true });
  };

  const showMyAccount = loggedIn && !roleLoading;
  const actionPadding = variant === 'buyer' ? 'px-3 py-1.5' : 'px-3 py-1.5';
  const loginTarget = `/login?returnTo=${encodeURIComponent(
    `${location.pathname}${location.search}`
  )}`;

  return (
    <header className="border-b border-white/15 bg-black">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-semibold tracking-wide text-white">
          OfficialMerch
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className="text-sm text-slate-200 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/cart"
            aria-label="View cart"
            className={`hidden items-center gap-2 rounded-md border border-white/25 text-sm text-white hover:bg-white/10 md:inline-flex ${actionPadding}`}
          >
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-black">
                {cartCount}
              </span>
            )}
          </Link>

          {showMyAccount ? (
            <>
              <button
                type="button"
                aria-label="Logout"
                onClick={handleLogout}
                className={`hidden rounded-md border border-white/25 text-sm text-white hover:bg-white/10 md:inline-flex ${actionPadding}`}
              >
                Logout
              </button>
              <Link
                to="/fan"
                className={`hidden rounded-md border border-white/25 text-sm text-white hover:bg-white/10 md:inline-flex ${actionPadding}`}
              >
                My Account
              </Link>
            </>
          ) : (
            <Link
              to={loginTarget}
              className={`hidden rounded-md border border-white/25 text-sm text-white hover:bg-white/10 md:inline-flex ${actionPadding}`}
            >
              Login
            </Link>
          )}

          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex rounded-md border border-white/25 px-2.5 py-1.5 text-sm text-white hover:bg-white/10 md:hidden"
          >
            Menu
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-white/15 px-4 py-3 md:hidden" aria-label="Mobile">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className="text-sm text-slate-200 hover:text-white">
                {item.label}
              </Link>
            ))}
            <Link to="/cart" className="inline-flex w-fit items-center gap-2 text-sm text-slate-200 hover:text-white">
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-black">
                  {cartCount}
                </span>
              )}
            </Link>
            {showMyAccount ? (
              <>
                <button
                  type="button"
                  aria-label="Logout"
                  onClick={handleLogout}
                  className="mt-1 inline-flex w-fit rounded-md border border-white/25 px-3 py-1.5 text-sm text-white hover:bg-white/10"
                >
                  Logout
                </button>
                <Link
                  to="/fan"
                  className="inline-flex w-fit rounded-md border border-white/25 px-3 py-1.5 text-sm text-white hover:bg-white/10"
                >
                  My Account
                </Link>
              </>
            ) : (
              <Link
                to={loginTarget}
                className="mt-1 inline-flex w-fit rounded-md border border-white/25 px-3 py-1.5 text-sm text-white hover:bg-white/10"
              >
                Login
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
