import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../shared/api/http';
import { getAccessToken } from '../shared/auth/tokenStore';

type ApiResult = { status: 'PASS' | 'FAIL'; message: string; payload?: any };

export default function Smoke() {
  const [role, setRole] = useState<string | null>(null);
  const [whoamiResult, setWhoamiResult] = useState<ApiResult | null>(null);
  const [ordersResult, setOrdersResult] = useState<ApiResult | null>(null);
  const [metricsResult, setMetricsResult] = useState<ApiResult | null>(null);
  const [buyerOrderId, setBuyerOrderId] = useState('');
  const [adminOrderId, setAdminOrderId] = useState('');

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setRole(null);
      return;
    }
    apiFetch('/auth/whoami')
      .then((me) => {
        setRole(me?.role ?? (Array.isArray(me?.roles) ? me.roles[0] : null));
      })
      .catch(() => setRole(null));
  }, []);

  const runApi = async (
    url: string,
    label: 'whoami' | 'orders' | 'metrics',
    setter: React.Dispatch<React.SetStateAction<ApiResult | null>>
  ) => {
    try {
      const payload = await apiFetch(url);
      setter({ status: 'PASS', message: 'OK', payload });
    } catch (err: any) {
      setter({
        status: 'FAIL',
        message: err?.message ?? 'Request failed',
        payload: err,
      });
    }
  };

  return (
    <main>
      <h1>Smoke Checklist</h1>
      <section>
        <h2>Auth snapshot</h2>
        <p>Token present: {getAccessToken() ? 'yes' : 'no'}</p>
        <p>Role: {role ?? 'unknown'}</p>
        <Link to="/login">Login page</Link>
      </section>
      <section>
        <h2>Routes</h2>
        <ul>
          <li>
            <Link to="/products">Products</Link>
          </li>
          <li>
            <Link to="/buyer">Buyer dashboard</Link>
          </li>
          <li>
            <Link to={`/buyer/order/${buyerOrderId || 'order-id'}`}>Buyer order</Link>
            <input
              value={buyerOrderId}
              onChange={(event) => setBuyerOrderId(event.target.value)}
              placeholder="order id"
            />
          </li>
          <li>
            <Link to="/artist">Artist dashboard</Link>
          </li>
          <li>
            <Link to="/label">Label dashboard</Link>
          </li>
          <li>
            <Link to="/admin">Admin dashboard</Link>
          </li>
          <li>
            <Link to={`/admin/order/${adminOrderId || 'order-id'}`}>Admin order</Link>
            <input
              value={adminOrderId}
              onChange={(event) => setAdminOrderId(event.target.value)}
              placeholder="order id"
            />
          </li>
        </ul>
      </section>
      <section>
        <h2>API pings</h2>
        <div>
          <button type="button" onClick={() => runApi('/auth/whoami', 'whoami', setWhoamiResult)}>
            GET /auth/whoami
          </button>
          {whoamiResult && (
            <p>
              {whoamiResult.status}: {whoamiResult.message}
            </p>
          )}
          {whoamiResult?.payload && <pre>{JSON.stringify(whoamiResult.payload, null, 2)}</pre>}
        </div>
        <div>
          <button type="button" onClick={() => runApi('/orders', 'orders', setOrdersResult)}>
            GET /orders
          </button>
          {ordersResult && (
            <p>
              {ordersResult.status}: {ordersResult.message}
            </p>
          )}
          {ordersResult?.payload && <pre>{JSON.stringify(ordersResult.payload, null, 2)}</pre>}
        </div>
        <div>
          <button
            type="button"
            onClick={() => runApi('/admin/metrics', 'metrics', setMetricsResult)}
          >
            GET /admin/metrics
          </button>
          {metricsResult && (
            <p>
              {metricsResult.status}: {metricsResult.message}
            </p>
          )}
          {metricsResult?.payload && <pre>{JSON.stringify(metricsResult.payload, null, 2)}</pre>}
        </div>
      </section>
    </main>
  );
}
