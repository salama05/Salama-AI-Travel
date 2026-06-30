'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '@/components/navbar';
import { getUser } from '@/actions/auth';
import {
  Bot, User, Send, Terminal, Activity, ArrowRight, Loader2,
  Zap, Brain, Database,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlightResult {
  id: string;
  flightNumber: string;
  airline: string;
  departure: string;
  arrival: string;
  departureTime: string;
  priceUSD: number;
  status: string;
  score: number;
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
  flights?: FlightResult[];
  cacheHit?: boolean;
}

// ─── Generate a stable sessionId per user (persisted in localStorage) ─────────
function getOrCreateSessionId(userId: string): string {
  const key = `aura_session_${userId}`;
  if (typeof window === 'undefined') return `session-${userId}`;
  const existing = localStorage.getItem(key);
  // Redis Agent Memory requires strictly alphanumeric and hyphens. 
  // If we have an old sessionId with an underscore, invalidate it.
  if (existing && !existing.includes('_')) return existing;
  const newId = `${userId}-${Date.now()}`;
  localStorage.setItem(key, newId);
  return newId;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [user, setUser]       = useState<any>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'AURA AI TRAVEL AGENT ONLINE — Powered by Redis Cloud AI.\nAsk me about flights, your bookings, or travel support.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const u = await getUser();
      if (!u) {
        router.push('/auth');
      } else {
        setUser(u);
        setSessionId(getOrCreateSessionId(u.id));
      }
    }
    loadUser();
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (textToSend: string) => {
    if (!textToSend.trim() || !sessionId) return;

    const userMsg: Message = {
      id: Math.random().toString(36),
      sender: 'user',
      text: textToSend,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, sessionId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const cacheHit = res.headers.get('x-cache') === 'HIT';
      const data: { reply: string; flights?: FlightResult[]; cacheHit: boolean } =
        await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36),
          sender: 'agent',
          text: data.reply,
          timestamp: new Date(),
          flights: data.flights,
          cacheHit,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36),
          sender: 'agent',
          text: `SYSTEM ERROR: ${(err as Error).message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleSuggest = (term: string) => handleSend(term);

  return (
    <div className="min-h-screen bg-cyber-black text-foreground flex flex-col h-screen overflow-hidden">
      <Navbar userEmail={user?.email} />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Glow */}
        <div className="absolute top-[10%] left-[10%] w-[30%] h-[30%] rounded-full bg-cyber-cyan/5 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyber-pink/5 blur-[100px] pointer-events-none" />

        {/* Sidebar */}
        <aside className="hidden lg:flex w-80 border-r border-cyber-cyan/15 bg-cyber-black/40 backdrop-blur-md p-6 flex-col justify-between shrink-0">
          <div className="space-y-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-cyber-cyan font-mono text-xs uppercase tracking-widest">
                <Activity className="w-4 h-4 animate-pulse" />
                SYSTEM_METADATA
              </div>
              <div className="cyber-panel p-4 rounded font-mono text-xs space-y-2 border-cyber-cyan/20">
                <div>USER: {user?.profile?.full_name || 'AUTHENTICATED_AGENT'}</div>
                <div>SECURE_ID: {user?.id?.substring(0, 8)}...</div>
                <div>SESSION: {sessionId.split('_').pop()?.substring(0, 8) ?? '...'}...</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-cyber-purple font-mono text-xs uppercase tracking-widest">
                <Terminal className="w-4 h-4" />
                REDIS_SERVICES
              </div>
              <div className="cyber-panel p-4 rounded font-mono text-xs space-y-2 border-cyber-purple/20">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><Brain className="w-3 h-3 text-cyber-cyan" /> AGENT_MEMORY</span>
                  <span className="text-cyber-green">ONLINE</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-cyber-pink" /> LANG_CACHE</span>
                  <span className="text-cyber-green">ONLINE</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><Database className="w-3 h-3 text-cyber-purple" /> VECTOR_IDX</span>
                  <span className="text-cyber-green">ONLINE</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>RLS_STATUS:</span>
                  <span className="text-cyber-cyan">ENFORCED</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-cyber-cyan/15 pt-4 text-center text-[10px] font-mono text-foreground/30 uppercase tracking-wider">
            Model: gemini-2.5-flash · Embed: 768-dim
          </div>
        </aside>

        {/* Chat Console */}
        <main className="flex-1 flex flex-col justify-between bg-cyber-black/60 backdrop-blur-sm relative">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'agent' && (
                  <div className="w-8 h-8 rounded-full border border-cyber-cyan/30 bg-cyber-cyan/10 flex items-center justify-center text-cyber-cyan shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className="max-w-2xl space-y-3">
                  {/* Cache badge */}
                  {msg.cacheHit && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyber-pink tracking-wider">
                      <Zap className="w-3 h-3" />
                      LANGCACHE HIT — instant reply
                    </div>
                  )}

                  <div
                    className={`p-4 rounded-lg font-mono text-sm leading-relaxed border whitespace-pre-wrap ${
                      msg.sender === 'user'
                        ? 'bg-cyber-purple/10 border-cyber-purple/30 text-foreground'
                        : 'bg-cyber-dark/80 border-cyber-cyan/20 text-cyber-cyan shadow-[0_0_15px_rgba(0,240,255,0.03)]'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Inline flight cards from Redis search */}
                  {msg.flights && msg.flights.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {msg.flights.map((flight) => (
                        <div
                          key={flight.id}
                          className="cyber-panel p-4 rounded border border-cyber-cyan/25 bg-cyber-black/50 text-xs font-mono space-y-2"
                        >
                          <div className="flex justify-between items-center text-cyber-cyan">
                            <span className="font-bold">{flight.flightNumber}</span>
                            <span className="text-cyber-pink font-bold">${flight.priceUSD}</span>
                          </div>
                          <div className="flex justify-between items-center text-foreground/80">
                            <span>{flight.departure}</span>
                            <ArrowRight className="w-3 h-3 text-cyber-purple mx-1 shrink-0" />
                            <span>{flight.arrival}</span>
                          </div>
                          <div className="text-foreground/50 text-[10px]">
                            {new Date(flight.departureTime).toLocaleString()}
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              flight.status === 'scheduled'
                                ? 'border-cyber-green/40 text-cyber-green bg-cyber-green/5'
                                : 'border-cyber-pink/40 text-cyber-pink bg-cyber-pink/5'
                            }`}>
                              {flight.status.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-foreground/30">
                              match: {(flight.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <button
                            onClick={() => router.push('/flights')}
                            className="w-full py-1 text-[10px] uppercase font-bold tracking-wider bg-cyber-cyan/10 hover:bg-cyber-cyan/35 text-cyber-cyan border border-cyber-cyan/30 rounded cursor-pointer transition-colors"
                          >
                            BOOK_THIS_FLIGHT
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full border border-cyber-purple/30 bg-cyber-purple/10 flex items-center justify-center text-cyber-purple shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-full border border-cyber-cyan/30 bg-cyber-cyan/10 flex items-center justify-center text-cyber-cyan shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="cyber-panel p-4 rounded-lg font-mono text-sm text-cyber-cyan/60 animate-pulse border-cyber-cyan/15 bg-cyber-dark/80">
                  QUERYING REDIS VECTOR INDEX + GEMINI...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-cyber-cyan/15 bg-cyber-black/90 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSuggest('Find me cheap flights to London')}
                className="px-3 py-1 bg-cyber-dark hover:bg-cyber-cyan/10 border border-cyber-cyan/20 hover:border-cyber-cyan/45 text-cyber-cyan text-[10px] font-mono rounded-full transition-all cursor-pointer"
              >
                # LONDON_FLIGHTS
              </button>
              <button
                onClick={() => handleSuggest('Show me flights to Tokyo under $950')}
                className="px-3 py-1 bg-cyber-dark hover:bg-cyber-purple/10 border border-cyber-purple/20 hover:border-cyber-purple/45 text-cyber-purple text-[10px] font-mono rounded-full transition-all cursor-pointer"
              >
                # TOKYO_BUDGET
              </button>
              <button
                onClick={() => handleSuggest('Show me my bookings')}
                className="px-3 py-1 bg-cyber-dark hover:bg-cyber-pink/10 border border-cyber-pink/20 hover:border-cyber-pink/45 text-cyber-pink text-[10px] font-mono rounded-full transition-all cursor-pointer"
              >
                # MY_BOOKINGS
              </button>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AURA anything about your flights..."
                className="flex-1 px-4 py-3.5 bg-cyber-black border border-cyber-cyan/20 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 rounded text-sm font-mono placeholder-foreground/20 text-foreground transition-all outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 bg-cyber-cyan/15 hover:bg-cyber-cyan/35 disabled:opacity-40 text-cyber-cyan border border-cyber-cyan rounded transition-all cursor-pointer flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.1)]"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
