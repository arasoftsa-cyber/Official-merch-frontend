import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearTokens } from '../shared/auth/tokenStore';

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    clearTokens();
    sessionStorage.clear();
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
