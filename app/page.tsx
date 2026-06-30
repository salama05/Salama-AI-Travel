import Link from 'next/link';
import { Plane, Bot, Shield, HelpCircle } from 'lucide-react';
import Navbar from '@/components/navbar';
import { getUser } from '@/actions/auth';

export default async function Home() {
  const user = await getUser();

  return (
    <div className="relative min-h-screen flex flex-col cyber-grid bg-cyber-black text-foreground overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyber-cyan/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyber-pink/10 blur-[120px] pointer-events-none" />

      <Navbar userEmail={user?.email} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center py-20 relative z-10">
        <div className="text-center max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyber-cyan/30 rounded-full bg-cyber-cyan/5 text-cyber-cyan text-xs font-mono tracking-widest uppercase mb-4 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyber-cyan" />
            Core Infrastructure Loaded
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
            Next-Gen <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-pink text-glow-cyan">
              AI Travel Agent
            </span>
          </h1>

          <p className="text-lg md:text-xl text-foreground/75 font-mono max-w-2xl mx-auto leading-relaxed border-l-2 border-cyber-pink/50 pl-4 py-1">
            Secure flight searching, autonomous booking, and intelligent AI ticket support wrapped in a sleek, real-time cybernetic interface.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link
              href={user ? "/chat" : "/auth"}
              className="w-full sm:w-auto px-8 py-4 border border-cyber-cyan bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan font-mono tracking-widest text-sm rounded shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all duration-300 transform hover:-translate-y-0.5"
            >
              LAUNCH_WORKSPACE
            </Link>
            <Link
              href="/flights"
              className="w-full sm:w-auto px-8 py-4 border border-cyber-pink bg-cyber-pink/5 hover:bg-cyber-pink/15 text-cyber-pink font-mono tracking-widest text-sm rounded shadow-[0_0_20px_rgba(255,0,127,0.1)] transition-all duration-300 transform hover:-translate-y-0.5"
            >
              QUERY_FLIGHTS
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-24">
          <div className="cyber-panel p-6 rounded-lg transition-all duration-300 hover:border-cyber-cyan/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.1)]">
            <div className="p-3 bg-cyber-cyan/10 rounded-md w-fit text-cyber-cyan mb-4">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-mono font-bold tracking-wider text-cyber-cyan mb-2">AI AGENT CHAT</h3>
            <p className="text-sm font-sans text-foreground/70 leading-relaxed">
              Interact with a custom flight booking intelligence model that executes searches and schedules ticket resolutions autonomously.
            </p>
          </div>

          <div className="cyber-panel p-6 rounded-lg transition-all duration-300 hover:border-cyber-cyan/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.1)]">
            <div className="p-3 bg-cyber-purple/10 rounded-md w-fit text-cyber-purple mb-4">
              <Plane className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-mono font-bold tracking-wider text-cyber-purple mb-2">FLIGHT DIRECTORY</h3>
            <p className="text-sm font-sans text-foreground/70 leading-relaxed">
              Direct connection to verified flight schedules with instant price lookups, schedule tracking, and detailed route information.
            </p>
          </div>

          <div className="cyber-panel p-6 rounded-lg transition-all duration-300 hover:border-cyber-cyan/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.1)]">
            <div className="p-3 bg-cyber-pink/10 rounded-md w-fit text-cyber-pink mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-mono font-bold tracking-wider text-cyber-pink mb-2">RLS PROTECTION</h3>
            <p className="text-sm font-sans text-foreground/70 leading-relaxed">
              Row-Level Security (RLS) guarantees that booking transactions and support tickets are bound securely to the authenticated owner.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-cyber-purple/10 bg-cyber-black/90 py-6 relative z-10">
        <div className="max-w-7xl mx-auto px-4 text-center font-mono text-xs text-foreground/45">
          &copy; 2026 AURA TRAVEL INC. ALL DATA PROTOCOLS SECURED.
        </div>
      </footer>
    </div>
  );
}
