'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plane, Calendar, MessageSquare, Ticket, LogOut, QrCode } from 'lucide-react';
import { signOutAction } from '@/actions/auth';

export default function Navbar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();

  const links = [
    { href: '/chat', label: 'AI Agent', icon: MessageSquare },
    { href: '/flights', label: 'Search Flights', icon: Plane },
    { href: '/bookings', label: 'Bookings', icon: Calendar },
    { href: '/e-tickets', label: 'e-Tickets', icon: QrCode },
    { href: '/tickets', label: 'Support', icon: Ticket },
  ];

  return (
    <nav className="border-b border-cyber-cyan/20 bg-cyber-black/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-pink text-glow-cyan">
                AURA_TRAVEL
              </span>
              <span className="text-[10px] font-mono text-cyber-cyan border border-cyber-cyan/30 px-1 py-0.5 rounded uppercase tracking-widest bg-cyber-cyan/5">
                v1.0
              </span>
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="flex space-x-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-mono tracking-wider transition-all duration-300 ${
                      isActive
                        ? 'text-cyber-cyan bg-cyber-cyan/10 border-b-2 border-cyber-cyan shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                        : 'text-foreground/75 hover:text-cyber-cyan hover:bg-cyber-cyan/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {userEmail ? (
              <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-xs font-mono text-cyber-purple/80">
                  {userEmail}
                </span>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 border border-cyber-pink/30 rounded bg-cyber-pink/5 hover:bg-cyber-pink/15 text-cyber-pink text-xs font-mono tracking-widest transition-all duration-300 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    TERMINATE_SESSION
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/auth"
                className="px-4 py-2 border border-cyber-cyan/40 bg-cyber-cyan/5 hover:bg-cyber-cyan/20 text-cyber-cyan text-sm font-mono tracking-widest rounded transition-all duration-300 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
              >
                INITIALIZE_AUTH
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
