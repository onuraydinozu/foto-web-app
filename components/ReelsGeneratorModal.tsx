'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, Share2, Play, Pause, Sparkles, 
  Film, Zap, Disc3, Radio, Check, RefreshCw, Volume2, VolumeX, AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ReelsGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: any[];
  capsuleName: string;
  roomShortId: string;
  participants: string[];
  getMediaUrl: (fileKey: string) => string;
  reactions?: Record<string, string[]>;
  location?: string;
}

type VibeMode = 'hyper' | 'y2k' | 'chill';

interface VibeConfig {
  id: VibeMode;
  name: string;
  label: string;
  icon: string;
  bpm: number;
  intervalSec: number;
  description: string;
  tag: string;
}

const VIBE_CONFIGS: Record<VibeMode, VibeConfig> = {
  hyper: {
    id: 'hyper',
    name: '⚡ Hyper / Trap',
    label: '140 BPM',
    icon: '⚡',
    bpm: 140,
    intervalSec: 0.35,
    description: 'Hızlı bas vuruşları, mikro beyaz flaş ve zoom darbeleri',
    tag: 'Partiful & Kaos Vibe',
  },
  y2k: {
    id: 'y2k',
    name: '📼 2000s Digicam',
    label: '105 BPM',
    icon: '📼',
    bpm: 105,
    intervalSec: 0.65,
    description: 'Vintage VHS dokusu, sarı dijital tarih damgası ve retro titreşim',
    tag: 'Nostaljik Indie Vibe',
  },
  chill: {
    id: 'chill',
    name: '☕ Chill Lo-Fi',
    label: '85 BPM',
    icon: '☕',
    bpm: 85,
    intervalSec: 1.2,
    description: 'Yumuşak çapraz erimeler, kenar vinyeti ve sıcak piyano melodisi',
    tag: 'Pazar Kahvesi Vibe',
  },
};

const TOTAL_DURATION_SEC = 10.0;

export default function ReelsGeneratorModal({
  isOpen,
  onClose,
  photos,
  capsuleName,
  roomShortId,
  participants,
  getMediaUrl,
  reactions = {},
  location,
}: ReelsGeneratorModalProps) {
  const [selectedVibe, setSelectedVibe] = useState<VibeMode>('hyper');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [canShare, setCanShare] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(false);

  // Web Share API kontrolü
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !!navigator.share) {
      setCanShare(true);
    }
  }, []);

  // 1. En iyi fotoğrafları seç ve belleğe yükle
  useEffect(() => {
    if (!isOpen) return;

    setIsLoadingImages(true);
    setGeneratedBlob(null);

    // Sesli notları filtrele
    const validPhotos = photos.filter((p) => !p.original_name?.startsWith('Sesli Anı'));

    // En çok reaksiyon alanları öne al, yoksa kronolojik
    const sorted = [...validPhotos].sort((a, b) => {
      const aScore = (reactions[a.id] || []).length;
      const bScore = (reactions[b.id] || []).length;
      return bScore - aScore;
    });

    const chosenPhotos = sorted.slice(0, 18);
    if (chosenPhotos.length === 0) {
      setIsLoadingImages(false);
      return;
    }

    let loadedCount = 0;
    const imgs: HTMLImageElement[] = [];

    chosenPhotos.forEach((photo, idx) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = getMediaUrl(photo.r2_file_key);
      img.onload = () => {
        imgs[idx] = img;
        loadedCount++;
        if (loadedCount === chosenPhotos.length) {
          setLoadedImages(imgs.filter(Boolean));
          setIsLoadingImages(false);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === chosenPhotos.length) {
          setLoadedImages(imgs.filter(Boolean));
          setIsLoadingImages(false);
        }
      };
    });
  }, [isOpen, photos, reactions, getMediaUrl]);

  // 2. Web Audio API Ritim Synthesizer Motoru (Sıfır Harici Dosya Bağımlılığı)
  const setupAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Tekil vuruş sesleri üret
  const triggerBeatSound = useCallback(
    (
      ctx: AudioContext,
      time: number,
      vibe: VibeMode,
      beatIndex: number,
      destNode: AudioNode
    ) => {
      if (isMuted && destNode === ctx.destination) return;

      try {
        if (vibe === 'hyper') {
          // 808 Trap Kick
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(160, time);
          osc.frequency.exponentialRampToValueAtTime(35, time + 0.16);
          gain.gain.setValueAtTime(0.7, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
          osc.connect(gain);
          gain.connect(destNode);
          osc.start(time);
          osc.stop(time + 0.2);

          // Snappy Hi-Hat / Clap
          if (beatIndex % 2 === 1) {
            const bufferSize = ctx.sampleRate * 0.05;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(5000, time);

            const nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0.3, time);
            nGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

            noise.connect(filter);
            filter.connect(nGain);
            nGain.connect(destNode);
            noise.start(time);
          }
        } else if (vibe === 'y2k') {
          // Indie Acoustic Kick & Snare
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(120, time);
          osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
          gain.gain.setValueAtTime(0.6, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.14);
          osc.connect(gain);
          gain.connect(destNode);
          osc.start(time);
          osc.stop(time + 0.15);

          // Retro Synth Chords
          const chordOsc = ctx.createOscillator();
          const chordGain = ctx.createGain();
          chordOsc.type = 'sawtooth';
          const notes = [220, 261.63, 329.63, 392.0]; // A minor 7
          const freq = notes[beatIndex % notes.length];
          chordOsc.frequency.setValueAtTime(freq, time);

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1200, time);

          chordGain.gain.setValueAtTime(0.18, time);
          chordGain.gain.exponentialRampToValueAtTime(0.01, time + 0.35);

          chordOsc.connect(filter);
          filter.connect(chordGain);
          chordGain.connect(destNode);
          chordOsc.start(time);
          chordOsc.stop(time + 0.4);
        } else {
          // Chill Lo-Fi Warm Rhodes Chord
          const chordOsc = ctx.createOscillator();
          const chordGain = ctx.createGain();
          chordOsc.type = 'sine';
          const chillNotes = [261.63, 329.63, 392.0, 493.88]; // C maj 7
          const freq = chillNotes[beatIndex % chillNotes.length];
          chordOsc.frequency.setValueAtTime(freq, time);

          chordGain.gain.setValueAtTime(0.35, time);
          chordGain.gain.exponentialRampToValueAtTime(0.01, time + 0.8);

          chordOsc.connect(chordGain);
          chordGain.connect(destNode);
          chordOsc.start(time);
          chordOsc.stop(time + 0.85);

          // Lo-Fi Sub Kick
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(90, time);
          osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
          gain.gain.setValueAtTime(0.45, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
          osc.connect(gain);
          gain.connect(destNode);
          osc.start(time);
          osc.stop(time + 0.22);
        }
      } catch {}
    },
    [isMuted]
  );

  // 3. Çerçeve Çizici (Canvas Render Loop)
  const drawFrame = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      elapsedSec: number,
      vibe: VibeMode,
      images: HTMLImageElement[]
    ) => {
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const config = VIBE_CONFIGS[vibe];

      if (images.length === 0) {
        ctx.fillStyle = '#0f1117';
        ctx.fillRect(0, 0, width, height);
        return;
      }

      const beatInterval = config.intervalSec;
      const currentBeatIndex = Math.floor(elapsedSec / beatInterval);
      const timeInBeat = elapsedSec % beatInterval;
      const beatRatio = timeInBeat / beatInterval; // 0 to 1

      // Hangi fotoğraf çizilecek?
      // Son 2.5 saniyede grup fotoğrafı sabitlenir (en baştaki fotoğraf)
      const isEnding = elapsedSec >= TOTAL_DURATION_SEC - 2.5;
      const currentPhotoIdx = isEnding
        ? 0
        : currentBeatIndex % images.length;
      const nextPhotoIdx = (currentPhotoIdx + 1) % images.length;

      const currentImg = images[currentPhotoIdx];
      const nextImg = images[nextPhotoIdx];

      // Arka planı temizle
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // --- EFEKT HESAPLARI ---
      ctx.save();

      // Zoom efekti (Hyper'da vuruşta dışarı fırlar, chill'de yavaşça kayar)
      let scale = 1.0;
      let shakeX = 0;
      let shakeY = 0;

      if (vibe === 'hyper') {
        // Vuruşta hafif içe zoom darbesi (1.06 -> 1.00)
        scale = 1.05 - 0.05 * Math.min(1, beatRatio * 2);
      } else if (vibe === 'y2k') {
        // Hafif el kamerası titremesi (Camera Shake)
        shakeX = (Math.sin(elapsedSec * 18) * 4);
        shakeY = (Math.cos(elapsedSec * 22) * 3);
        scale = 1.02;
      } else {
        // Chill: Yavaş Ken Burns zoom
        scale = 1.0 + (elapsedSec % 3.0) * 0.015;
      }

      ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
      ctx.scale(scale, scale);
      ctx.translate(-width / 2, -height / 2);

      // Fotoğrafı Cover (9:16) formatında çiz
      const drawCoverImage = (img: HTMLImageElement, alpha: number = 1.0) => {
        if (!img || !img.width) return;
        ctx.globalAlpha = alpha;
        const imgRatio = img.width / img.height;
        const targetRatio = width / height;

        let sWidth = img.width;
        let sHeight = img.height;
        let sx = 0;
        let sy = 0;

        if (imgRatio > targetRatio) {
          sWidth = img.height * targetRatio;
          sx = (img.width - sWidth) / 2;
        } else {
          sHeight = img.width / targetRatio;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
      };

      if (vibe === 'chill' && beatRatio > 0.75) {
        // Çapraz erime (Crossfade)
        const fadeAlpha = (beatRatio - 0.75) / 0.25;
        drawCoverImage(currentImg, 1.0);
        drawCoverImage(nextImg, fadeAlpha);
      } else {
        drawCoverImage(currentImg, 1.0);
      }

      ctx.restore();

      // --- KATMAN EFEKTLERİ ---
      // 1. Hyper: Mikro beyaz flaş (flash overlay)
      if (vibe === 'hyper' && timeInBeat < 0.09) {
        const flashAlpha = 0.45 * (1 - timeInBeat / 0.09);
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Y2K: Vintage CRT Scanlines, Amber Renk Filtresi
      if (vibe === 'y2k') {
        // Sıcak vintage filtre
        ctx.fillStyle = 'rgba(255, 210, 150, 0.08)';
        ctx.fillRect(0, 0, width, height);

        // Scanlines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        for (let y = 0; y < height; y += 6) {
          ctx.fillRect(0, y, width, 2);
        }
      }

      // 3. Chill: Kenar Vinyeti (Vignette)
      if (vibe === 'chill') {
        const gradient = ctx.createRadialGradient(
          width / 2,
          height / 2,
          width * 0.4,
          width / 2,
          height / 2,
          width * 0.85
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      // --- TİPOGRAFİK REELS / TIKTOK KÜNYELERİ ---
      // Üst Başlık Bloğu (Kapsül Adı + Konum)
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Üst Karartma Gradyanı (Yazıların okunması için)
      const topGrad = ctx.createLinearGradient(0, 0, 0, 220);
      topGrad.addColorStop(0, 'rgba(0,0,0,0.75)');
      topGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, 220);

      // Alt Karartma Gradyanı
      const botGrad = ctx.createLinearGradient(0, height - 260, 0, height);
      botGrad.addColorStop(0, 'rgba(0,0,0,0)');
      botGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, height - 260, width, 260);

      // ⚡ Başlık
      ctx.fillStyle = '#CCFF00';
      ctx.font = '900 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 10;
      ctx.fillText(`⚡ ${capsuleName.toUpperCase()}`, 48, 60);

      // Konum veya Oda Kodu
      ctx.fillStyle = '#E5E7EB';
      ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const locText = location ? `📍 ${location}` : `🏷️ #${roomShortId} • Kapsül`;
      ctx.fillText(locText, 52, 115);

      // Sağ Üst: REC veya BPM Rozeti
      ctx.textAlign = 'right';
      if (vibe === 'y2k') {
        const isBlink = Math.floor(elapsedSec * 2) % 2 === 0;
        ctx.fillStyle = isBlink ? '#EF4444' : '#6B7280';
        ctx.font = '900 24px monospace';
        ctx.fillText('REC ●', width - 48, 65);
        ctx.fillStyle = '#F59E0B';
        ctx.font = '700 20px monospace';
        ctx.fillText("'26 10 09", width - 48, 105);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = '900 20px monospace';
        ctx.fillText(`${config.bpm} BPM`, width - 48, 65);
      }

      // Alt Katılımcı Etiketleri (@onur @selin @efe)
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      const tagText = participants.length > 0
        ? participants.slice(0, 4).map((p) => `@${p.replace(/^@/, '')}`).join('   ')
        : '@kapsül';
      ctx.fillText(tagText, 48, height - 85);

      // Tarih Damgası & Süre Çubuğu
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '700 18px monospace';
      ctx.fillText(
        new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        48,
        height - 50
      );

      // İlerleme Çubuğu (Progress bar en altta)
      const progress = Math.min(1, elapsedSec / TOTAL_DURATION_SEC);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(0, height - 8, width, 8);
      ctx.fillStyle = '#CCFF00';
      ctx.fillRect(0, height - 8, width * progress, 8);

      // Son Saniyelerde Katılımcı Rozetleri Animasyonu (Ending Drop)
      if (isEnding) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        ctx.roundRect(width / 2 - 220, height / 2 - 45, 440, 90, 24);
        ctx.fill();

        ctx.strokeStyle = '#CCFF00';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 32px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('✨ GÜNÜN DÖKÜMÜ', width / 2, height / 2);
      }

      ctx.restore();
    },
    [capsuleName, location, roomShortId, participants]
  );

  // 4. Canlı Önizleme Döngüsü
  const startPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || loadedImages.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const audioCtx = setupAudioContext();
    playbackStartTimeRef.current = performance.now();
    isPlayingRef.current = true;
    setIsPlaying(true);

    const config = VIBE_CONFIGS[selectedVibe];
    let lastBeatIndex = -1;

    const renderLoop = (now: number) => {
      if (!isPlayingRef.current) return;

      const elapsedSec = ((now - playbackStartTimeRef.current) / 1000) % TOTAL_DURATION_SEC;
      const currentBeatIndex = Math.floor(elapsedSec / config.intervalSec);

      // Yeni vuruş geldiyse ses tetikle
      if (currentBeatIndex !== lastBeatIndex) {
        lastBeatIndex = currentBeatIndex;
        triggerBeatSound(
          audioCtx,
          audioCtx.currentTime,
          selectedVibe,
          currentBeatIndex,
          audioCtx.destination
        );
      }

      drawFrame(ctx, elapsedSec, selectedVibe, loadedImages);
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(renderLoop);
  }, [loadedImages, selectedVibe, setupAudioContext, triggerBeatSound, drawFrame]);

  const stopPreview = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Modal açıldığında önizlemeyi başlat
  useEffect(() => {
    if (isOpen && !isLoadingImages && loadedImages.length > 0) {
      startPreview();
    } else {
      stopPreview();
    }
    return () => {
      stopPreview();
    };
  }, [isOpen, isLoadingImages, loadedImages, startPreview, stopPreview]);

  // Vibe modu değiştiğinde önizlemeyi yeniden başlat
  const handleVibeChange = (vibe: VibeMode) => {
    setSelectedVibe(vibe);
    setGeneratedBlob(null);
    if (isPlaying) {
      stopPreview();
      setTimeout(() => startPreview(), 50);
    }
  };

  // 5. 10 Saniyelik MP4/WebM Video Üret ve Dışa Aktar (MediaRecorder API)
  const handleExportVideo = async () => {
    if (isExporting || loadedImages.length === 0) return;

    stopPreview();
    setIsExporting(true);
    setExportProgress(5);

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 1080;
      exportCanvas.height = 1920;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas bağlamı alınamadı.');

      const audioCtx = setupAudioContext();
      const mediaDest = audioCtx.createMediaStreamDestination();

      // Video akışı + Ses akışı
      const canvasStream = exportCanvas.captureStream(30);
      const audioTrack = mediaDest.stream.getAudioTracks()[0];
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioTrack ? [audioTrack] : []),
      ]);

      // Desteklenen MIME tipini tespit et
      let mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8,opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
          }
        }
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8000000, // 8 Mbps yüksek kalite Full HD
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const config = VIBE_CONFIGS[selectedVibe];
      const totalFrames = 30 * TOTAL_DURATION_SEC; // 300 kare
      let frameIndex = 0;
      let lastBeat = -1;

      recorder.start();

      // Zaman senkronlu kare kare render
      const frameIntervalMs = 1000 / 30;
      const recordTimer = setInterval(() => {
        if (frameIndex >= totalFrames) {
          clearInterval(recordTimer);
          recorder.stop();
          return;
        }

        const elapsedSec = frameIndex / 30;
        const currentBeat = Math.floor(elapsedSec / config.intervalSec);

        // Vuruş sesini ses kanalına yaz
        if (currentBeat !== lastBeat) {
          lastBeat = currentBeat;
          triggerBeatSound(
            audioCtx,
            audioCtx.currentTime,
            selectedVibe,
            currentBeat,
            mediaDest
          );
        }

        drawFrame(ctx, elapsedSec, selectedVibe, loadedImages);
        frameIndex++;

        // İlerleme yüzdesi
        const pct = Math.round((frameIndex / totalFrames) * 90) + 5;
        setExportProgress(pct);
      }, frameIntervalMs);

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        setGeneratedBlob(finalBlob);
        setIsExporting(false);
        setExportProgress(100);

        // Otomatik indirmeyi tetikle
        const fileName = `${capsuleName.toLowerCase().replace(/[^a-z0-9]/gi, '_')}-reels.${
          mimeType.includes('mp4') ? 'mp4' : 'webm'
        }`;
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#CCFF00', '#FF2E93', '#FFFFFF'],
        });

        // Önizlemeyi geri başlat
        startPreview();
      };
    } catch (err) {
      console.error('Video üretme hatası:', err);
      setIsExporting(false);
      startPreview();
    }
  };

  // 6. Web Share API ile Doğrudan Instagram / TikTok Menüsünü Aç
  const handleShareDirectly = async () => {
    if (!generatedBlob) {
      // Önce videoyu üret
      await handleExportVideo();
      return;
    }

    try {
      const ext = generatedBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File(
        [generatedBlob],
        `${capsuleName.toLowerCase().replace(/[^a-z0-9]/gi, '_')}-reels.${ext}`,
        { type: generatedBlob.type }
      );

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `⚡ ${capsuleName} Reels Özeti`,
          text: `Günün dökümü tek karede! 🚀 #kapsül #${roomShortId}`,
        });
      } else {
        alert('Bu cihazda doğrudan dosya paylaşımı desteklenmiyor. Video dosyanız indirildi!');
      }
    } catch (shareErr) {
      console.warn('Paylaşım iptal edildi veya desteklenmiyor:', shareErr);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md rounded-[32px] bg-[#12151F] border border-white/20 p-5 sm:p-6 shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#CCFF00]/15 border border-[#CCFF00]/30 flex items-center justify-center text-[#CCFF00]">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-1.5">
                  <span>⚡ 10S REELS GENERATOR</span>
                </h3>
                <p className="text-[10px] text-neutral-400 font-mono">
                  Beat-Sync TikTok & Instagram Video Motoru
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                stopPreview();
                onClose();
              }}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Orta Alan (Scrollable): 9:16 Önizleme ve Kontroller */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-0.5">
            {/* 9:16 DİKEY TELEFON ÖNİZLEME VİZÖRÜ */}
            <div className="relative mx-auto w-[210px] h-[373px] sm:w-[230px] sm:h-[410px] rounded-2xl overflow-hidden border-2 border-white/20 shadow-[0_0_35px_rgba(204,255,0,0.15)] bg-black shrink-0 group">
              <canvas
                ref={canvasRef}
                width={1080}
                height={1920}
                className="w-full h-full object-cover"
              />

              {/* Yükleniyor Göstergesi */}
              {isLoadingImages && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-4">
                  <RefreshCw className="w-8 h-8 text-[#CCFF00] animate-spin mb-2" />
                  <p className="text-xs font-bold text-white">Anılar Ritme Hazırlanıyor...</p>
                </div>
              )}

              {/* Önizleme Play / Pause & Mute Kontrolleri */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => (isPlaying ? stopPreview() : startPreview())}
                  className="p-2 rounded-full bg-black/70 backdrop-blur-md text-white hover:bg-black transition cursor-pointer"
                  title={isPlaying ? 'Durdur' : 'Oynat'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 rounded-full bg-black/70 backdrop-blur-md text-white hover:bg-black transition cursor-pointer"
                  title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#CCFF00]" />}
                </button>
              </div>
            </div>

            {/* RİTİM & VİBE SEÇİCİ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-300 px-1">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-[#CCFF00]" />
                  🎵 RİTİM & VİBE SEÇ:
                </span>
                <span className="font-mono text-[10px] text-neutral-400">
                  {VIBE_CONFIGS[selectedVibe].tag}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(VIBE_CONFIGS) as VibeMode[]).map((vibeKey) => {
                  const cfg = VIBE_CONFIGS[vibeKey];
                  const isSelected = selectedVibe === vibeKey;
                  return (
                    <button
                      key={vibeKey}
                      onClick={() => handleVibeChange(vibeKey)}
                      disabled={isExporting}
                      className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-[#CCFF00]/15 border-[#CCFF00] text-white shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                          : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="text-xl">{cfg.icon}</span>
                      <span className="font-black text-xs truncate">{cfg.name.split('/')[0]}</span>
                      <span className="font-mono text-[10px] text-neutral-400">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BİLGİ & ANİMASYONLU RİTİM DALGASI */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-neutral-400">
                  📊 SEÇİLEN KARELER: <strong className="text-white">{loadedImages.length} Fotoğraf</strong>
                </span>
                <span className="text-[#CCFF00] font-black">10.0 Saniye</span>
              </div>

              {/* Ritim Dalgası (Audio Waveform Peaks) */}
              <div className="flex items-center justify-between gap-1 h-6 px-1 py-0.5 bg-black/40 rounded-lg overflow-hidden">
                {Array.from({ length: 28 }).map((_, i) => {
                  const isPeak = i % 4 === 0;
                  return (
                    <motion.div
                      key={i}
                      animate={{
                        height: isPlaying ? (isPeak ? ['30%', '100%', '30%'] : ['15%', '60%', '15%']) : (isPeak ? '70%' : '30%'),
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.4 + (i % 3) * 0.1,
                        ease: 'easeInOut',
                      }}
                      className={`flex-1 rounded-full ${
                        isPeak ? 'bg-[#CCFF00]' : 'bg-neutral-600'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Alt Aksiyon Butonları (Render / İndir / Paylaş) */}
          <div className="pt-3 border-t border-white/10 space-y-2 shrink-0">
            {/* Dışa Aktar / İndir Butonu */}
            <button
              onClick={handleExportVideo}
              disabled={isExporting || isLoadingImages || loadedImages.length === 0}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#CCFF00] hover:bg-[#b8e600] active:scale-[0.98] text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.35)] transition cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Video Üretiliyor... %{exportProgress}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>📲 REELS / TIKTOK İNDİR (MP4)</span>
                </>
              )}
            </button>

            {/* Doğrudan Paylaş Butonu (Web Share API) */}
            {canShare && (
              <button
                onClick={handleShareDirectly}
                disabled={isExporting}
                className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[#CCFF00]" />
                <span>🔗 Doğrudan Instagram & TikTok'ta Paylaş</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
