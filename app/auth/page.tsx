'use client';

import React, { useState } from 'react';
import { signInAction, signUpAction } from '@/actions/auth';
import { Lock, Mail, User, ShieldAlert, Cpu } from 'lucide-react';
import Link from 'next/link';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = isSignUp ? await signUpAction(formData) : await signInAction(formData);

    if (result && 'error' in result && result.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center cyber-grid bg-cyber-black px-4 overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-cyber-cyan/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-cyber-pink/10 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <Cpu className="w-6 h-6 text-cyber-cyan animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-pink">
              AURA_TRAVEL
            </span>
          </Link>
          <p className="text-xs font-mono text-foreground/60 uppercase tracking-widest">
            Authentication Gate & Security Validation
          </p>
        </div>

        {/* Card Panel */}
        <div className="cyber-panel p-8 rounded-lg border-t-2 border-t-cyber-cyan shadow-[0_0_30px_rgba(0,240,255,0.05)]">
          <h2 className="text-xl font-mono font-bold tracking-wider text-center text-foreground mb-6 uppercase">
            {isSignUp ? 'REGISTER_NEW_USER' : 'INITIATE_AUTH_SESSION'}
          </h2>

          {error && (
            <div className="mb-6 p-4 border border-cyber-pink/40 bg-cyber-pink/10 rounded flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-cyber-pink shrink-0 mt-0.5" />
              <div className="text-xs font-mono text-cyber-pink uppercase leading-normal">
                <span className="font-bold">SYSTEM_ERROR:</span> {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div>
                <label className="block text-xs font-mono tracking-widest text-cyber-cyan uppercase mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                  <input
                    type="text"
                    name="fullName"
                    required
                    placeholder="Jane Doe"
                    className="w-full pl-10 pr-4 py-2.5 bg-cyber-black/60 border border-cyber-cyan/20 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 rounded text-sm font-mono placeholder-foreground/20 text-foreground transition-all duration-300 outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono tracking-widest text-cyber-cyan uppercase mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-cyber-black/60 border border-cyber-cyan/20 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 rounded text-sm font-mono placeholder-foreground/20 text-foreground transition-all duration-300 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono tracking-widest text-cyber-cyan uppercase mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-cyber-black/60 border border-cyber-cyan/20 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 rounded text-sm font-mono placeholder-foreground/20 text-foreground transition-all duration-300 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 border border-cyber-cyan bg-cyber-cyan/10 hover:bg-cyber-cyan/25 disabled:bg-cyber-cyan/5 text-cyber-cyan disabled:text-cyber-cyan/40 font-mono tracking-widest text-xs rounded transition-all duration-300 glow-cyan cursor-pointer uppercase font-bold"
            >
              {loading ? 'PROCESSING_ENCRYPTION...' : isSignUp ? 'SUBMIT_REGISTRATION' : 'START_SESSION'}
            </button>
          </form>

          {/* Toggle link */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-xs font-mono text-cyber-purple hover:text-cyber-pink transition-colors duration-300"
            >
              {isSignUp ? '/* ALREADY REGISTERED? DECRYPT HERE */' : '/* CREATE NEW CREDENTIAL PROFILE */'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
