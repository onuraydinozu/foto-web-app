'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  createdAt?: string;
  uploadLockedAt?: string;
  roomId?: string;
  onExpire?: () => void;
  className?: string;
}

export default function CountdownTimer({
  createdAt,
  uploadLockedAt,
  roomId,
  onExpire,
  className = '',
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('Hesaplanıyor...');
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    if (!createdAt) return;

    const calculate = () => {
      const created = new Date(createdAt).getTime();
      const isLegacy = created < new Date('2026-10-08T12:49:00Z').getTime();
      const expires = !isLegacy && uploadLockedAt
        ? new Date(uploadLockedAt).getTime()
        : created + 48 * 60 * 60 * 1000;
      const diff = expires - Date.now();

      // Süresiz Kontrolü (10 yıldan fazla)
      if (diff > 10 * 365 * 24 * 3600 * 1000) {
        setTimeLeft('Süresiz ♾️');
        setIsWarning(false);
        return false;
      }

      if (diff <= 0) {
        setTimeLeft('SÜRE DOLDU');
        setIsWarning(true);
        if (onExpire) onExpire();
        return false;
      }

      // Kalan süreyi formatla
      const days = Math.floor(diff / (24 * 3600 * 1000));
      const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
      const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
      const secs = Math.floor((diff % (60 * 1000)) / 1000);

      const pad = (n: number) => String(n).padStart(2, '0');

      let str = '';
      if (days > 0) {
        str = `${days}g ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
      } else {
        str = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
      }

      setTimeLeft(str);
      setIsWarning(diff < 2 * 3600 * 1000); // Son 2 saat kala uyarı rengi
      return true;
    };

    // İlk hesaplama
    const shouldContinue = calculate();
    if (!shouldContinue) return;

    // Sadece bu küçük bileşenin içinde çalışan izole sayaç
    const interval = setInterval(() => {
      const cont = calculate();
      if (!cont) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt, uploadLockedAt, onExpire]);

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] sm:text-xs font-mono font-black shrink-0 transition-colors ${
        isWarning
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
          : 'bg-[#FF2E93]/15 border-[#FF2E93]/35 text-[#FF2E93]'
      } ${className}`}
    >
      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
      <span>{timeLeft}</span>
    </div>
  );
}
