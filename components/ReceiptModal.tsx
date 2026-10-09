'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, Receipt, Sparkles, Check, Flame, Trophy, Ghost, Moon, Sun, Music, MapPin } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  capsuleName: string;
  roomShortId: string;
  createdAt: string;
  uploadLockedAt?: string;
  photos: any[];
  reactions: Record<string, string[]>;
  spotifyUrl?: string;
  parsePhotoUploader: (raw: string) => { nick: string; city: string | null; device: string | null; display: string };
  vibeChecks?: any[];
}

export default function ReceiptModal({
  isOpen,
  onClose,
  capsuleName,
  roomShortId,
  createdAt,
  photos,
  reactions,
  spotifyUrl,
  parsePhotoUploader,
  vibeChecks = [],
}: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // 1. Dinamik Fatura Metriklerini Hesapla
  const metrics = React.useMemo(() => {
    if (!photos || photos.length === 0) {
      return {
        cashier: 'Yok',
        cashierCount: 0,
        ghost: 'Yok',
        ghostCount: 0,
        firstShot: { nick: '-', time: '-' },
        lastShot: { nick: '-', time: '-' },
        topFlame: { count: 0, nick: '-' },
        topChaos: { count: 0, nick: '-' },
        vibeScore: '0/0',
        totalMedia: 0,
        musicTitle: spotifyUrl ? 'Canlı Çalma Listesi' : 'Sessiz Kaos',
        cities: [] as string[],
      };
    }

    // Kullanıcı fotoğraf sayıları
    const uploaderCounts: Record<string, number> = {};
    const citiesSet = new Set<string>();

    photos.forEach((p) => {
      const parsed = parsePhotoUploader(p.uploaded_by);
      const nick = parsed.nick;
      uploaderCounts[nick] = (uploaderCounts[nick] || 0) + 1;
      if (parsed.city) citiesSet.add(parsed.city);
    });

    const sortedUsers = Object.entries(uploaderCounts).sort((a, b) => b[1] - a[1]);
    const cashier = sortedUsers[0] ? sortedUsers[0][0] : 'Anonim';
    const cashierCount = sortedUsers[0] ? sortedUsers[0][1] : 0;
    const ghost = sortedUsers.length > 1 ? sortedUsers[sortedUsers.length - 1][0] : sortedUsers[0]?.[0] || 'Kimse';
    const ghostCount = sortedUsers.length > 1 ? sortedUsers[sortedUsers.length - 1][1] : cashierCount;

    // İlk ve son kareler (Tarihe göre)
    const sortedByDate = [...photos].sort((a, b) => {
      const tA = new Date(a.taken_at || a.created_at).getTime();
      const tB = new Date(b.taken_at || b.created_at).getTime();
      return tA - tB;
    });

    const first = sortedByDate[0];
    const last = sortedByDate[sortedByDate.length - 1];

    const firstShot = {
      nick: first ? parsePhotoUploader(first.uploaded_by).nick : '-',
      time: first ? new Date(first.taken_at || first.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
    };

    const lastShot = {
      nick: last ? parsePhotoUploader(last.uploaded_by).nick : '-',
      time: last ? new Date(last.taken_at || last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
    };

    // Reaksiyon Rekorları
    let maxFlame = 0;
    let flameNick = '-';
    let maxChaos = 0;
    let chaosNick = '-';

    photos.forEach((p) => {
      const rList = reactions[p.id] || [];
      const flameCount = rList.filter((e) => e === '🔥' || e === '❤️').length;
      const chaosCount = rList.filter((e) => e === '💀' || e === '🤡' || e === '💣').length;

      if (flameCount > maxFlame) {
        maxFlame = flameCount;
        flameNick = parsePhotoUploader(p.uploaded_by).nick;
      }
      if (chaosCount > maxChaos) {
        maxChaos = chaosCount;
        chaosNick = parsePhotoUploader(p.uploaded_by).nick;
      }
    });

    // Vibe Check Skoru
    const totalVibePhotos = photos.filter((p) => p.vibe_check_id || (p.uploaded_by && p.uploaded_by.includes('__VC:'))).length;
    const onTimeVibePhotos = photos.filter((p) => {
      if (p.is_late === false) return true;
      if (p.uploaded_by && p.uploaded_by.includes('__VC:') && p.uploaded_by.includes(':FAST')) return true;
      return false;
    }).length;

    const vibeScore = totalVibePhotos > 0 ? `${onTimeVibePhotos}/${totalVibePhotos}` : 'Henüz Yok';

    // Şarkı
    let musicTitle = 'Sessiz Kaos 🎧';
    if (spotifyUrl) {
      if (spotifyUrl.includes('spotify.com')) musicTitle = 'Spotify Vibe';
      else if (spotifyUrl.includes('youtube.com') || spotifyUrl.includes('youtu.be')) musicTitle = 'YouTube Sound';
      else musicTitle = 'Masa Radyosu';
    }

    return {
      cashier,
      cashierCount,
      ghost,
      ghostCount,
      firstShot,
      lastShot,
      topFlame: { count: maxFlame, nick: flameNick },
      topChaos: { count: maxChaos, nick: chaosNick },
      vibeScore,
      totalMedia: photos.length,
      musicTitle,
      cities: Array.from(citiesSet),
    };
  }, [photos, reactions, spotifyUrl, parsePhotoUploader]);

  const createdDateStr = React.useMemo(() => {
    try {
      const d = new Date(createdAt);
      return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '09.10.2026 - 16:22';
    }
  }, [createdAt]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  // 2. Fişi Yüksek Çözünürlüklü PNG Olarak İndir (html-to-image dinamik import)
  const handleDownloadReceipt = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);

    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#00000000',
      });

      const link = document.createElement('a');
      link.download = `gunun-faturasi-${roomShortId}.png`;
      link.href = dataUrl;
      link.click();

      const confetti = (await import('canvas-confetti')).default;
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#000000', '#FFFFFF', '#CCFF00', '#FF2E93'],
      });
    } catch (err: any) {
      alert(`Fiş indirilemedi: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Arka Plan Karartması */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative z-10 w-full max-w-sm flex flex-col items-center my-auto py-12"
          >
            {/* KAPAT BUTONU */}
            <button
              onClick={onClose}
              className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* ========================================================
                TERMAL KASA FİŞİ KARTI (RECEIPTIFY STİLİ)
               ======================================================== */}
            <div
              ref={receiptRef}
              className="w-full bg-[#FAF9F5] text-black font-mono shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-6 sm:p-7 relative select-none rounded-sm border border-neutral-300"
              style={{
                filter: 'drop-shadow(0 15px 35px rgba(0,0,0,0.6))',
              }}
            >
              {/* Tırtıklı Üst Kenar Deseni */}
              <div 
                className="absolute top-0 inset-x-0 h-2 bg-[#FAF9F5]" 
                style={{
                  clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%, 100% 100%, 0% 100%)',
                  transform: 'translateY(-100%)',
                }}
              />

              {/* FİŞ BAŞLIĞI */}
              <div className="text-center space-y-1 mb-4">
                <p className="text-[10px] tracking-widest text-neutral-600">========================================</p>
                <h2 className="text-xl font-black tracking-wider uppercase">GÜNÜN FATURASI</h2>
                <p className="text-xs font-bold text-neutral-800 tracking-tight truncate max-w-[260px] mx-auto">
                  [{capsuleName.toUpperCase()}]
                </p>
                <p className="text-[10px] text-neutral-600 font-semibold">{createdDateStr}</p>
                <p className="text-[10px] tracking-widest text-neutral-600">========================================</p>
              </div>

              {/* KASİYER & KAPSÜL KODU */}
              <div className="flex items-center justify-between text-xs font-black pb-2 border-b border-dashed border-black/40 mb-3">
                <span>KASİYER: @{metrics.cashier}</span>
                <span>KAPSÜL: #{roomShortId}</span>
              </div>

              {/* TABLO BAŞLIĞI */}
              <div className="flex items-center justify-between text-[11px] font-black pb-1 border-b border-black text-neutral-700 mb-2">
                <span>ÜRÜN / KALEM</span>
                <span>MİKTAR</span>
              </div>

              {/* KALEMLER LİSTESİ */}
              <div className="space-y-1.5 text-xs text-neutral-900 font-bold mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">TOPLAM KARE</span>
                  <span className="font-mono">{metrics.totalMedia} ADET</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">BAŞ FOTOĞRAFÇI (@{metrics.cashier})</span>
                  <span className="font-mono">{metrics.cashierCount} KARE</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">HAYALET ÜYE (@{metrics.ghost})</span>
                  <span className="font-mono">{metrics.ghostCount} KARE</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">İLK SİFTAH ({metrics.firstShot.time})</span>
                  <span className="font-mono">@{metrics.firstShot.nick}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">GECE KUŞU ({metrics.lastShot.time})</span>
                  <span className="font-mono">@{metrics.lastShot.nick}</span>
                </div>

                {metrics.topFlame.count > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-700">GÜNÜN ALEVİ (@{metrics.topFlame.nick})</span>
                    <span className="font-mono">🔥 {metrics.topFlame.count}</span>
                  </div>
                )}

                {metrics.topChaos.count > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-700">GÜNÜN KAOSU (@{metrics.topChaos.nick})</span>
                    <span className="font-mono">💀 {metrics.topChaos.count}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">VİBE CHECK SKORU</span>
                  <span className="font-mono">{metrics.vibeScore}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">FONDA ÇALAN</span>
                  <span className="font-mono truncate max-w-[140px] text-right">{metrics.musicTitle}</span>
                </div>

                {metrics.cities.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-700">KAPSAMA ALANI</span>
                    <span className="font-mono text-right">{metrics.cities.join(' ↔ ')}</span>
                  </div>
                )}
              </div>

              {/* ARA TOPLAM & VERGİ */}
              <div className="pt-2 border-t border-dashed border-black/40 space-y-1 text-xs font-black mb-3">
                <div className="flex items-center justify-between">
                  <span>ARA TOPLAM:</span>
                  <span>PAHA BİÇİLEMEZ</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-700">
                  <span>KDV (%0):</span>
                  <span>48H İÇİNDE UÇAR 💣</span>
                </div>
              </div>

              {/* MÜŞTERİ NOTU / SATAŞMA */}
              <div className="p-2 rounded bg-neutral-200/60 border border-neutral-300 text-[10px] text-neutral-800 text-center font-medium italic mb-4 leading-tight">
                &ldquo;Bizi tercih ettiğiniz için teşekkürler. Bir sonraki buluşmada hesabı @{metrics.ghost} ödesin.&rdquo;
              </div>

              {/* BARKOD & QR KOD */}
              <div className="text-center space-y-2 pt-2 border-t border-black">
                {/* Temsili Retro Barkod Çizgileri */}
                <div className="h-10 flex items-center justify-center gap-[2px] overflow-hidden px-4">
                  {[2, 4, 1, 3, 5, 2, 1, 4, 2, 6, 1, 3, 2, 5, 1, 4, 2, 3, 1, 5, 2, 4, 1, 3, 2, 6, 2, 1, 4, 3, 5, 1, 2, 4, 2].map((w, i) => (
                    <div
                      key={i}
                      className="h-full bg-black shrink-0"
                      style={{ width: `${w}px` }}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <div className="p-1 bg-white border border-black rounded shrink-0">
                    <QRCodeSVG value={shareUrl} size={36} />
                  </div>
                  <div className="text-left font-mono">
                    <p className="text-[9px] font-black uppercase">SNAPROOM ARCHIVE</p>
                    <p className="text-[8px] text-neutral-600">TARAYIP KAPSÜLE GİRİN</p>
                  </div>
                </div>

                <p className="text-[10px] font-black tracking-widest text-neutral-800">
                  * TEKRAR BEKLERİZ *
                </p>
              </div>

              {/* Tırtıklı Alt Kenar Deseni */}
              <div 
                className="absolute bottom-0 inset-x-0 h-2 bg-[#FAF9F5]" 
                style={{
                  clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%, 100% 100%, 0% 100%)',
                  transform: 'translateY(100%) rotate(180deg)',
                }}
              />
            </div>

            {/* ========================================================
                ALT İNDİR & PAYLAŞ AKSİYON BUTONLARI
               ======================================================== */}
            <div className="w-full mt-4 flex items-center gap-2">
              <button
                onClick={handleDownloadReceipt}
                disabled={downloading}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_25px_rgba(204,255,0,0.35)] disabled:opacity-50 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'Hazırlanıyor...' : 'Fişi İndir (Story / PNG)'}</span>
              </button>

              <button
                onClick={handleCopyShareLink}
                className="py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0"
                title="Kapsül Bağlantısını Kopyala"
              >
                {copied ? <Check className="w-4 h-4 text-[#CCFF00]" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Kopyalandı' : 'Paylaş'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
