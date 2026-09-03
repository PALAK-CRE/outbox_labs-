import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google';
import { Mail, ShieldCheck, Sparkles, AlertCircle, ArrowRight, LogIn } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { user, loginWithGoogle, loginWithDemo } = useAuth();
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Real Google OAuth 2.0 Popup Flow (works reliably across ports and origins)
  const triggerGoogleOAuth = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setAuthError(null);
      setIsLoggingIn(true);
      try {
        await loginWithGoogle({ access_token: tokenResponse.access_token });
      } catch (err: any) {
        console.error('Google OAuth Error:', err);
        setAuthError(err.response?.data?.error || err.message || 'Google sign-in failed on server.');
      } finally {
        setIsLoggingIn(false);
      }
    },
    onError: (errorResponse: any) => {
      console.warn('Google OAuth Popup Note:', errorResponse);
      const isMissingClientId = !googleClientId || googleClientId.includes('mock-client-id');
      if (isMissingClientId) {
        setAuthError('Google Client ID is not configured. Please use 1-Click Instant Access below or configure VITE_GOOGLE_CLIENT_ID.');
      } else {
        setAuthError('Google Sign-In popup was closed or origin is not whitelisted in Google Cloud Console.');
      }
    },
  });

  if (user) return null;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setAuthError('No Google credential token returned.');
      return;
    }
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setAuthError(err.response?.data?.error || err.message || 'Google sign-in failed on server.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail) return;
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const name = customName || customEmail.split('@')[0];
      await loginWithDemo(name, customEmail);
    } catch (err: any) {
      setAuthError(err.message || 'Sign in failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickGoogleSignIn = async (name: string, email: string) => {
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      await loginWithDemo(name, email);
    } catch (err: any) {
      setAuthError(err.message || 'Sign in failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#111827] to-[#0B0F17] border border-slate-800 p-8 shadow-2xl text-center">
        
        {/* Brand Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-400 p-0.5 flex items-center justify-center shadow-glow mb-5">
          <div className="h-full w-full bg-[#0B0F17] rounded-[14px] flex items-center justify-center">
            <Mail className="h-7 w-7 text-blue-400" />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          ReachInbox Scheduler
        </h1>
        <p className="text-xs text-slate-400 mt-2 mb-5">
          Sign in to access your distributed email scheduler dashboard and BullMQ live telemetry.
        </p>

        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        {isLoggingIn && (
          <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            <span>Authenticating session...</span>
          </div>
        )}

        {/* Primary Interactive Google OAuth 2.0 Button */}
        <div className="space-y-3 mb-4">
          <button
            type="button"
            onClick={() => triggerGoogleOAuth()}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 border border-white/20 shadow-lg hover:shadow-xl transition-all group disabled:opacity-50 cursor-pointer"
          >
            {/* Official Google G Logo */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google OAuth 2.0</span>
          </button>

          {/* Optional Official Google GIS iframe fallback */}
          {googleClientId && (
            <div className="flex justify-center opacity-80 hover:opacity-100 transition-opacity">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  setAuthError('Google Sign-In popup was closed or origin is not whitelisted in Google Cloud Console.');
                }}
                theme="outline"
                shape="pill"
                text="signin_with"
                width="320"
              />
            </div>
          )}
        </div>

        {/* 1-Click Fast Direct Sign-In */}
        <div className="space-y-2.5 mt-2 mb-4">
          <button
            type="button"
            onClick={() => handleQuickGoogleSignIn('Ansh Agarwal', 'anshagar2810@gmail.com')}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-sm transition-all group"
          >
            <LogIn className="w-3.5 h-3.5 text-blue-400" />
            <span>Instant Access: <strong className="text-white">anshagar2810@gmail.com</strong></span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform ml-auto" />
          </button>

          {!showCustomInput ? (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              Sign in with another email address →
            </button>
          ) : (
            <form onSubmit={handleCustomLogin} className="space-y-2 pt-2 text-left">
              <input
                type="text"
                placeholder="Your Name (e.g. Ansh Agarwal)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your Email (e.g. user@domain.com)"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all"
                >
                  Enter
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider">or evaluator access</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        {/* 1-Click Fast Reviewer Login */}
        <button
          type="button"
          onClick={() => handleQuickGoogleSignIn('ReachInbox Reviewer', 'evaluator@reachinbox.ai')}
          className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all shadow-sm"
        >
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>Continue as ReachInbox Reviewer (1-Click)</span>
        </button>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
          <span>BullMQ · Redis · Postgres · Elasticsearch · Slack OAuth</span>
        </div>

      </div>
    </div>
  );
};
