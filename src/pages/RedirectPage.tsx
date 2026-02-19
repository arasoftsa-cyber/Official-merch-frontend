import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function RedirectPage({ to }: { to: string }) {
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    let target = to;
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        target = target.replace(`:${key}`, value);
      }
    });
    navigate(target, { replace: true });
  }, [navigate, to, params]);

  return null;
}
