import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../../shared/api/appApi';
import { getAccessToken } from '../../shared/auth/tokenStore';

function resolveRole(payload: any): string {
  const role =
    payload?.role ||
    (Array.isArray(payload?.roles) ? payload.roles[0] : null) ||
    payload?.user?.role ||
    null;
  return String(role || '').toLowerCase();
}

export default function PartnerEntryRedirect() {
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
        const role = resolveRole(me);

        if (role === 'admin') {
          navigate('/partner/admin', { replace: true });
          return;
        }
        if (role === 'artist') {
          navigate('/partner/artist', { replace: true });
          return;
        }
        if (role === 'label') {
          navigate('/partner/label', { replace: true });
          return;
        }
        navigate('/', { replace: true });
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
