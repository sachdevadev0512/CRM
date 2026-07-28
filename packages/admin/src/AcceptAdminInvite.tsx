import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Lock, Key, ShieldCheck, AlertCircle, ArrowRight, RefreshCw, MailWarning } from 'lucide-react';
import { apiClient } from './apiClient';
import { authStore } from './authStore';

type InviteScreenState = 'checking' | 'invalid' | 'ready' | 'success';

export default function AcceptAdminInvite() {
  const [screenState, setScreenState] = useState<InviteScreenState>('checking');
  const [inviteEmail, setInviteEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const attemptsRef = useRef(0);

  useEffect(() => {
    let active = true;

    // The invite email's link points straight at Supabase, which redirects back here with the
    // session tokens already embedded in the URL fragment -- no Supabase client is needed to
    // "receive" them, they're just handed to the browser by the redirect. Storing them via
    // authStore immediately (rather than relying on ambient auto-detection) is what closes the
    // session race that previously produced "Set a password for {the wrong admin's email}" when
    // the inviting admin tested the link on their own already-logged-in device: explicitly
    // parsing and storing THESE tokens deterministically overwrites whatever was there before.
    const establishInviteSession = (): boolean => {
      const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
      const hashParams = new URLSearchParams(rawHash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (!accessToken || !refreshToken) return false;

      const expiresAtParam = hashParams.get('expires_at');
      const expiresInParam = hashParams.get('expires_in');
      const expiresAt = expiresAtParam
        ? parseInt(expiresAtParam, 10)
        : Math.floor(Date.now() / 1000) + parseInt(expiresInParam || '3600', 10);

      authStore.setSession({ access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt });
      // Strip the tokens out of the URL immediately -- they shouldn't linger in the address
      // bar or browser history once consumed.
      window.history.replaceState(null, '', window.location.pathname);
      return true;
    };

    const checkForInviteSession = async () => {
      const established = establishInviteSession();

      if (established || authStore.hasSession()) {
        const user = await apiClient.getCurrentUser();
        if (user) {
          if (active) {
            setInviteEmail(user.email);
            setScreenState('ready');
          }
          return;
        }
      }

      attemptsRef.current += 1;
      if (attemptsRef.current >= 10) {
        if (active) setScreenState('invalid');
        return;
      }
      setTimeout(checkForInviteSession, 400);
    };

    checkForInviteSession();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.setPassword(password);
      const success = await apiClient.acceptAdminInvite();
      if (success) {
        setScreenState('success');
      } else {
        setError('Failed to activate your administrator account. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to activate your administrator account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4" id="admin-accept-invite-screen">
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs space-y-6"
      >
        {screenState === 'checking' && (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
            <span className="text-xs text-neutral-400 font-mono">Verifying your invitation link...</span>
          </div>
        )}

        {screenState === 'invalid' && (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100">
                <MailWarning className="h-5 w-5 text-red-600" />
              </div>
              <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
                Invalid or Expired Invitation
              </h1>
              <p className="text-neutral-500 text-xs leading-relaxed">
                This invitation link is invalid, has expired, or has already been used. Please ask an
                existing administrator to send you a new invitation.
              </p>
            </div>
            <a
              href="/admin/login"
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              Go to Sign In
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </>
        )}

        {screenState === 'ready' && (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <Lock className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
                Activate Your Administrator Account
              </h1>
              <p className="text-neutral-500 text-xs">
                Set a password for <span className="font-semibold font-mono text-neutral-700">{inviteEmail}</span> to
                finish joining the Middha Ventures CRM.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="new-password">
                  New Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="password"
                    id="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="password"
                    id="confirm-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 disabled:bg-neutral-400 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                Activate Account
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </>
        )}

        {screenState === 'success' && (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-50 border border-neutral-200">
                <ShieldCheck className="h-5 w-5 text-neutral-800" />
              </div>
              <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
                Administrator Account Activated
              </h1>
              <p className="text-neutral-500 text-xs leading-relaxed">
                You're all set. You now have full administrator access to the CRM.
              </p>
            </div>
            <a
              href="/admin"
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              Continue to CRM
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </>
        )}
      </motion.div>
    </div>
  );
}
