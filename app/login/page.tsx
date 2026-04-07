'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Flame, Loader2, Clock, ArrowLeft, Mail } from 'lucide-react';

// Shared input class — text-base (16px) prevents iOS zoom on focus
const inp = 'w-full rounded-lg bg-coal border border-line px-4 py-3.5 text-base text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors min-h-[48px]';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  const timedOut = searchParams.get('reason') === 'timeout';

  // Sign-in state
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Forgot-password state
  const [forgotMode, setForgotMode]       = useState(false);
  const [resetEmail, setResetEmail]       = useState('');
  const [resetSending, setResetSending]   = useState(false);
  const [resetSent, setResetSent]         = useState(false);
  const [resetError, setResetError]       = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Invalid email or password. Contact your admin.');
      setLoading(false);
      return;
    }
    router.push('/dashboard');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetSending(true);
    setResetError(null);
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo });
    setResetSending(false);
    if (error) {
      setResetError(error.message);
      return;
    }
    setResetSent(true);
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
          <p className="mt-1.5 text-sm text-mist text-center">
            Operations built for food truck operators
          </p>
        </div>

        {/* Timeout banner */}
        {timedOut && (
          <div className="flex items-start gap-3 rounded-xl bg-amber-900/30 border border-amber-700/50 px-4 py-3 mb-5">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">
              You were logged out due to <strong>15 minutes of inactivity</strong>. Please sign in again.
            </p>
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl bg-hover border border-line p-8 shadow-xl">

          {/* ── Forgot-password mode ── */}
          {forgotMode ? (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setResetSent(false); setResetError(null); }}
                  className="p-1 rounded text-mist hover:text-cream transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="text-base font-semibold text-cream">Reset your password</h2>
              </div>

              {resetSent ? (
                <div className="flex flex-col items-center text-center py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-900/30 border border-green-800 mb-4">
                    <Mail className="h-6 w-6 text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-cream mb-1">Check your email</p>
                  <p className="text-xs text-mist/70">
                    We sent a password reset link to <strong className="text-cream">{resetEmail}</strong>.
                    Follow the link to set a new password.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setResetSent(false); }}
                    className="mt-5 text-xs text-ember hover:text-ember-dark transition-colors underline underline-offset-2"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-xs text-mist/70 -mt-1 mb-1">
                    Enter your email and we'll send you a link to reset your password.
                  </p>
                  <div>
                    <label htmlFor="reset-email" className="block text-xs font-medium text-mist mb-1.5">
                      Email address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inp}
                    />
                  </div>

                  {resetError && (
                    <div className="rounded-lg bg-red-950/60 border border-red-800/60 px-3.5 py-2.5">
                      <p className="text-xs text-red-400">{resetError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={resetSending}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-ember px-4 text-sm font-semibold text-white hover:bg-ember-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-h-[52px]"
                  >
                    {resetSending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </>
          ) : (
            /* ── Normal sign-in mode ── */
            <>
              <h2 className="text-base font-semibold text-cream mb-6">Sign in to your account</h2>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-mist mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inp}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-mist mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inp}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-950/60 border border-red-800/60 px-3.5 py-2.5">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-ember px-4 text-sm font-semibold text-white hover:bg-ember-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2 min-h-[52px]"
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                    : 'Sign In'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setResetEmail(email); }}
                  className="text-xs text-mist/50 hover:text-mist transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-mist/30">
          GizOps · Invitation only
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
