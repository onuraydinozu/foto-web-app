'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PlaceVoteAlertProps {
  voteData: any; // { place: { name, district... }, started_by, expires_at }
  onClose: () => void;
  roomId: string;
  currentUserNick: string;
}

export default function PlaceVoteAlert({ voteData, onClose, roomId, currentUserNick }: PlaceVoteAlertProps) {
  const [timeLeft, setTimeLeft] = useState(60);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!voteData) return;
    
    const exp = voteData.expires_at || Date.now() + 60000;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
        setTimeout(onClose, 2000); // Kapatmadan önce az bekle
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [voteData, onClose]);

  const handleYes = async () => {
    setHasVoted(true);
    try {
      // 1. Get current votes
      const { data } = await supabase
        .from('place_votes')
        .select('*')
        .eq('room_id', roomId)
        .eq('place_name', voteData.place.name)
        .single();
        
      if (data) {
        // 2. Add vote
        await supabase
          .from('place_votes')
          .update({
            votes_count: data.votes_count + 1,
            voters: [...(data.voters || []), currentUserNick]
          })
          .eq('id', data.id);
      }
    } catch (e) {}
  };

  if (!voteData) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -50, opacity: 0, scale: 0.9 }}
        className="fixed top-20 left-4 right-4 z-[90] pointer-events-none flex justify-center"
      >
        <div className="bg-[#12151F]/90 backdrop-blur-xl border-2 border-[#CCFF00] p-4 rounded-3xl shadow-[0_0_40px_rgba(204,255,0,0.3)] max-w-sm w-full pointer-events-auto">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 bg-[#CCFF00]/20 rounded-full flex items-center justify-center animate-pulse">
              <MapPin className="w-6 h-6 text-[#CCFF00]" />
            </div>
            
            <div>
              <h3 className="text-white font-black text-lg leading-tight">
                @{voteData.started_by} Masaya Mekan Önerdi!
              </h3>
              <p className="text-neutral-400 text-xs mt-1">
                {voteData.place.name} ({voteData.place.district})
              </p>
            </div>

            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#CCFF00] transition-all duration-1000 ease-linear"
                style={{ width: `${(timeLeft / 60) * 100}%` }}
              />
            </div>

            {!hasVoted && timeLeft > 0 ? (
              <div className="flex gap-3 w-full">
                <button 
                  onClick={handleYes}
                  className="flex-1 bg-[#CCFF00] text-black font-black py-2.5 rounded-xl hover:scale-105 transition shadow-sm"
                >
                  Gideriz! 👍
                </button>
                <button 
                  onClick={() => setHasVoted(true)}
                  className="flex-1 bg-white/5 text-white font-bold py-2.5 rounded-xl border border-white/10 hover:bg-white/10 transition"
                >
                  Pas
                </button>
              </div>
            ) : (
              <div className="text-[#CCFF00] font-bold flex items-center gap-2 text-sm bg-[#CCFF00]/10 px-4 py-2 rounded-full">
                <Check className="w-4 h-4" /> 
                {timeLeft > 0 ? 'Oyunuz Alındı' : 'Oylama Bitti'}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
