import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../../../../shared/api/appApi';
import { getAccessToken } from '../../../../shared/auth/tokenStore';
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
      if (!token) {
        navigate('/', { replace: true });
        return;
      }

      try {
        const me = await getMe();
        if (!active) return;
        const role = resolveRoleFromAuthPayload(me);
        const target = resolvePartnerEntryRedirect(role, '/');
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
