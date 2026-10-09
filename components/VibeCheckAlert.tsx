'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Clock, Camera, Share2, AlertTriangle, X, Check, Zap, Bell, Radio } from 'lucide-react';
import confetti from 'canvas-confetti';

interface VibeCheckAlertProps {
  vibeCheck: {
    id: string;
    initiated_by: string;
    started_at: string;
    expires_at: string;
  } | null;
  onClose: () => void;
  onTakePhoto: () => void;
  shareUrl: string;
}

export function playVibeCheckAudio() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playBeep = (freq: number, startDelay: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + startDelay + duration);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime + startDelay);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startDelay + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startDelay);
      osc.stop(ctx.currentTime + startDelay + duration);
    };

    // 3'lü retro alarm bip sesi
    playBeep(700, 0, 0.15);
    playBeep(850, 0.2, 0.15);
    playBeep(1050, 0.4, 0.25);
  } catch {}

  // Android / Destekleyen Cihazlarda Titreşim
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }
  } catch {}
}

export default function VibeCheckAlert({
  vibeCheck,
  onClose,
  onTakePhoto,
  shareUrl,
}: VibeCheckAlertProps) {
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [copied, setCopied] = useState(false);
  const audioPlayedRef = useRef(false);
  const originalTitleRef = useRef('');

  useEffect(() => {
    if (!vibeCheck) return;

    if (typeof document !== 'undefined') {
      originalTitleRef.current = document.title;
    }

    // Ses ve Titreşim
    if (!audioPlayedRef.current) {
      playVibeCheckAudio();
      audioPlayedRef.current = true;

      // Tarayıcı Native Bildirimi (Eğer İzinliyse)
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('🚨 VİBE CHECK PATLADI!', {
              body: 'Tam şu an ne yapıyorsun? 3 dakikan var, hemen bas!',
              icon: '/favicon.ico',
            });
          } else if (Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }
      } catch {}
    }

    let titleToggle = false;
    const updateTimer = () => {
      const remainingMs = new Date(vibeCheck.expires_at).getTime() - Date.now();
      const secs = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(secs);

      // Sekme Başlığını Dinamik Yanıp Söndür (Başka sekmede bile dikkat çeker)
      if (typeof document !== 'undefined') {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        const timeBadge = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        if (secs > 0) {
          titleToggle = !titleToggle;
          document.title = titleToggle
            ? `🚨 (${timeBadge}) VİBE CHECK! 📸`
            : '💥 FOTOĞRAFI HEMEN BAS!';
        } else {
          document.title = originalTitleRef.current || 'SnapRoom';
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined' && originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    };
  }, [vibeCheck]);

  if (!vibeCheck) return null;

  const isExpired = secondsLeft <= 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // WhatsApp'ı doğrudan aç ve panoya da kopyala (Çift Katmanlı Güvence)
  const handleLaunchWhatsApp = () => {
    const text = `🚨 Masada VİBE CHECK patladı! Tam şu an ne yapıyorsun? Son 3 dakikan var, hemen bas:
${shareUrl}`;
    
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {}

    // Doğrudan WhatsApp Paylaşım API'sini tetikle
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div 
      className="fixed inset-x-0 top-0 z-[100] p-3 sm:p-4 pointer-events-none flex justify-center"
      style={{
        paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))'
      }}
    >
      <motion.div
        initial={{ y: -60, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -60, scale: 0.95, opacity: 0 }}
        className="pointer-events-auto w-full max-w-lg bg-[#0F111A]/95 border-2 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.5)] rounded-3xl p-4 sm:p-5 text-white relative overflow-hidden backdrop-blur-md"
      >
        {/* Yanıp sönen üst neon çizgi */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-red-500 to-[#CCFF00] animate-pulse" />

        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-500/25 border border-red-500/60 flex items-center justify-center animate-bounce shadow-[0_0_15px_rgba(239,68,68,0.4)]">
              <Flame className="w-5 h-5 text-red-500 fill-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-red-400">
                  🚨 ANLIK VIBE CHECK!
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono font-bold">
                  @{vibeCheck.initiated_by} patlattı
                </span>
              </div>
              <p className="text-[11px] text-neutral-300 font-medium">
                Tam şu an ne yapıyorsun? 3 dakikan var!
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (typeof document !== 'undefined' && originalTitleRef.current) {
                document.title = originalTitleRef.current;
              }
              onClose();
            }}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* GERİ SAYIM SAYACI */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/70 border border-white/15 mb-3.5 shadow-inner">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#CCFF00] animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-xs text-neutral-300 font-bold font-mono">GERİ SAYIM:</span>
          </div>

          <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 tracking-widest drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]">
            {isExpired ? 'SÜRE DOLDU' : formattedTime}
          </div>
        </div>

        {/* AKSİYON BUTONLARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* FOTOĞRAF ÇEK BUTONU */}
          <button
            onClick={onTakePhoto}
            className="w-full py-3.5 px-4 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_25px_rgba(204,255,0,0.35)] active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>Kamerayı Aç & Çek 📸</span>
          </button>

          {/* SIFIR SÜRTÜNMELİ WHATSAPP FIRLATICI (HİBRİT ÇÖZÜM) */}
          <button
            onClick={handleLaunchWhatsApp}
            className="w-full py-3.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(37,211,102,0.35)] active:scale-95"
            title="Doğrudan WhatsApp uygulamasını açar ve panik mesajını hazırlar"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>WhatsApp Açılıyor... 🚀</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>WhatsApp Grubuna Ateşle 🚀</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
