import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken, getSessionUser } from '../../../../shared/auth/tokenStore';
import {
  resolvePartnerEntryRedirect,
  resolveRoleFromAuthPayload,
} from '../../../../shared/auth/routingPolicy';

export default function PartnerEntryRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    (async () => {
      const token = getAccessToken();
      const sessionUser = getSessionUser();
      if (!token && !sessionUser) {
        navigate('/', { replace: true });
        return;
      }

      try {
        const role = resolveRoleFromAuthPayload(sessionUser);
        const target = resolvePartnerEntryRedirect(role, '/');
        if (!active) return;
        navigate(target, { replace: true });
      } catch {
        if (!active) return;
        navigate('/', { replace: true });
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  return <div>Redirecting...</div>;
}
