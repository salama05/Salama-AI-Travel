'use client';

import { useState, useEffect, useTransition } from 'react';
import { getFlightOccupiedSeats, performCheckIn } from '@/actions/travel';
import { X, Check, ShieldAlert, Loader2, Armchair } from 'lucide-react';

interface CheckInModalProps {
  ticketId: string;
  flightId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckInModal({ ticketId, flightId, isOpen, onClose, onSuccess }: CheckInModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  
  // Step 1 States
  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [declared, setDeclared] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 States
  const [occupiedSeats, setOccupiedSeats] = useState<string[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch occupied seats on step 2 load
  useEffect(() => {
    if (step === 2 && isOpen) {
      setIsLoadingSeats(true);
      getFlightOccupiedSeats(flightId)
        .then((seats) => setOccupiedSeats(seats))
        .catch((err) => console.error('Failed to load seats:', err))
        .finally(() => setIsLoadingSeats(false));
    }
  }, [step, isOpen, flightId]);

  if (!isOpen) return null;

  // Step 1 Submit
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);
    if (!passportNumber.trim()) {
      setStep1Error('Passport number is required.');
      return;
    }
    if (!passportExpiry) {
      setStep1Error('Passport expiry date is required.');
      return;
    }
    if (!declared) {
      setStep1Error('You must declare that the information provided is correct.');
      return;
    }
    setStep(2);
  };

  // Step 2 Final Submit
  const handleConfirmCheckIn = () => {
    if (!selectedSeat) {
      setSubmitError('Please select a seat.');
      return;
    }

    setSubmitError(null);
    startTransition(async () => {
      const result = await performCheckIn(ticketId, passportNumber, passportExpiry, selectedSeat);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(result.error);
      }
    });
  };

  // Generate Seat Map Grid (Rows 1 to 10, Seats A to F)
  const rows = Array.from({ length: 10 }, (_, i) => i + 1);
  const seatLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-cyber-black/95 border-2 border-primary/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary/20 bg-primary/5">
          <div>
            <h2 className="text-xl font-black text-white tracking-widest uppercase">Online Check-in Wizard</h2>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Step {step} of 2: {step === 1 ? 'Passenger Verification' : 'Seat Allocation'}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors cursor-pointer p-1">
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 ? (
            /* STEP 1: Passport Info Form */
            <form onSubmit={handleNextStep} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-primary tracking-wider">Passport Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A1234567"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-primary tracking-wider">Passport Expiry Date</label>
                <input
                  type="date"
                  required
                  value={passportExpiry}
                  onChange={(e) => setPassportExpiry(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors font-mono"
                />
              </div>

              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4 border border-white/5">
                <input
                  type="checkbox"
                  id="declaration"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                  className="mt-1 accent-primary rounded cursor-pointer"
                />
                <label htmlFor="declaration" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
                  I declare that the passport details entered are correct, match my official document, and are valid for entry to the destination country.
                </label>
              </div>

              {step1Error && (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                  <span>{step1Error}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold font-mono tracking-wider hover:opacity-90 transition-all cursor-pointer"
              >
                Proceed to Seat Selection →
              </button>
            </form>
          ) : (
            /* STEP 2: Seat Map Grid Selection */
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Select one of the available cyber-cyan seats from the cabin map below.</p>
              </div>

              {isLoadingSeats ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="text-primary animate-spin" size={32} />
                  <p className="text-xs font-mono text-muted-foreground">Scanning cabin occupancy...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center select-none">
                  {/* Seat Map Cabin Grid */}
                  <div className="border border-primary/20 bg-black/40 rounded-2xl p-6 max-h-[350px] overflow-y-auto w-full max-w-sm">
                    {/* Header Columns */}
                    <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-mono text-muted-foreground">
                      <div /> {/* Row index col */}
                      {seatLetters.map((l, i) => (
                        <div key={l} className={i === 3 ? 'ml-4' : ''}>{l}</div>
                      ))}
                    </div>

                    {/* Cabin Rows */}
                    <div className="space-y-2">
                      {rows.map((rowNum) => (
                        <div key={rowNum} className="grid grid-cols-7 gap-2 items-center text-center">
                          {/* Row Number */}
                          <div className="text-xs font-mono text-muted-foreground/60">{rowNum}</div>
                          
                          {/* Seat Buttons */}
                          {seatLetters.map((letter, letterIdx) => {
                            const seatId = `${rowNum}${letter}`;
                            const isOccupied = occupiedSeats.includes(seatId);
                            const isSelected = selectedSeat === seatId;
                            
                            return (
                              <button
                                key={seatId}
                                disabled={isOccupied}
                                onClick={() => setSelectedSeat(seatId)}
                                className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono transition-all cursor-pointer ${
                                  letterIdx === 3 ? 'ml-4' : ''
                                } ${
                                  isOccupied
                                    ? 'bg-white/5 text-white/10 border border-white/5 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-primary text-primary-foreground border-2 border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]'
                                    : 'border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary'
                                }`}
                                title={isOccupied ? `Seat ${seatId} (Booked)` : `Seat ${seatId}`}
                              >
                                <Armchair size={12} />
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Seat Legend */}
                  <div className="flex gap-4 mt-4 text-xs font-mono">
                    <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-primary/30 flex items-center justify-center text-primary"><Armchair size={8} /></span> Available</div>
                    <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-white/5 border border-white/5 text-white/20 flex items-center justify-center"><Armchair size={8} /></span> Booked</div>
                    <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-primary text-primary-foreground flex items-center justify-center"><Armchair size={8} /></span> Selected</div>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold font-mono hover:bg-white/10 transition-all cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={handleConfirmCheckIn}
                  disabled={isPending || !selectedSeat}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold font-mono tracking-wider hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Confirm Check-in
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
