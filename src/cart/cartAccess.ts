import { useEffect, useState } from 'react';
import {
  AUTH_SESSION_UPDATED_EVENT,
  getAccessToken,
  getRefreshToken,
  getSessionUser,
} from '../shared/auth/tokenStore';
import { normalizeRole } from '../shared/auth/routingPolicy';

const CART_ALLOWED_ROLES = new Set(['buyer', 'fan', 'customer']);

export type CartAccessState = {
  isAuthenticated: boolean;
  role: string | null;
  canUseCart: boolean;
};

export function isCartAllowedRole(role: string | null | undefined): boolean {
  const normalizedRole = normalizeRole(role);
  return Boolean(normalizedRole && CART_ALLOWED_ROLES.has(normalizedRole));
}

export function getCartAccessState(): CartAccessState {
  const user = getSessionUser();
  const role = normalizeRole(user?.role);
  const isAuthenticated = Boolean(getAccessToken() || getRefreshToken() || user);

  return {
    isAuthenticated,
    role,
    canUseCart: isAuthenticated && isCartAllowedRole(role),
  };
}

export function useCartAccessState(): CartAccessState {
  const [state, setState] = useState<CartAccessState>(() => getCartAccessState());

  useEffect(() => {
    const syncState = () => {
      setState(getCartAccessState());
    };

    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, syncState);
    return () => {
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, syncState);
    };
  }, []);

  return state;
}
