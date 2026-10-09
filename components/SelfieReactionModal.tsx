'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, RefreshCw, Sparkles, SwitchCamera, AlertCircle, Check } from 'lucide-react';

export interface SelfieReactionPayload {
  photoId: string;
  userName: string;
  selfieData: string;
  emoji: string;
}

interface SelfieReactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPhoto: {
    id: string;
    original_name?: string;
    uploaded_by?: string;
  } | null;
  currentUserName: string;
  onSubmit: (payload: SelfieReactionPayload) => Promise<void>;
}

const EMOJI_OPTIONS = ['🤪', '🤣', '🔥', '💀', '🫠', '🤡', '✨', '❤️', '👀'];

export default function SelfieReactionModal({
  isOpen,
  onClose,
  targetPhoto,
  currentUserName,
  onSubmit,
}: SelfieReactionModalProps) {
  const [selectedEmoji, setSelectedEmoji] = useState('🤪');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deklanşör ses efekti (Web Audio API ile sıfır harici dosya bağımlılığı)
  const playShutterSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch {}
  }, []);

  // Kamerayı başlat
  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'user') => {
    setCameraError(null);
    setCapturedImage(null);

    // Varsa eski akışı durdur
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tarayıcınız kamera erişimini desteklemiyor.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 480 },
          height: { ideal: 480 },
          aspectRatio: { ideal: 1 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Kamera açma hatası:', err);
      let msg = 'Kameraya erişilemedi. Lütfen izinleri kontrol edin.';
      if (err.name === 'NotAllowedError') {
        msg = 'Kamera izni verilmedi. Ayarlardan izin verin veya dosya seçin.';
      } else if (err.name === 'NotFoundError') {
        msg = 'Cihazda uygun kamera bulunamadı.';
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  }, []);

  // Modal açılıp kapandığında kamera yönetimi
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setCountdown(null);
      startCamera(facingMode);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
      setCapturedImage(null);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, startCamera, facingMode]);

  // Ön/Arka kamera değiştir
  const toggleFacingMode = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    startCamera(next);
  };

  // Fotoğrafı çek ve tam 150x150 piksel olarak WebP/JPEG sıkıştır
  const captureSnapshot = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    playShutterSound();

    const canvas = document.createElement('canvas');
    const size = 150; // Kesin 150x150 px (BeReal / Locket mini sticker boyutu, ~12-15 KB)
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Kare merkezli kırpma hesapla
    const vWidth = video.videoWidth || 480;
    const vHeight = video.videoHeight || 480;
    const minDim = Math.min(vWidth, vHeight);
    const startX = (vWidth - minDim) / 2;
    const startY = (vHeight - minDim) / 2;

    // Ön kamerada ayna efekti (doğal selfie görünümü)
    if (facingMode === 'user') {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, size, size);

    // Hafif WebP (kalite 0.78) veya JPEG çıktısı
    let dataUrl = canvas.toDataURL('image/webp', 0.78);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    }

    setCapturedImage(dataUrl);

    // Canlı akışı dondur
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, [facingMode, playShutterSound]);

  // 3-2-1 Geri sayımla çekim
  const triggerCountdown = () => {
    if (countdown !== null) return;
    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        captureSnapshot();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  // Dosyadan fotoğraf seçme yedeği (Kamera izni engelliyse)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. createImageBitmap ile donanımsal EXIF düzeltmesi
    if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const canvas = document.createElement('canvas');
        const size = 150;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(bitmap.width, bitmap.height);
          const startX = (bitmap.width - minDim) / 2;
          const startY = (bitmap.height - minDim) / 2;
          ctx.drawImage(bitmap, startX, startY, minDim, minDim, 0, 0, size, size);
          bitmap.close();
          const dataUrl = canvas.toDataURL('image/webp', 0.82);
          setCapturedImage(dataUrl);
          setCameraError(null);
          return;
        }
        bitmap.close();
      } catch (err) {}
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 150;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/webp', 0.82);
        setCapturedImage(dataUrl);
        setCameraError(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Tekrar çek
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  // Fotoğrafa yapıştır
  const handleSubmit = async () => {
    if (!capturedImage || !targetPhoto || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSubmit({
        photoId: targetPhoto.id,
        userName: currentUserName || 'Anonim',
        selfieData: capturedImage,
        emoji: selectedEmoji,
      });
      onClose();
    } catch (err) {
      console.error('Selfie reaksiyon yükleme hatası:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm rounded-[32px] bg-[#12151F]/95 p-6 text-center border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden"
        >
          {/* Üst Kapatma Butonu */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-neutral-400 hover:text-white hover:bg-white/20 transition cursor-pointer z-20"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Dairesel Kamera Vizörü (Locket Style Circular Viewfinder) */}
          <div className="relative mx-auto mt-2 mb-4 w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden border-4 border-white/25 ring-4 ring-black/60 shadow-[0_0_35px_rgba(204,255,0,0.2)] bg-black flex items-center justify-center">
            {/* Canlı Video Akışı */}
            {!capturedImage && (
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />
            )}

            {/* Çekilen Dondurulmuş Fotoğraf */}
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Canlı Selfie Reaksiyonu"
                className="w-full h-full object-cover"
              />
            )}

            {/* Geri Sayım Animasyonu */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
                <motion.span
                  key={countdown}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1.2, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  className="font-black text-6xl text-[#CCFF00] drop-shadow-[0_0_20px_rgba(204,255,0,0.8)]"
                >
                  {countdown}
                </motion.span>
              </div>
            )}

            {/* Seçili Emoji Rozeti (Vizör üstünde canlı önizleme) */}
            <div className="absolute bottom-2 right-6 bg-black/70 backdrop-blur-md rounded-full px-2 py-0.5 text-base border border-white/20 shadow-lg pointer-events-none">
              {selectedEmoji}
            </div>

            {/* Kamera Hatası / İzin Uyarısı */}
            {cameraError && !capturedImage && (
              <div className="absolute inset-0 bg-neutral-900/95 p-4 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
                <p className="text-[11px] text-neutral-300 font-semibold leading-relaxed">
                  {cameraError}
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
                >
                  Galeriden Yükle 📁
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Başlık ve İroni */}
          <div className="mb-3">
            <h3 className="text-lg font-black text-white flex items-center justify-center gap-1.5">
              <span>İfadenle Tepki Ver!</span>
              <span className="text-xl">{selectedEmoji}</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {capturedImage
                ? 'İfaden hazır! Fotoğrafın köşesine iliştir.'
                : 'Ön kameraya bak ve anlık suratını bas!'}
            </p>
          </div>

          {/* Mini Emoji Şeridi */}
          <div className="flex items-center justify-center gap-1.5 mb-5 flex-wrap">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setSelectedEmoji(emoji)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-transform cursor-pointer ${
                  selectedEmoji === emoji
                    ? 'bg-white/20 scale-125 border border-[#CCFF00] shadow-[0_0_10px_rgba(204,255,0,0.4)]'
                    : 'hover:bg-white/10 hover:scale-110 opacity-70'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Kontrol Butonları */}
          {!capturedImage ? (
            <div className="flex items-center justify-center gap-4">
              {/* Kamera Çevir (Varsa) */}
              <button
                onClick={toggleFacingMode}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 flex items-center justify-center transition cursor-pointer"
                title="Kamerayı Çevir"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>

              {/* Deklanşör Butonu (iOS Kamera Şekli) */}
              <button
                onClick={captureSnapshot}
                className="w-16 h-16 rounded-full border-4 border-white p-1 hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] flex items-center justify-center cursor-pointer group"
                title="Fotoğraf Çek"
              >
                <div className="w-full h-full rounded-full bg-white group-active:scale-90 transition-transform" />
              </button>

              {/* 3sn Geri Sayımlı Çekim */}
              <button
                onClick={triggerCountdown}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-[#CCFF00] font-black text-xs flex items-center justify-center transition cursor-pointer"
                title="3 Saniye Sayaçla Çek"
              >
                3s ⏱️
              </button>
            </div>
          ) : (
            /* Fotoğraf Çekildikten Sonraki Onay Barı (Mockuptaki Gibi) */
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleRetake}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tekrar Çek 🔄</span>
              </button>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-2xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-[0_0_25px_rgba(255,255,255,0.25)] transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Yapıştır! 🚀</span>
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
