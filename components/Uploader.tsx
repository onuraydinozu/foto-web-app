'use client';

import { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { UploadCloud, Loader2, Sparkles, AlertCircle, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import exifr from 'exifr';

export interface UploaderHandle {
  openPicker: () => void;
}

interface UploaderProps {
  roomId: string;
  isLocked: boolean;
  isStorageExceeded?: boolean;
  onUploadComplete: () => void;
  onStorageExceeded?: (message: string) => void;
}

const Uploader = forwardRef<UploaderHandle, UploaderProps>(({ 
  roomId, 
  isLocked, 
  isStorageExceeded = false,
  onUploadComplete,
  onStorageExceeded 
}, ref) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openPicker: () => {
      if (isStorageExceeded) {
        onStorageExceeded?.('10 GB ücretsiz depolama kotası dolmak üzere! Sürpriz fatura engellemek için yükleme kilitlendi.');
        return;
      }
      if (isLocked) {
        alert('Bu masa kapanış süresini (24 saat) doldurmuş. Yeni fotoğraf yüklenemez.');
        return;
      }
      fileInputRef.current?.click();
    },
  }));

  const processFiles = async (fileList: FileList | File[]) => {
    if (isStorageExceeded) {
      onStorageExceeded?.('10 GB ücretsiz kota koruma altında! Yeni yükleme yapılamaz.');
      return;
    }
    if (isLocked) {
      alert('Bu masa kapanış süresini doldurmuş. Yalnızca indirebilirsiniz.');
      return;
    }
    const files = Array.from(fileList);
    if (!files.length) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    const nickname = localStorage.getItem('snaproom_nickname') || 'Anonim';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });

      // 1. EXIF Okuma (Apple Galeri Çekim Saati Sıralaması İçin)
      let takenAt = new Date();
      try {
        const exifData = await exifr.parse(file);
        if (exifData?.DateTimeOriginal) {
          takenAt = exifData.DateTimeOriginal;
        }
      } catch (err) {
        // EXIF verisi bulunamadıysa normal tarih
      }

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `${roomId}/${crypto.randomUUID()}-${cleanFileName}`;

      try {
        // 2. HARD CAP KONTROLÜ: Dosya boyutuyla birlikte Pre-signed URL iste
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            filename: fileKey, 
            contentType: file.type || 'image/jpeg',
            fileSize: file.size // Boyut kontrolü için gönderiliyor
          }),
        });

        // 9.5 GB Limiti Aşıldıysa (HTTP 403)
        if (res.status === 403) {
          const errData = await res.json();
          onStorageExceeded?.(errData.message || '10 GB ücretsiz kota dolmak üzere! Yükleme durduruldu.');
          break; // Batch'i durdur
        }

        if (!res.ok) throw new Error('Pre-signed URL alınamadı');
        const { url } = await res.json();

        // 3. DOĞRUDAN CLOUDFLARE R2'YE PUT YÜKLEMESİ (Bypass Server)
        const uploadRes = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file,
        });

        if (!uploadRes.ok) throw new Error('Cloudflare R2 Yükleme Hatası');

        // 4. Supabase DB'ye sadece referans ve EXIF zamanını yaz
        await supabase.from('photos').insert({
          room_id: roomId,
          r2_file_key: fileKey,
          original_name: file.name,
          uploaded_by: nickname,
          taken_at: takenAt,
        });
      } catch (err) {
        console.error('Yükleme hatası:', err);
      }
    }

    setUploading(false);
    onUploadComplete();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const isBlocked = isLocked || isStorageExceeded;

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={uploading || isBlocked}
      />

      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center w-full min-h-[140px] px-6 py-5 rounded-3xl border-2 border-dashed transition-all overflow-hidden ${
          isStorageExceeded
            ? 'border-[#FF2E93]/80 bg-[#FF2E93]/10 cursor-not-allowed shadow-[0_0_30px_rgba(255,46,147,0.15)]'
            : isLocked
            ? 'border-red-900/60 bg-red-950/10 cursor-not-allowed'
            : dragActive
            ? 'border-[#CCFF00] bg-[#CCFF00]/10 scale-[1.01]'
            : 'border-white/10 hover:border-white/20 bg-[#12151F]/60 backdrop-blur-sm cursor-pointer'
        }`}
      >
        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="relative">
                <Loader2 className="w-9 h-9 text-[#CCFF00] animate-spin" />
                <Sparkles className="w-3.5 h-3.5 text-[#FF2E93] absolute -top-1 -right-1" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Kayıpsız Yükleniyor ({uploadProgress.current}/{uploadProgress.total})
                </p>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                  DIRECT TO R2 // 9.5 GB EMNİYET DENETİMİ AKTİF
                </p>
              </div>
              {/* Progress Bar */}
              <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[#CCFF00] transition-all duration-300"
                  style={{
                    width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%`,
                  }}
                />
              </div>
            </motion.div>
          ) : isStorageExceeded ? (
            <motion.div
              key="exceeded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <div className="p-2.5 rounded-2xl bg-[#FF2E93]/20 border border-[#FF2E93]/40 text-[#FF2E93] mb-0.5">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <p className="text-sm font-black text-[#FF2E93]">
                Kasa Doldu! 💣 Ücretsiz Kota Koruma Altında
              </p>
              <p className="text-xs text-neutral-300 max-w-sm leading-relaxed">
                9.5 GB emniyet sınırına ulaşıldı. Sürpriz fatura kesilmemesi için yeni dosya alımı durduruldu.
              </p>
            </motion.div>
          ) : isLocked ? (
            <motion.div
              key="locked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <AlertCircle className="w-8 h-8 text-[#FF2E93]" />
              <p className="text-sm font-bold text-white">Oda Yüklemelere Kapandı</p>
              <p className="text-xs text-neutral-400">
                24 saatlik süre doldu. Yalnızca fotoğrafları indirebilirsiniz.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[#CCFF00] mb-0.5 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-sm font-extrabold text-white">
                Fotoğrafları Buraya Sürükle veya Seç
              </p>
              <p className="text-xs text-neutral-400 flex items-center gap-2">
                <span className="text-[#CCFF00] font-bold">RAW / Orijinal Kalite</span>
                <span>•</span>
                <span>9.5 GB Bekçi Korumalı</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleInputChange}
          disabled={uploading || isBlocked}
        />
      </label>
    </div>
  );
});

Uploader.displayName = 'Uploader';
export default Uploader;
