'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Clock, Download, Share2, Flame, Sparkles, Check, Camera } from 'lucide-react';
import confetti from 'canvas-confetti';

interface VibePhoto {
  id: string;
  r2_file_key: string;
  original_name?: string;
  uploaded_by: string;
  taken_at?: string;
  is_late?: boolean;
}

interface VibeCheckShowcaseProps {
  vibeCheck: {
    id: string;
    initiated_by: string;
    started_at: string;
    expires_at: string;
  };
  photos: VibePhoto[];
  capsuleName: string;
  getMediaUrl: (key: string) => string;
  onTakePhoto: () => void;
  isActive: boolean;
}

export default function VibeCheckShowcase({
  vibeCheck,
  photos,
  capsuleName,
  getMediaUrl,
  onTakePhoto,
  isActive,
}: VibeCheckShowcaseProps) {
  const [downloading, setDownloading] = useState(false);

  const startDate = new Date(vibeCheck.started_at);
  const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 9:16 STORY FORMATINDA KOLAJ ÇİZİP İNDİRME (CANVAS)
  const handleDownloadStoryCollage = async () => {
    if (photos.length === 0) {
      alert('Henüz Vibe Check fotoğrafı yok!');
      return;
    }

    setDownloading(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas yüklenemedi');

      // 1. Arka Plan: Koyu Gece & Neon Ambient
      const grad = ctx.createLinearGradient(0, 0, 0, 1920);
      grad.addColorStop(0, '#0A0C14');
      grad.addColorStop(0.5, '#121524');
      grad.addColorStop(1, '#08090E');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1920);

      // Üst neon ışıma
      const glowGrad = ctx.createRadialGradient(540, 200, 50, 540, 200, 600);
      glowGrad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, 1080, 800);

      // 2. Üst Başlık (Header)
      ctx.fillStyle = '#FF4444';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 ANLIK VIBE CHECK 🚨', 540, 140);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText(capsuleName || "SnapRoom Kapsülü", 540, 220);

      ctx.fillStyle = '#CCFF00';
      ctx.font = 'bold 32px monospace';
      ctx.fillText(`Saat: ${timeStr} • @${vibeCheck.initiated_by} Ateşledi`, 540, 280);

      // 3. Fotoğrafları Yükle ve Çiz
      const loadedImagesResults = await Promise.all(
        photos.slice(0, 6).map((photo, i) => {
          return new Promise<{ img: HTMLImageElement; photo: VibePhoto } | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve({ img, photo });
            img.onerror = () => resolve(null);
            img.src = getMediaUrl(photo.r2_file_key);
          });
        })
      );
      const validItems = loadedImagesResults.filter(Boolean) as { img: HTMLImageElement; photo: VibePhoto }[];
      if (validItems.length === 0) throw new Error('Fotoğraflar indirilemedi');

      // Izgara Düzeni (Grid Layout)
      const count = validItems.length;
      let rows = count <= 2 ? 1 : count <= 4 ? 2 : 3;
      let cols = count === 1 ? 1 : 2;

      const gridTop = 360;
      const gridHeight = 1350;
      const gap = 30;

      const cellW = (1080 - 80 - gap * (cols - 1)) / cols;
      const cellH = (gridHeight - gap * (rows - 1)) / rows;

      validItems.forEach(({ img, photo: p }, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);

        const x = 40 + col * (cellW + gap);
        const y = gridTop + row * (cellH + gap);

        // Polaroid Çerçeve Arka Planı
        ctx.fillStyle = '#1B1F2E';
        ctx.beginPath();
        ctx.roundRect(x, y, cellW, cellH, 24);
        ctx.fill();

        // Fotoğrafı Çiz (Center Crop)
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x + 10, y + 10, cellW - 20, cellH - 70, 16);
        ctx.clip();

        const aspect = img.width / img.height;
        const targetAspect = (cellW - 20) / (cellH - 70);
        let sw, sh, sx, sy;

        if (aspect > targetAspect) {
          sh = img.height;
          sw = sh * targetAspect;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          sw = img.width;
          sh = sw / targetAspect;
          sx = 0;
          sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, x + 10, y + 10, cellW - 20, cellH - 70);
        ctx.restore();

        // Rozet ve Kullanıcı İsmi
        const isLate = p.is_late;
        const uploaderNick = p.uploaded_by.split('__')[0].replace(/^@/, '');

        // İsim
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`@${uploaderNick}`, x + 20, y + cellH - 26);

        // Rozet
        ctx.textAlign = 'right';
        if (isLate) {
          ctx.fillStyle = '#FF9900';
          ctx.font = 'bold 20px monospace';
          ctx.fillText('🐢 Geç Kaldı', x + cellW - 20, y + cellH - 26);
        } else {
          ctx.fillStyle = '#CCFF00';
          ctx.font = 'bold 20px monospace';
          ctx.fillText('⚡ Zamanında', x + cellW - 20, y + cellH - 26);
        }
      });

      // 4. Alt İmza
      ctx.fillStyle = '#666677';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SNAPROOM // 3 DAKİKALIK ANLIK VİBE CHECK RULETİ', 540, 1840);

      // 5. İndir
      const link = document.createElement('a');
      link.download = `vibe-check-${timeStr.replace(':', '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#CCFF00', '#FF2E93', '#FFFFFF'],
      });
    } catch (e: any) {
      alert(`Kolaj oluşturulamadı: ${e?.message || 'Bilinmeyen hata'}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mb-8 rounded-3xl bg-gradient-to-b from-[#161926] to-[#0E1019] border-2 border-red-500/40 p-4 sm:p-6 shadow-[0_0_40px_rgba(239,68,68,0.15)] relative overflow-hidden">
      {/* Üst Vurgu Rozeti */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/50 flex items-center justify-center">
            <Flame className="w-4 h-4 text-red-500 fill-red-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white">
                ⚡ O Anın Vibe&apos;ı
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 font-mono text-[11px] font-bold">
                {timeStr}
              </span>
              {isActive && (
                <span className="px-2 py-0.5 rounded-full bg-[#CCFF00]/20 border border-[#CCFF00]/40 text-[#CCFF00] font-mono text-[10px] font-black animate-pulse">
                  CANLI
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5 font-medium">
              @{vibeCheck.initiated_by} tarafından başlatıldı &bull; {photos.length} kişi kare paylaştı
            </p>
          </div>
        </div>

        {/* Aksiyon Butonları */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTakePhoto}
            className={`py-2 px-3 sm:px-4 rounded-xl font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95 ${
              isActive
                ? 'bg-[#CCFF00] hover:bg-[#b8e600] text-black shadow-[0_0_20px_rgba(204,255,0,0.4)] animate-pulse'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isActive ? '⚡ Anında Çek 📸' : '📸 Sen de Çek'}</span>
          </button>

          {photos.length > 0 && (
            <button
              onClick={handleDownloadStoryCollage}
              disabled={downloading}
              className="py-2 px-3 sm:px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 active:scale-95"
              title="Instagram / WhatsApp Story formatında dikey afiş olarak indir"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>{downloading ? 'Hazırlanıyor...' : 'Kolajı İndir (9:16)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* BENTO / SPLIT GRID IZGARASI */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
          {photos.map((photo) => {
            const rawNick = photo.uploaded_by.split('__')[0].replace(/^@/, '');
            const isLate = photo.is_late;

            return (
              <div
                key={photo.id}
                className="group relative rounded-2xl bg-black/60 border border-white/10 hover:border-white/30 overflow-hidden aspect-[3/4] flex flex-col justify-end p-2.5 transition shadow-lg"
              >
                {/* Fotoğraf */}
                <img
                  src={getMediaUrl(photo.r2_file_key)}
                  alt={`Vibe Check @${rawNick}`}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Karartma Gradyanı */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                {/* Rozet (Üst Sağ) */}
                <div className="absolute top-2 right-2 z-10">
                  {isLate ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-black font-mono font-black text-[9px] shadow-sm">
                      🐢 Geç Kaldı
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#CCFF00] text-black font-mono font-black text-[9px] shadow-[0_0_10px_rgba(204,255,0,0.5)]">
                      ⚡ Tam Zamanında
                    </span>
                  )}
                </div>

                {/* Alt Kullanıcı Etiketi */}
                <div className="relative z-10">
                  <span className="font-bold text-white text-xs truncate drop-shadow-md block">
                    @{rawNick}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div 
          onClick={onTakePhoto}
          className="text-center py-8 px-4 rounded-2xl bg-black/40 border-2 border-dashed border-red-500/40 hover:border-[#CCFF00] text-neutral-300 text-xs cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
        >
          <div className="w-10 h-10 rounded-full bg-red-500/20 group-hover:bg-[#CCFF00]/20 flex items-center justify-center transition">
            <Camera className="w-5 h-5 text-red-400 group-hover:text-[#CCFF00] transition" />
          </div>
          <p className="font-bold text-white text-sm">Henüz Vibe Check karesi gelmedi!</p>
          <p className="text-[11px] text-neutral-400">İlk anlık kareyi basmak için buraya dokun ⚡</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTakePhoto();
            }}
            className="mt-1 px-4 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>⚡ Anında Çek 📸</span>
          </button>
        </div>
      )}
    </div>
  );
}
