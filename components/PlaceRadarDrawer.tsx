'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Car, Star, Navigation, Vote, Send, Sparkles, Bot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
// @ts-ignore
import { useChat } from '@ai-sdk/react';

interface PlaceRadarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUserNick: string;
  channel: any;
}

const QUICK_PROMPTS = [
  '🍗 Sınırsız Tavuk / Kanat',
  '💻 Prizli & Sessiz Kafe',
  '🌙 02:00 Sonrası Açık',
  '🚗 Parkı Kolay Mekan'
];

export default function PlaceRadarDrawer({ isOpen, onClose, roomId, currentUserNick, channel }: PlaceRadarDrawerProps) {
  const [votingFor, setVotingFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat({
    api: '/api/places/ai-chat',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Selam! Nereye akıyoruz? Bana semti ve ne tarz bir yer aradığını söyle (Örn: Moda\'da sakin kahveci, Kadıköy sınırsız tavuk).'
      }
    ]
  }) as any;

  // Mobil Scroll Kilidi
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.history.pushState({ modal: 'radar' }, '');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handlePopState = () => { if (isOpen) onClose(); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, onClose]);

  // Otomatik aşağı kaydırma
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleVote = async (place: any) => {
    setVotingFor(place.place_id);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'place_vote_start',
        payload: {
          place: place,
          started_by: currentUserNick,
          expires_at: Date.now() + 60000
        }
      });
    }
    try {
      await supabase.from('place_votes').insert({
        room_id: roomId,
        place_name: place.name,
        place_address: place.district,
        voters: [currentUserNick],
        votes_count: 1
      });
    } catch (e) {}

    setTimeout(() => {
      setVotingFor(null);
      alert('Oylama masaya gönderildi! (60s)');
    }, 1000);
  };

  const handleQuickPrompt = (prompt: string) => {
    append({ role: 'user', content: prompt });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => window.history.back()}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.y > 100 || velocity.y > 500) window.history.back();
            }}
            className="relative h-[85vh] w-full bg-[#090A0F] border-t border-white/10 rounded-t-[32px] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>

            <div className="px-5 pb-3 flex items-center justify-between border-b border-white/5">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#CCFF00]" />
                MASA GURMESİ (AI)
              </h2>
              <button onClick={() => window.history.back()} className="p-1.5 rounded-full bg-white/5 text-neutral-400 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 custom-scrollbar pb-32">
              {messages.map((m: any) => (
                <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {m.content && (
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.role === 'user' 
                        ? 'bg-[#CCFF00] text-black font-medium rounded-tr-sm' 
                        : 'bg-white/10 text-neutral-200 border border-white/10 rounded-tl-sm'
                    }`}>
                      {m.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 mb-1 opacity-70">
                          <Bot className="w-3 h-3" />
                          <span className="text-[10px] font-bold">Gurme</span>
                        </div>
                      )}
                      {m.content}
                    </div>
                  )}

                  {/* Render Tool Invocations (Places) */}
                  {m.toolInvocations?.map((toolInvocation: any) => {
                    if (toolInvocation.toolName === 'show_places' && 'result' in toolInvocation) {
                      const places = toolInvocation.result;
                      return (
                        <div key={toolInvocation.toolCallId} className="w-full mt-3 space-y-3">
                          {places.map((place: any, idx: number) => (
                            <div key={place.place_id || idx} className="bg-[#12151F] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-md w-full max-w-[90%]">
                              <div className="p-3 space-y-2">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-bold text-white text-sm line-clamp-1 flex-1 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-[#CCFF00]" />
                                    {place.name}
                                  </h4>
                                  <div className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-300 border border-amber-300/20 flex items-center gap-1 shrink-0">
                                    <Star className="w-3 h-3 fill-amber-300" />
                                    {place.rating}
                                  </div>
                                </div>
                                
                                <p className="text-xs text-neutral-400 italic">"{place.reason}"</p>
                                
                                <div className="flex flex-wrap gap-2 text-[10px] font-mono text-neutral-400">
                                  <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                                    📍 {place.district}
                                  </span>
                                  {place.parking_note && (
                                    <span className="flex items-center gap-1 bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">
                                      <Car className="w-3 h-3" /> {place.parking_note}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex gap-2 pt-1 mt-1 border-t border-white/5">
                                  <button 
                                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.district)}`, '_blank')}
                                    className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-white/10"
                                  >
                                    <Navigation className="w-3 h-3" /> Harita
                                  </button>
                                  <button 
                                    onClick={() => handleVote(place)}
                                    disabled={votingFor === place.place_id}
                                    className="flex-[1.5] py-1.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                                  >
                                    {votingFor === place.place_id ? (
                                      <span className="animate-pulse">Gönderiliyor...</span>
                                    ) : (
                                      <>
                                        <Vote className="w-3 h-3" /> Masaya Oylat
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    } else if (toolInvocation.toolName === 'show_places') {
                      return (
                        <div key={toolInvocation.toolCallId} className="mt-2 text-[#CCFF00] text-xs flex items-center gap-1.5 animate-pulse">
                          <Sparkles className="w-3 h-3" /> Mekanlar aranıyor...
                        </div>
                      );
                    }
                  })}
                </div>
              ))}
              
              {isLoading && messages[messages.length-1]?.role === 'user' && (
                <div className="text-neutral-500 text-xs flex items-center gap-1.5 animate-pulse">
                  <Bot className="w-3 h-3" /> Gurme yazıyor...
                </div>
              )}
            </div>

            {/* Input Alanı Sabit Alt Kısım */}
            <div className="absolute bottom-0 left-0 right-0 bg-[#090A0F] border-t border-white/10 p-4 pb-8">
              {messages.length <= 1 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-1">
                  {QUICK_PROMPTS.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickPrompt(qp)}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-neutral-300 hover:bg-[#CCFF00]/10 hover:text-[#CCFF00] transition"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Örn: Sınırsız tavukçu, sessiz teras kafe..."
                  className="w-full bg-black/50 border border-white/15 rounded-2xl pl-4 pr-12 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#CCFF00] transition"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 p-2 rounded-xl bg-[#CCFF00] text-black disabled:opacity-30 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
