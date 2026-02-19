import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchJson } from '../shared/api';
import EmptyState from '../components/ux/EmptyState';
import ErrorBanner from '../components/ux/ErrorBanner';
import LoadingSkeleton from '../components/ux/LoadingSkeleton';
import { useToast } from '../components/ux/ToastHost';
import { trackEvent, trackPageView } from '../shared/telemetry';
import { NotFoundPage } from './Errors';

type DropData = {
  id: string;
  handle: string;
  title: string;
  description?: string;
  heroImageUrl?: string;
  quizJson?: {
    title?: string;
    questions?: QuizQuestion[];
  } | null;
};

type ProductCard = {
  id: string;
  title: string;
};

type DropProductItemDTO = {
  id?: string;
  productId?: string;
  sku?: string;
  title?: string;
  name?: string;
};

type DropProductsResponse = {
  items?: DropProductItemDTO[];
};

type QuizQuestion = {
  id: string;
  type: 'single_choice' | 'text';
  prompt: string;
  options?: string[];
  required?: boolean;
};

type QuizState = 'idle' | 'quiz' | 'leadCapture' | 'submitted';

const formatDropTitle = (drop?: DropData) => drop?.title ?? 'Drop';

export default function DropPage() {
  const { handle } = useParams<{ handle: string }>();
  const toast = useToast();
  const [drop, setDrop] = useState<DropData | null>(null);
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [productsStatus, setProductsStatus] = useState<'loading' | 'idle'>('loading');
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizMessage, setQuizMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadDrop = useCallback(async () => {
    if (!handle) return;
    setStatus('loading');
    setError(null);
    setNotFound(false);
    try {
      const payload = await fetchJson<{ drop?: any }>(`/drops/${handle}`);
      if (!payload?.drop) {
        throw new Error('Drop not found');
      }
      setDrop({
        id: payload.drop.id,
        handle: payload.drop.handle,
        title: payload.drop.title,
        description: payload.drop.description,
        heroImageUrl: payload.drop.heroImageUrl ?? payload.drop.hero_image_url,
        quizJson: payload.drop.quizJson ?? payload.drop.quiz_json ?? null,
      });
      setStatus('idle');
    } catch (err: any) {
      if (err?.status === 404 || err?.message === 'Drop not found') {
        setNotFound(true);
        setStatus('idle');
        return;
      }
      setError(err?.message ?? 'Failed to load drop');
      setStatus('error');
    }
  }, [handle]);

  const loadProducts = useCallback(async (dropHandle?: string) => {
    if (!dropHandle) return;
    setProductsStatus('loading');
    try {
      const payload = await fetchJson<DropProductsResponse>(`/drops/${dropHandle}/products`);
      const mapped = Array.isArray(payload?.items)
        ? payload.items
            .map((entry) => ({
              id: entry?.id ?? entry?.productId ?? entry?.sku,
              title:
                (typeof entry?.title === 'string' && entry.title.trim()) ||
                (typeof entry?.name === 'string' && entry.name.trim()) ||
                'Untitled product',
            }))
            .filter((item): item is ProductCard => Boolean(item.id))
        : [];
      setProducts(mapped);
    } catch {
      setProducts([]);
    } finally {
      setProductsStatus('idle');
    }
  }, []);

  useEffect(() => {
    loadDrop();
  }, [loadDrop]);

  if (notFound) {
    return <NotFoundPage />;
  }

  useEffect(() => {
    if (drop) {
      trackPageView('Drop');
    }
  }, [drop]);

  useEffect(() => {
    if (drop?.handle) {
      loadProducts(drop.handle);
    }
  }, [drop, loadProducts]);

  const quizQuestions = useMemo<QuizQuestion[]>(
    () =>
      Array.isArray(drop?.quizJson?.questions)
        ? drop.quizJson.questions.filter(
            (question): question is QuizQuestion =>
              Boolean(question?.id && question?.prompt && question?.type)
          )
        : [],
    [drop]
  );

  const startQuiz = () => {
    trackEvent('Quiz Started', { dropId: drop?.id });
    setQuizState('quiz');
    setQuizError(null);
      setQuizMessage("We will contact you if you win.");
    setQuizAnswers({});
  };

  const continueToLeadForm = () => {
    const missingRequired = quizQuestions.find((question) => {
      if (!question.required) return false;
      const value = quizAnswers[question.id];
      return !value || !String(value).trim();
    });
    if (missingRequired) {
      setQuizError(`Please answer: ${missingRequired.prompt}`);
      return;
    }
    setQuizError(null);
    setQuizState('leadCapture');
  };

  const submitQuiz = async () => {
    if (!drop) return;
    if (quizState === 'submitted') return;
    const trimmedName = leadName.trim();
    const trimmedEmail = leadEmail.trim();
    const trimmedPhone = leadPhone.trim();

    if (!trimmedName) {
      setQuizError('Name is required.');
      return;
    }
    if (!trimmedEmail && !trimmedPhone) {
      setQuizError('Provide at least an email or phone number.');
      return;
    }

    setQuizLoading(true);
    setQuizError(null);
    try {
      const leadResponse = await fetchJson<{ id?: string; createdAt?: string }>('/leads', {
        method: 'POST',
        body: {
          source: 'drop_quiz',
          dropHandle: drop.handle,
          drop_handle: drop.handle,
          name: trimmedName,
          phone: trimmedPhone || null,
          email: trimmedEmail || null,
          dropId: drop.id,
          answers_json: { dropId: drop.id, answers: quizAnswers },
          answers: { dropId: drop.id, answers: quizAnswers },
        },
      });
      setLeadName('');
      setLeadEmail('');
      setLeadPhone('');
      setQuizAnswers({});
      setQuizMessage("We will contact you if you win.");
      setQuizState('submitted');
      toast.notify("We will contact you if you win.", 'success');
      trackEvent('Quiz Submitted', { dropId: drop.id, leadId: leadResponse?.id ?? null });
    } catch (err: any) {
      if (err?.error === 'lead_contact_required' || err?.message === 'lead_contact_required') {
        setQuizError('Please provide a phone number or email so we can reach you.');
      } else {
        setQuizError('Unable to submit right now. Please try again.');
        toast.notify('Unable to submit lead right now.', 'error');
      }
    } finally {
      setQuizLoading(false);
    }
  };

  const heroImageStyle = useMemo(
    () => ({
      width: '100%',
      height: 220,
      borderRadius: 14,
      background: drop?.heroImageUrl
        ? `url(${drop.heroImageUrl}) center/cover`
        : '#111',
    }),
    [drop]
  );

  return (
    <section>
      <header
        style={{
          padding: '1.5rem',
          borderRadius: 12,
          background: '#1b1b1b',
          border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={heroImageStyle} />
        <div style={{ marginTop: '1rem' }}>
          <p style={{ opacity: 0.7 }}>{drop?.handle && `@${drop.handle}`}</p>
          <h1>{formatDropTitle(drop)}</h1>
          {status === 'loading' && <LoadingSkeleton count={1} className="mt-4" />}
          {status === 'error' && (
            <ErrorBanner
              message={error ?? 'Failed to load drop'}
              onRetry={loadDrop}
              className="mt-4"
            />
          )}
          {drop?.description && <p>{drop.description}</p>}
        </div>
      </header>

      <section
        style={{
          padding: '1.5rem',
          borderRadius: 12,
          background: '#121212',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '1.5rem',
        }}
      >
        <h2>{drop?.quizJson?.title ?? 'Play this quiz'}</h2>
        {quizState === 'idle' && (
          <>
            <p>Start the quiz to enter the drop lead list.</p>
            <button type="button" onClick={startQuiz}>
              Start Quiz
            </button>
          </>
        )}
        {quizState === 'quiz' && (
          <div className="mt-3 space-y-3">
            {quizQuestions.length === 0 && (
              <p className="text-sm text-neutral-300">
                No quiz questions configured for this drop yet. Continue to lead form.
              </p>
            )}
            {quizQuestions.map((question) => (
              <div key={question.id} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-medium text-neutral-100">
                  {question.prompt}
                  {question.required ? ' *' : ''}
                </p>
                {question.type === 'single_choice' && Array.isArray(question.options) && (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <label key={`${question.id}-${option}`} className="flex items-center gap-2 text-sm text-neutral-200">
                        <input
                          type="radio"
                          name={`quiz-${question.id}`}
                          value={option}
                          checked={quizAnswers[question.id] === option}
                          onChange={(event) =>
                            setQuizAnswers((prev) => ({
                              ...prev,
                              [question.id]: event.target.value,
                            }))
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}
                {question.type === 'text' && (
                  <input
                    type="text"
                    value={quizAnswers[question.id] ?? ''}
                    onChange={(event) =>
                      setQuizAnswers((prev) => ({
                        ...prev,
                        [question.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Your answer"
                  />
                )}
              </div>
            ))}
            {quizError && <p role="alert">{quizError}</p>}
            <button type="button" onClick={continueToLeadForm}>
              Continue
            </button>
          </div>
        )}
        {quizState === 'leadCapture' && (
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitQuiz();
            }}
          >
            <label className="flex flex-col gap-1 text-sm text-neutral-200">
              Name
              <input
                type="text"
                required
                value={leadName}
                onChange={(event) => setLeadName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-200">
              Email
              <input
                type="email"
                value={leadEmail}
                onChange={(event) => setLeadEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-200">
              Phone
              <input
                type="tel"
                value={leadPhone}
                onChange={(event) => setLeadPhone(event.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </label>
            {quizError && <p role="alert">{quizError}</p>}
            <button type="submit" disabled={quizLoading}>
              {quizLoading ? 'Submitting...' : 'Submit'}
            </button>
            {quizError && (
              <button
                type="button"
                onClick={submitQuiz}
                disabled={quizLoading}
              >
                Retry
              </button>
            )}
          </form>
        )}
        {quizState === 'submitted' && quizMessage && (
          <p role="status">{quizMessage}</p>
        )}
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2>Drop Products</h2>
          {productsStatus === 'loading' && <p>Loading products…</p>}
        </div>
        {productsStatus === 'loading' && <LoadingSkeleton count={3} className="mt-4" />}
        {products.length === 0 && productsStatus !== 'loading' && (
          <EmptyState message="No products attached to this drop yet." />
        )}
        {products.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                style={{
                  padding: '1rem',
                  borderRadius: 12,
                  background: '#1f1f1f',
                  textDecoration: 'none',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <h3 style={{ margin: 0 }}>{product.title}</h3>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                  View Product
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
