import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearTokens } from '../shared/auth/tokenStore';
import { logoutAuth } from '../lib/api/auth';

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await logoutAuth();
      } catch {
        // Ignore logout API errors and clear local state regardless.
      } finally {
        clearTokens();
        sessionStorage.clear();
        navigate('/', { replace: true });
      }
    })();
  }, [navigate]);

  return null;
}
