'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  X, Check, RotateCcw, Download, Sparkles, Heart, 
  Flame, Layers, ArrowLeft, ArrowRight, FolderDown, RefreshCw, FileDown 
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';

interface SwipeCuratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: any[];
  roomShortId: string;
}

export default function SwipeCuratorModal({
  isOpen,
  onClose,
  photos,
  roomShortId,
}: SwipeCuratorModalProps) {
  // Yalnızca fotoğraf ve videoları ayıkla (sesli notlar hariç)
  const filterablePhotos = useMemo(() => {
    return photos.filter(
      (p) =>
        !p.original_name?.startsWith('Sesli Anı') &&
        !/\.(webm|mp3|wav|ogg|m4a)$/i.test(p.original_name || p.r2_file_key)
    );
  }, [photos]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState<any[]>([]);
  const [history, setHistory] = useState<{ photo: any; action: 'keep' | 'pass' }[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [isDirectDownloading, setIsDirectDownloading] = useState(false);
  const [directProgress, setDirectProgress] = useState(0);

  // Kartı programatik olarak fırlatma yönü ('left' | 'right' | null)
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  // Modal açıldığında sıfırla
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setSelectedPhotos([]);
      setHistory([]);
      setExitDirection(null);
    }
  }, [isOpen]);

  const currentPhoto = filterablePhotos[currentIndex];
  const isFinished = currentIndex >= filterablePhotos.length;

  const getMediaUrl = (fileKey: string) => `/api/media?key=${encodeURIComponent(fileKey)}`;

  // Sağa (Seç / Kaydet) veya Sola (Pas) Kaydırma
  const handleSwipe = (action: 'keep' | 'pass') => {
    if (!currentPhoto) return;

    if (action === 'keep') {
      setSelectedPhotos((prev) => [...prev, currentPhoto]);
    }

    setHistory((prev) => [...prev, { photo: currentPhoto, action }]);
    setExitDirection(action === 'keep' ? 'right' : 'left');

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setExitDirection(null);
    }, 200);
  };

  // Son Hareketi Geri Al (Undo)
  const handleUndo = () => {
    if (history.length === 0 || currentIndex === 0) return;

    const lastAction = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));

    if (lastAction.action === 'keep') {
      setSelectedPhotos((prev) => prev.filter((p) => p.id !== lastAction.photo.id));
    }

    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  // Baştan Başla
  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedPhotos([]);
    setHistory([]);
    setExitDirection(null);
  };

  // Klavye Kontrolleri (Ok Tuşları & Backspace & Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) {
        if (e.key === 'Escape') onClose();
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipe('keep');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipe('pass');
      } else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, isFinished, history]);

  // Kürasyon Bittiğinde Konfeti Yağdır
  useEffect(() => {
    if (isFinished && filterablePhotos.length > 0 && selectedPhotos.length > 0) {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.35 },
        colors: ['#CCFF00', '#FF2E93', '#FFFFFF'],
      });
    }
  }, [isFinished]);

  // Seçilenleri ZIP Olarak İndir
  const handleDownloadCuratedZip = async () => {
    if (!selectedPhotos.length || isZipping) return;
    setIsZipping(true);
    setZipProgress(0);

    const zip = new JSZip();
    const folder = zip.folder(`kapsul-${roomShortId}-kurasyn`);

    try {
      let completed = 0;
      for (const photo of selectedPhotos) {
        try {
          const res = await fetch(getMediaUrl(photo.r2_file_key));
          if (res.ok) {
            const blob = await res.blob();
            folder?.file(photo.original_name, blob);
          }
        } catch (e) {
          console.error('Fotoğraf indirilemedi:', photo.original_name);
        } finally {
          completed++;
          setZipProgress(Math.round((completed / selectedPhotos.length) * 100));
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `kapsul-${roomShortId}-secilenler-${selectedPhotos.length}.zip`);
      
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.4 },
      });
    } catch (err) {
      alert('ZIP paketi hazırlanırken bir hata oluştu.');
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  };

  // Seçilenleri İndir (Mobilde Galeriye Kaydet / ZIP, Masaüstünde Kayıpsız İndir)
  const handleDownloadDirectPhotos = async () => {
    if (!selectedPhotos.length || isDirectDownloading) return;

    // Tek bir fotoğraf seçildiyse doğrudan kayıpsız indir
    if (selectedPhotos.length === 1) {
      const photo = selectedPhotos[0];
      const downloadUrl = `${getMediaUrl(photo.r2_file_key)}&download=1&filename=${encodeURIComponent(photo.original_name || 'foto.jpg')}`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = photo.original_name || 'foto.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const isMobile = typeof window !== 'undefined' && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent)));

    // Mobilde: Tarayıcılar döngüsel çoklu dosya indirmeyi güvenlik nedeniyle engeller (sadece 1 tanesini indirir).
    // Bu yüzden mobilde:
    // 1) Web Share API ile doğrudan telefonun "Görselleri Galeriye Kaydet" menüsünü açar
    // 2) Ya da tek paket ZIP olarak tüm fotoğrafları eksiksiz teslim eder
    if (isMobile) {
      if (typeof navigator !== 'undefined' && (navigator as any).canShare) {
        try {
          setIsDirectDownloading(true);
          setDirectProgress(10);
          const files: File[] = [];
          for (let i = 0; i < selectedPhotos.length; i++) {
            const p = selectedPhotos[i];
            const res = await fetch(getMediaUrl(p.r2_file_key));
            const blob = await res.blob();
            files.push(new File([blob], p.original_name || `foto-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' }));
            setDirectProgress(Math.round(((i + 1) / selectedPhotos.length) * 85));
          }
          if ((navigator as any).canShare({ files })) {
            setDirectProgress(100);
            await (navigator as any).share({
              files,
              title: `Seçilen Fotoğraflar (${selectedPhotos.length})`,
            });
            setIsDirectDownloading(false);
            return;
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setIsDirectDownloading(false);
            return;
          }
        }
      }

      // Web Share yoksa veya iptal edildiyse: Güvenli tek paket ZIP ile tüm fotoğrafları eksiksiz indir
      handleDownloadCuratedZip();
      return;
    }

    // Masaüstünde: Tarayıcı çoklu indirmeye izin verdiği için sırayla indir
    setIsDirectDownloading(true);
    setDirectProgress(0);

    try {
      for (let i = 0; i < selectedPhotos.length; i++) {
        const photo = selectedPhotos[i];
        const downloadUrl = `${getMediaUrl(photo.r2_file_key)}&download=1&filename=${encodeURIComponent(photo.original_name || 'foto.jpg')}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = photo.original_name || 'foto.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setDirectProgress(Math.round(((i + 1) / selectedPhotos.length) * 100));

        if (i < selectedPhotos.length - 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }

      confetti({
        particleCount: 50,
        spread: 80,
        origin: { y: 0.4 },
        colors: ['#CCFF00', '#FF2E93', '#FFFFFF'],
      });
    } catch (e) {
      console.error('Fotoğraflar indirilemedi:', e);
      alert('Fotoğraflar indirilirken bir sorun oluştu.');
    } finally {
      setIsDirectDownloading(false);
      setDirectProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#08090E]/95 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden"
      >
        {/* ÜST BAR */}
        <div className="flex items-center justify-between max-w-lg mx-auto w-full pt-1 sm:pt-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30">
              <Flame className="w-5 h-5 fill-[#CCFF00]" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-white tracking-wide flex items-center gap-1.5">
                Swipe Kuratörü
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF2E93] text-white font-black uppercase">
                  Tinder Modu
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono">
                {isFinished 
                  ? 'Kürasyon Tamamlandı' 
                  : `${currentIndex + 1} / ${filterablePhotos.length} anı inceleniyor`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer backdrop-blur-md"
            title="Kapat (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ORTA KART YIĞINI / BİTİŞ EKRANI */}
        <div className="flex-1 flex items-center justify-center my-2 sm:my-3 relative max-w-sm mx-auto w-full">
          {!isFinished && currentPhoto ? (
            <div className="relative w-full aspect-[3/4] max-h-[58vh] sm:max-h-[66vh] flex items-center justify-center">
              {/* Arka plandaki yedek kartlar (Stack efekti) */}
              {filterablePhotos.slice(currentIndex + 1, currentIndex + 3).map((nextPhoto, i) => (
                <div
                  key={nextPhoto.id}
                  className="absolute inset-0 bg-neutral-900 rounded-3xl overflow-hidden border border-white/10 shadow-xl pointer-events-none transition-transform duration-300"
                  style={{
                    transform: `scale(${1 - (i + 1) * 0.05}) translateY(${(i + 1) * 12}px)`,
                    zIndex: 10 - i,
                    opacity: 0.6 - i * 0.2,
                  }}
                >
                  <img
                    src={getMediaUrl(nextPhoto.r2_file_key)}
                    alt="Next"
                    className="w-full h-full object-cover filter blur-[2px]"
                  />
                </div>
              ))}

              {/* EN ÜSTTEKİ AKTİF SWIPE KARTI */}
              <SwipeCard
                key={currentPhoto.id}
                photo={currentPhoto}
                getMediaUrl={getMediaUrl}
                onSwipe={handleSwipe}
                exitDirection={exitDirection}
              />
            </div>
          ) : (
            /* ========================================================
               BİTİŞ VE ÖZEL ZIP İNDİRME EKRANI
               ======================================================== */
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#12151F] border border-[#CCFF00]/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-[0_0_50px_rgba(204,255,0,0.2)] max-w-sm w-full"
            >
              <div className="w-16 h-16 rounded-3xl bg-[#CCFF00]/15 border border-[#CCFF00]/30 flex items-center justify-center mx-auto text-3xl">
                📸
              </div>

              <div>
                <span className="text-[10px] font-mono font-black text-[#CCFF00] uppercase tracking-widest">
                  KÜRASYON HAZIR
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Kürasyon Tamamlandı! 🎉
                </h3>
                <p className="text-xs text-neutral-300 mt-2">
                  <span className="font-black text-white">{filterablePhotos.length}</span> anı arasından{' '}
                  <span className="font-black text-[#CCFF00]">{selectedPhotos.length}</span> tanesini beğendin!
                </p>
              </div>

              {/* Seçilenlerin Mini Küçük Resim Önizlemesi */}
              {selectedPhotos.length > 0 && (
                <div className="flex items-center justify-center -space-x-2 py-1 overflow-hidden">
                  {selectedPhotos.slice(0, 6).map((sp) => (
                    <img
                      key={sp.id}
                      src={getMediaUrl(sp.r2_file_key)}
                      alt="Thumbnail"
                      className="w-10 h-10 rounded-full object-cover border-2 border-[#12151F] shadow-md"
                    />
                  ))}
                  {selectedPhotos.length > 6 && (
                    <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-[#12151F] flex items-center justify-center text-[10px] font-black text-neutral-300">
                      +{selectedPhotos.length - 6}
                    </div>
                  )}
                </div>
              )}

              {/* İNDİRME VE AKSİYON BUTONLARI */}
              <div className="space-y-2.5 pt-2">
                {selectedPhotos.length > 0 ? (
                  <>
                    {/* 1. ANA / TEMEL BUTON: DOĞRUDAN KAYIPSIZ JPEG / PNG YA DA GALERİYE AKTAR */}
                    <button
                      onClick={handleDownloadDirectPhotos}
                      disabled={isDirectDownloading || isZipping}
                      className="w-full py-4 rounded-2xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_30px_rgba(204,255,0,0.4)] disabled:opacity-50"
                    >
                      <FileDown className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {isDirectDownloading
                          ? `Hazırlanıyor (%${directProgress})...`
                          : `Fotoğrafları Kaydet (${selectedPhotos.length} Adet)`}
                      </span>
                    </button>

                    {/* 2. EKSTRA SEÇENEK: TEK PAKET ZIP İNDİRME */}
                    <button
                      onClick={handleDownloadCuratedZip}
                      disabled={isZipping || isDirectDownloading}
                      className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-neutral-400" />
                      <span>
                        {isZipping 
                          ? `ZIP Paketleniyor (%${zipProgress})...` 
                          : 'Tümünü Tek Pakette İndir (.ZIP)'}
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-neutral-400">
                    Hiçbir fotoğraf seçilmedi.
                  </div>
                )}

                <button
                  onClick={handleRestart}
                  className="w-full py-2.5 rounded-2xl bg-transparent hover:bg-white/5 text-neutral-400 hover:text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Yeniden Seç 🔄</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* ALT KONTROL BUTONLARI */}
        {!isFinished && (
          <div className="max-w-xs mx-auto w-full pb-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-center gap-5">
              {/* ↺ Geri Al Butonu */}
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 text-neutral-300 flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed group"
                title="Geri Al (Z / Backspace)"
              >
                <RotateCcw className="w-5 h-5 group-hover:-rotate-45 transition-transform" />
              </button>

              {/* ❌ Pas Butonu (Sola fırlat) */}
              <button
                onClick={() => handleSwipe('pass')}
                className="w-16 h-16 rounded-full bg-[#FF2E93]/15 hover:bg-[#FF2E93]/25 border-2 border-[#FF2E93] text-[#FF2E93] flex items-center justify-center shadow-[0_0_25px_rgba(255,46,147,0.3)] transition cursor-pointer hover:scale-105 active:scale-95"
                title="Pas (Sol Ok)"
              >
                <X className="w-8 h-8 stroke-[3]" />
              </button>

              {/* 💚 Kaydet / Seç Butonu (Sağa fırlat) */}
              <button
                onClick={() => handleSwipe('keep')}
                className="w-16 h-16 rounded-full bg-[#CCFF00]/15 hover:bg-[#CCFF00]/25 border-2 border-[#CCFF00] text-[#CCFF00] flex items-center justify-center shadow-[0_0_25px_rgba(204,255,0,0.3)] transition cursor-pointer hover:scale-105 active:scale-95"
                title="Kaydet (Sağ Ok)"
              >
                <Heart className="w-8 h-8 fill-[#CCFF00] stroke-[#CCFF00]" />
              </button>
            </div>

            <p className="text-[11px] text-neutral-500 font-mono text-center mt-3">
              Klavye: [←] Pas &bull; [→] Kaydet &bull; [Backspace] Geri Al
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ==========================================
// DRAG DESTEKLİ TEKİL KART BİLEŞENİ
// ==========================================
function SwipeCard({
  photo,
  getMediaUrl,
  onSwipe,
  exitDirection,
}: {
  photo: any;
  getMediaUrl: (key: string) => string;
  onSwipe: (action: 'keep' | 'pass') => void;
  exitDirection: 'left' | 'right' | null;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const keepOpacity = useTransform(x, [30, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, -30], [1, 0]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      onSwipe('keep');
    } else if (info.offset.x < -100) {
      onSwipe('pass');
    }
  };

  const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(photo.original_name || photo.r2_file_key);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      style={{
        x,
        rotate,
      }}
      animate={
        exitDirection === 'right'
          ? { x: 500, opacity: 0, rotate: 25 }
          : exitDirection === 'left'
          ? { x: -500, opacity: 0, rotate: -25 }
          : { x: 0, opacity: 1, rotate: 0 }
      }
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      className="absolute inset-0 z-20 bg-[#12151F] rounded-3xl overflow-hidden border border-white/20 shadow-2xl cursor-grab active:cursor-grabbing flex flex-col touch-none"
    >
      {/* 💚 KAYDET ROZETİ (SAĞA ÇEKİNCE BELİRİR) */}
      <motion.div
        style={{ opacity: keepOpacity }}
        className="absolute top-6 left-6 z-30 px-4 py-1.5 rounded-2xl bg-[#CCFF00] text-black font-black text-sm tracking-wider uppercase border-2 border-white shadow-[0_0_25px_rgba(204,255,0,0.8)] -rotate-12 pointer-events-none"
      >
        KAYDET 💚
      </motion.div>

      {/* ❌ PAS ROZETİ (SOLA ÇEKİNCE BELİRİR) */}
      <motion.div
        style={{ opacity: passOpacity }}
        className="absolute top-6 right-6 z-30 px-4 py-1.5 rounded-2xl bg-[#FF2E93] text-white font-black text-sm tracking-wider uppercase border-2 border-white shadow-[0_0_25px_rgba(255,46,147,0.8)] rotate-12 pointer-events-none"
      >
        PAS ✖️
      </motion.div>

      {/* MEDYA GÖRSELİ */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {isVideo ? (
          <video
            src={getMediaUrl(photo.r2_file_key)}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <img
            src={getMediaUrl(photo.r2_file_key)}
            alt={photo.original_name}
            className="w-full h-full object-cover pointer-events-none"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
      </div>

      {/* ALT KÜNYE (RUMUZ VE ÇEKİM ZAMANI) */}
      <div className="p-4 bg-[#12151F] border-t border-white/10 flex items-center justify-between text-xs">
        <div className="truncate">
          <p className="font-black text-white truncate text-sm">
            @{photo.uploaded_by?.split('__DEV:')[0] || 'Anonim'}
          </p>
          <p className="text-[11px] text-neutral-400 font-mono truncate mt-0.5">
            {photo.original_name}
          </p>
        </div>

        <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300 shrink-0">
          {photo.taken_at
            ? new Date(photo.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Şimdi'}
        </span>
      </div>
    </motion.div>
  );
}
