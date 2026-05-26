'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Flame, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const inp = 'w-full rounded-lg bg-coal border border-line px-4 py-3.5 text-base text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors min-h-[48px]';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [ready, setReady]         = useState(false);
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  // Supabase reset links may arrive as a PKCE `code` query param or as URL
  // hash tokens. Handle both so the page never hangs waiting for one event.
  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const markReady = () => {
      if (cancelled) return;
      setReady(true);
      setVerifying(false);
      setError(null);
      clearTimeout(timeout);
    };

    const markFailed = (message: string) => {
      if (cancelled) return;
      setReady(false);
      setVerifying(false);
      setError(message);
      clearTimeout(timeout);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        markReady();
      }
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        markReady();
      }
    });

    const verifyResetLink = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const linkError = url.searchParams.get('error_description') || url.searchParams.get('error');

      if (linkError) {
        markFailed(linkError);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          markFailed(exchangeError.message);
          return;
        }
        markReady();
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        markFailed(sessionError.message);
        return;
      }
      if (session) {
        markReady();
      }
    };

    timeout = setTimeout(() => {
      markFailed('This reset link could not be verified. Request a new password reset link and open the newest email.');
    }, 8000);

    verifyResetLink();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push('/dashboard'), 2500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-coal px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ember mb-4 shadow-lg shadow-ember/25">
            <Flame className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ember tracking-tight">GizOps</h1>
        </div>

        <div className="rounded-2xl bg-hover border border-line p-8 shadow-xl">

          {success ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center text-center py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-900/30 border border-green-800 mb-4">
                <CheckCircle2 className="h-7 w-7 text-green-400" />
              </div>
              <p className="text-base font-semibold text-cream mb-1">Password updated!</p>
              <p className="text-xs text-mist/70">Taking you to your dashboard…</p>
            </div>

          ) : verifying ? (
            /* ── Waiting for token exchange ── */
            <div className="flex flex-col items-center text-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-ember mb-4" />
              <p className="text-sm text-mist">Verifying your reset link…</p>
              <p className="text-xs text-mist/50 mt-2">
                If nothing happens,{' '}
                <button
                  onClick={() => router.push('/login')}
                  className="text-ember underline underline-offset-2 hover:text-ember-dark transition-colors"
                >
                  return to login
                </button>
                {' '}and request a new link.
              </p>
            </div>

          ) : !ready ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/60 border border-red-800/60 mb-4">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-cream mb-1">Reset link could not be verified</p>
              <p className="text-xs text-mist/70 mb-5">{error ?? 'Request a new password reset link and use the newest email.'}</p>
              <button
                onClick={() => router.push('/login')}
                className="rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-ember-dark transition-colors"
              >
                Return to Login
              </button>
            </div>

          ) : (
            /* ── Reset form ── */
            <>
              <h2 className="text-base font-semibold text-cream mb-1">Set a new password</h2>
              <p className="text-xs text-mist/60 mb-6">Choose a strong password — at least 8 characters.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-xs font-medium text-mist mb-1.5">
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className={inp}
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-medium text-mist mb-1.5">
                    Confirm new password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    className={inp}
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-red-950/60 border border-red-800/60 px-3.5 py-2.5">
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-ember px-4 text-sm font-semibold text-white hover:bg-ember-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-h-[52px]"
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
                    : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-mist/30">GizOps · Invitation only</p>
      </div>
    </div>
  );
}
