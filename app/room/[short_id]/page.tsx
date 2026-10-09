'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, Clock, MapPin, QrCode, Plus, Lock, Unlock, 
  X, Share2, Sparkles, Disc3, HardDrive, ShieldAlert,
  Music, Check, UploadCloud, Flame, Camera, Users, Trophy,
  Trash2, CheckSquare, Square, FileDown, Layers,
  Mic, MicOff, Play, Pause, Radio, Volume2, Globe, Heart, LogOut, ArrowLeft, Zap, MessageSquare, Receipt, Film, RefreshCw
} from 'lucide-react';
import PollsCard from '@/components/PollsCard';
import VibeCheckShowcase from '@/components/VibeCheckShowcase';
import { playVibeCheckAudio } from '@/components/VibeCheckAlert';
import type { SelfieReactionPayload } from '@/components/SelfieReactionModal';

// Dinamik (Lazy) Yüklenen Ağır Modal Bileşenleri (İlk Sayfa Yükleme Hızı Max)
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const YoutubePlayer = dynamic(() => import('@/components/YoutubePlayer'), { ssr: false });
const SwipeCuratorModal = dynamic(() => import('@/components/SwipeCuratorModal'), { ssr: false });
const ChatDrawer = dynamic(() => import('@/components/ChatDrawer'), { ssr: false });
const PlaceRadarDrawer = dynamic(() => import('@/components/PlaceRadarDrawer'), { ssr: false });
const ReceiptModal = dynamic(() => import('@/components/ReceiptModal'), { ssr: false });
const ReelsGeneratorModal = dynamic(() => import('@/components/ReelsGeneratorModal'), { ssr: false });
const SelfieReactionModal = dynamic(() => import('@/components/SelfieReactionModal'), { ssr: false });
const VibeCheckAlert = dynamic(() => import('@/components/VibeCheckAlert'), { ssr: false });
const PlaceVoteAlert = dynamic(() => import('@/components/PlaceVoteAlert'), { ssr: false });

// Dinamik Confetti Yükleyici
const triggerConfetti = async (opts?: any) => {
  try {
    const mod = await import('canvas-confetti');
    mod.default(opts);
  } catch {}
};
import SelfieReactionStack, { SelfieReactionItem } from '@/components/SelfieReactionStack';
import { addOfflineUpload, getOfflineUploads, removeOfflineUpload, PendingUpload } from '@/lib/offlineQueue';
import { globalAudioPlayer } from '@/lib/audioPlayer';
import CountdownTimer from '@/components/CountdownTimer';
import PhotoCard from '@/components/PhotoCard';


// ==========================================
// YARDIMCI EXIF & KÜNYE FONKSİYONLARI
// ==========================================
function formatDeviceName(make?: string, model?: string): string | null {
  if (!make && !model) return null;
  const rawMake = (make || '').trim();
  const rawModel = (model || '').trim();

  if (/apple/i.test(rawMake) || /iphone/i.test(rawModel)) {
    if (/iphone/i.test(rawModel)) {
      return rawModel.replace(/^apple\s+/i, '');
    }
    return 'iPhone';
  }

  if (/fuji/i.test(rawMake) || /fuji/i.test(rawModel)) {
    return rawModel.toLowerCase().startsWith('fuji') ? rawModel : `Fujifilm ${rawModel}`;
  }

  if (/sony/i.test(rawMake) || /ilce/i.test(rawModel)) {
    if (/ilce-7m4/i.test(rawModel)) return 'Sony A7 IV';
    if (/ilce-7m3/i.test(rawModel)) return 'Sony A7 III';
    if (/ilce-7rm/i.test(rawModel)) return 'Sony A7R';
    return rawModel.toLowerCase().startsWith('sony') ? rawModel : `Sony ${rawModel}`;
  }

  if (/canon/i.test(rawMake) || /eos/i.test(rawModel)) {
    return rawModel.toLowerCase().startsWith('canon') ? rawModel : `Canon ${rawModel}`;
  }

  if (/nikon/i.test(rawMake)) {
    return rawModel.toLowerCase().startsWith('nikon') ? rawModel : `Nikon ${rawModel}`;
  }

  if (/samsung/i.test(rawMake)) {
    return rawModel.replace(/^samsung\s+/i, '');
  }

  if (rawModel) {
    if (rawMake && !rawModel.toLowerCase().includes(rawMake.toLowerCase())) {
      return `${rawMake} ${rawModel}`;
    }
    return rawModel;
  }
  return rawMake || null;
}

function parsePhotoUploader(rawUploader: string) {
  if (!rawUploader) return { nick: 'Anonim', city: null, device: null, display: 'Anonim', vibeCheckId: null, isLate: false };
  
  let cleanRaw = rawUploader;
  let vibeCheckId: string | null = null;
  let isLate = false;

  if (cleanRaw.includes('__VC:')) {
    const vcParts = cleanRaw.split('__VC:');
    cleanRaw = vcParts[0];
    const vcInfo = vcParts[1] || '';
    const [vcId, vcStatus] = vcInfo.split(':');
    vibeCheckId = vcId || null;
    isLate = vcStatus === 'LATE';
  }

  const parts = cleanRaw.split('__DEV:');
  const uploaderStr = parts[0].trim();
  const device = parts[1]?.trim() || null;

  let nick = uploaderStr;
  let city: string | null = null;
  if (uploaderStr.includes(' · ')) {
    const subParts = uploaderStr.split(' · ');
    nick = subParts[0].trim();
    city = subParts[1]?.trim() || null;
  }
  const cleanNick = nick.startsWith('@') ? nick.slice(1) : nick;

  return {
    nick: cleanNick || 'Anonim',
    city,
    device,
    display: city ? `@${cleanNick} · ${city}` : `@${cleanNick}`,
    vibeCheckId,
    isLate,
  };
}

function getDeviceBadge(device: string | null | undefined, _takenAt?: string | Date | null | undefined) {
  if (!device) return null;
  const isCamera = /canon|nikon|sony|fujifilm|fuji|leica|panasonic|olympus|lumix|hasselblad/i.test(device);
  const icon = isCamera ? '📷' : '📱';
  return `${icon} ${device}`;
}


function getBestAudioMimeType(): { mimeType: string; ext: string } {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'audio/webm', ext: 'webm' };
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return { mimeType: 'audio/webm;codecs=opus', ext: 'webm' };
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return { mimeType: 'audio/webm', ext: 'webm' };
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return { mimeType: 'audio/mp4', ext: 'mp4' };
  }
  if (MediaRecorder.isTypeSupported('audio/aac')) {
    return { mimeType: 'audio/aac', ext: 'aac' };
  }
  return { mimeType: '', ext: 'webm' };
}

const SPOTIFY_PRESETS = [
  { type: 'playlist' as const, id: '37i9dQZF1DXcBWIGoYBM5M', title: "Today's Top Hits", subtitle: 'Küresel Zirve Parçalar', emoji: '🌍', category: 'playlist' },
  { type: 'playlist' as const, id: '37i9dQZF1DWY7IeIP1cdjF', title: 'Hot Vibe & Latin Hits', subtitle: 'Baila & Hareketli Ritimler', emoji: '🔥', category: 'playlist' },
  { type: 'playlist' as const, id: '37i9dQZF1DX0XUsuxWHRQd', title: 'RapCaviar', subtitle: 'En İyi Hip Hop / Rap', emoji: '🎤', category: 'playlist' },
  { type: 'playlist' as const, id: '37i9dQZF1DX4dyzvuaRJ0n', title: 'mint Party', subtitle: 'Elektronik & Dans Müziği', emoji: '⚡', category: 'playlist' },
  { type: 'playlist' as const, id: '37i9dQZF1DX4sWSpwq3LiO', title: 'Peaceful Piano', subtitle: 'Sakin & Akustik Ortam', emoji: '☕', category: 'playlist' },
  { type: 'track' as const, id: '7GtO6G2Iue3yfIYhx36JZn', title: 'Macacoa 2000', subtitle: 'GTA VI Sound Hit', emoji: '🌟', category: 'track' },
  { type: 'track' as const, id: '70cHKK8bHAfJrOGVnfRG9J', title: 'Nicole Kidman', subtitle: 'Indie & Alternative', emoji: '🎸', category: 'track' },
  { type: 'track' as const, id: '11hcBLPtbMp4aQI6zGQLub', title: 'Patient Zero', subtitle: 'Pop Vibe', emoji: '✨', category: 'track' },
  { type: 'track' as const, id: '5BsvzSvw98mLqpZznMjuLX', title: 'ZIZI', subtitle: 'Enerjik Ritim', emoji: '🍕', category: 'track' },
];

function parseSpotifyTrack(input: string): { type: 'track' | 'playlist' | 'album' | 'artist'; id: string } | null {
  if (!input) return null;
  const trimmed = input.trim();

  // URL eşleme (open.spotify.com/track/..., open.spotify.com/intl-tr/playlist/..., vb.)
  const urlMatch = trimmed.match(/open\.spotify\.com\/(?:[a-zA-Z0-9-]+\/)?(track|playlist|album|artist)\/([a-zA-Z0-9]+)/i);
  if (urlMatch) {
    return { type: urlMatch[1] as any, id: urlMatch[2] };
  }

  // URI eşleme (spotify:track:..., spotify:playlist:...)
  const uriMatch = trimmed.match(/spotify:(track|playlist|album|artist):([a-zA-Z0-9]+)/i);
  if (uriMatch) {
    return { type: uriMatch[1] as any, id: uriMatch[2] };
  }

  // Preset listesinde isim veya ID eşleme
  const foundPreset = SPOTIFY_PRESETS.find(
    (p) =>
      p.id === trimmed ||
      `${p.title} - ${p.subtitle}`.toLowerCase() === trimmed.toLowerCase() ||
      p.title.toLowerCase() === trimmed.toLowerCase() ||
      (trimmed.length >= 3 && p.title.toLowerCase().includes(trimmed.toLowerCase()))
  );
  if (foundPreset) {
    return { type: foundPreset.type, id: foundPreset.id };
  }

  // Ham 22 karakterlik Spotify ID
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return { type: 'track', id: trimmed };
  }

  return null;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams() as { short_id: string };
  const searchParams = useSearchParams();
  const tokenPin = searchParams?.get('token') || searchParams?.get('pin');

  const [room, setRoom] = useState<any>(null);
  const [roomError, setRoomError] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);

  // Canlı Varlık Sayacı (Supabase Realtime Presence)
  const [activeViewers, setActiveViewers] = useState<number>(1);
  const [liveViewers, setLiveViewers] = useState<string[]>([]);
  const channelRef = useRef<any>(null);
  const [channelState, setChannelState] = useState<any>(null);
  const serverDeletedSet = useRef<Set<string>>(new Set());

  // Story Modu Durumları (Tap-to-Advance İzleyici)
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const storyVideoRef = useRef<HTMLVideoElement | null>(null);

  // Cihaz Bilgisi Önbelleği (Mevcut Görseller İçin Lazy EXIF)
  const [deviceMap, setDeviceMap] = useState<Record<string, string>>({});

  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [hasPurgedExpired, setHasPurgedExpired] = useState(false);
  const [dismissWarning, setDismissWarning] = useState(false);

  // Kullanıcı Rumuzu ve Şehri
  const [currentNickname, setCurrentNickname] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [tempNick, setTempNick] = useState('');
  const [tempCity, setTempCity] = useState('');

  // Realtime Yeni Kare Bildirimi (Toast)
  const [liveToast, setLiveToast] = useState<{ msg: string; id: number } | null>(null);

  // Sesli Anı (Voice Dump) Durumları
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioPlayerState, setAudioPlayerState] = useState<{
    isPlaying: boolean;
    isLoading: boolean;
    currentId: string | null;
  }>({
    isPlaying: false,
    isLoading: false,
    currentId: null,
  });

  useEffect(() => {
    return globalAudioPlayer.subscribe('room-page', setAudioPlayerState);
  }, []);

  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Çoklu Seçim Modu
  const [isSelectMode, setIsSelectMode] = useState(false);
  // Sohbet & DM Çekmecesi Durumları
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatReplyPhoto, setChatReplyPhoto] = useState<any | null>(null);
  const [selectedChatTarget, setSelectedChatTarget] = useState<string | null>(null);
  const [recentChat, setRecentChat] = useState<{ sender: string; text: string; time?: string } | null>(null);

  const openDirectChatWith = (nick: string) => {
    setSelectedChatTarget(nick);
    setShowChatDrawer(true);
  };

  // Swipe-to-Chat (Sağdan Sola Kaydırınca Sohbeti Aç)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (showChatDrawer) return; // DM açıkken ana sayfa kaydırmasını devre dışı bırak
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (showChatDrawer || !touchStartRef.current) return;
    const dx = touchStartRef.current.x - e.changedTouches[0].clientX;
    const dy = touchStartRef.current.y - e.changedTouches[0].clientY;
    // Kullanıcı sağdan sola en az 65px kaydırdıysa ve dikey kaydırma baskın değilse
    if (dx > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (recentChat?.sender && recentChat.sender !== currentNickname) {
        setSelectedChatTarget(recentChat.sender);
      }
      setShowChatDrawer(true);
    }
    touchStartRef.current = null;
  };

  // Vibe Check (Senkronize Fotoğraf Ruleti) Durumları
  const [activeVibeCheck, setActiveVibeCheck] = useState<any>(null);
  const [latestVibeCheck, setLatestVibeCheck] = useState<any>(null);
  const [showVibeAlert, setShowVibeAlert] = useState(false);
  const [activePlaceVote, setActivePlaceVote] = useState<any>(null);
  const [isTriggeringVibe, setIsTriggeringVibe] = useState(false);
  const vibeCameraInputRef = useRef<HTMLInputElement>(null);
  const pendingVibeCheckIdRef = useRef<string | null>(null);

  const handleTriggerVibePhoto = (vibeId?: string) => {
    pendingVibeCheckIdRef.current = vibeId || latestVibeCheck?.id || activeVibeCheck?.id || null;
    if (vibeCameraInputRef.current) {
      vibeCameraInputRef.current.value = '';
      vibeCameraInputRef.current.click();
    }
  };
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false);

  // Depolama Kotası ve Bekçi Durumu (Hard Cap)
  const [storageStats, setStorageStats] = useState({
    usedBytes: 0,
    maxSafeBytes: 9.5 * 1024 * 1024 * 1024,
    totalQuotaBytes: 10 * 1024 * 1024 * 1024,
    isExceeded: false,
  });
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [storageModalMsg, setStorageModalMsg] = useState('');

  // Spotify Vibe Modalı
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeQuery, setYoutubeQuery] = useState('');
  const [youtubeSaving, setYoutubeSaving] = useState(false);
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [isYoutubeSearching, setIsYoutubeSearching] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  // Yükleme Durumu & Sürükle Bırak Ekranı
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Floating reactions: photoId -> emoji array
  const [reactions, setReactions] = useState<Record<string, string[]>>({});

  // Canlı Selfie Reaksiyonları (Locket / BeReal Avatar Stack): photoId -> SelfieReactionItem[]
  const [selfieReactions, setSelfieReactions] = useState<Record<string, SelfieReactionItem[]>>({});
  const [selfieTargetPhoto, setSelfieTargetPhoto] = useState<any | null>(null);

  // Kapsül Kapanış Raporu (Mini Recap)
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPlaceRadar, setShowPlaceRadar] = useState(false);
  const [showSwipeModal, setShowSwipeModal] = useState(false);
  const [showReelsModal, setShowReelsModal] = useState(false);
  const [isClosingSoon, setIsClosingSoon] = useState(false);

  // Offline Desteği (IndexedDB Kuyruk Durumu)
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);


  // Story Modu İçin Medya Listesi (Sesli notlar hariç)
  const storyItems = useMemo(() => {
    return photos.filter((p) => !p.original_name?.startsWith('Sesli Anı'));
  }, [photos]);

  
  // Odadaki Tüm Katılımcıların Listesi (Canlı + Fotoğraf Atanlar)
  const allRoomParticipants = useMemo(() => {
    const set = new Set<string>();
    if (currentNickname) set.add(currentNickname.replace(/^@/, ''));
    liveViewers.forEach((v) => set.add(v.replace(/^@/, '')));
    photos.forEach((p) => {
      const parsed = parsePhotoUploader(p.uploaded_by);
      if (parsed.nick) set.add(parsed.nick.replace(/^@/, ''));
    });
    return Array.from(set);
  }, [currentNickname, liveViewers, photos]);

  const currentStoryPhoto = storyIndex !== null ? storyItems[storyIndex] : null;


  // Kapsül Kapanış Raporu Hesaplaması (Mini Recap) - Akıllı & Gerçekçi
  const recapData = useMemo(() => {
    if (!photos || photos.length === 0) return null;

    // 1. Katılımcı Analizi
    const uploaderCounts: Record<string, { count: number; display: string }> = {};
    for (const p of photos) {
      const parsed = parsePhotoUploader(p.uploaded_by);
      const nick = parsed.nick;
      if (!uploaderCounts[nick]) {
        uploaderCounts[nick] = { count: 0, display: parsed.display };
      }
      uploaderCounts[nick].count += 1;
    }

    const uniqueUploaders = Object.keys(uploaderCounts);
    const isSingleParticipant = uniqueUploaders.length <= 1;

    let topUploader = '';
    let maxUploads = 0;
    for (const [nick, data] of Object.entries(uploaderCounts)) {
      if (data.count > maxUploads) {
        maxUploads = data.count;
        topUploader = nick;
      }
    }

    // 2. Zaman Çizelgesi
    const sortedByTime = [...photos].sort((a, b) => {
      const timeA = new Date(a.taken_at || a.created_at).getTime();
      const timeB = new Date(b.taken_at || b.created_at).getTime();
      return timeA - timeB;
    });

    const firstPhoto = sortedByTime[0];
    const lastPhoto = sortedByTime[sortedByTime.length - 1];
    const firstDt = new Date(firstPhoto?.taken_at || firstPhoto?.created_at);
    const lastDt = new Date(lastPhoto?.taken_at || lastPhoto?.created_at);
    const firstTimeStr = `${String(firstDt.getHours()).padStart(2, '0')}:${String(firstDt.getMinutes()).padStart(2, '0')}`;
    const lastTimeStr = `${String(lastDt.getHours()).padStart(2, '0')}:${String(lastDt.getMinutes()).padStart(2, '0')}`;

    // Gerçek Gece Kuşu: 22:00 - 05:59 arası fotoğraf çeken
    let trueNightBird = null as { nick: string; timeStr: string } | null;
    for (const p of photos) {
      const dt = new Date(p.taken_at || p.created_at);
      const hour = dt.getHours();
      const minute = dt.getMinutes();
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const nick = parsePhotoUploader(p.uploaded_by).nick;

      if (hour >= 22 || hour < 6) {
        trueNightBird = { nick, timeStr };
      }
    }

    // 3. Günün Karesi: Gerçek reaksiyon almış popüler kare
    let mostReactedPhoto = null as any;
    let maxReactions = 0;
    let flameCount = 0;

    for (const p of photos) {
      const pReactions = reactions[p.id] || [];
      const flames = pReactions.filter((e) => e === '🔥').length;
      const totalScore = flames * 2 + pReactions.length;
      if (totalScore > maxReactions) {
        maxReactions = totalScore;
        mostReactedPhoto = p;
        flameCount = flames || pReactions.length;
      }
    }

    const hasRealReactions = maxReactions > 0 && mostReactedPhoto;
    const bestPhoto = hasRealReactions ? mostReactedPhoto : firstPhoto;
    const bestPhotoNick = parsePhotoUploader(bestPhoto?.uploaded_by || '').nick;

    // Kart 2 Konfigürasyonu
    let card2;
    if (trueNightBird) {
      card2 = {
        title: 'Günün Gece Kuşu',
        icon: '🦉',
        nick: trueNightBird.nick,
        tag: `${trueNightBird.timeStr}'de bastı 🌙`,
      };
    } else if (isSingleParticipant) {
      card2 = {
        title: 'Anı Akış Aralığı',
        icon: '🕒',
        nick: topUploader,
        tag: `${firstTimeStr} — ${lastTimeStr}`,
      };
    } else {
      const openerNick = parsePhotoUploader(firstPhoto?.uploaded_by || '').nick;
      card2 = {
        title: 'Kapsülün Açılış Kaptanı',
        icon: '⚡',
        nick: openerNick,
        tag: `${firstTimeStr}'de ilk kareyi bastı 🚀`,
      };
    }

    // Kart 3 Konfigürasyonu
    const card3 = hasRealReactions
      ? {
          title: 'Günün Karesi',
          photo: bestPhoto,
          nick: bestPhotoNick,
          tag: `${flameCount} Reaksiyon 🔥`,
          isFlame: true,
        }
      : {
          title: 'Kapsül Açılış Karesi',
          photo: firstPhoto,
          nick: parsePhotoUploader(firstPhoto?.uploaded_by || '').nick,
          tag: `${firstTimeStr}'de ilk anı 📸`,
          isFlame: false,
        };

    return {
      isSingleParticipant,
      participantCount: uniqueUploaders.length,
      totalPhotos: photos.length,
      topUploader: {
        title: isSingleParticipant ? 'Kapsülün Mimarı' : 'Günün Fotoğraf Makinesi',
        nick: topUploader || 'Anonim',
        count: maxUploads,
      },
      uploaderCounts,
      card2,
      card3,
    };
  }, [photos, reactions]);

  // Otomatik Günün Kapağı (En çok 🔥 ve reaksiyon alan kare)
  const coverPhoto = useMemo(() => {
    if (!photos || photos.length === 0) return null;
    const mediaPhotos = photos.filter(
      (p) => !/\.(mp4|webm|mov|m4v)$/i.test(p.original_name || p.r2_file_key) && !p.original_name?.startsWith('Sesli Anı')
    );
    if (!mediaPhotos.length) return photos[0];

    let topPhoto = mediaPhotos[0];
    let topScore = -1;

    for (const p of mediaPhotos) {
      const pReactions = reactions[p.id] || [];
      const score = pReactions.reduce((acc, emo) => acc + (emo === '🔥' ? 3 : 1), 0);
      if (score > topScore) {
        topScore = score;
        topPhoto = p;
      }
    }

    return topPhoto;
  }, [photos, reactions]);


  useEffect(() => {
    setRoomUrl(window.location.href);

    const savedNick = localStorage.getItem('snaproom_nickname') || '';
    const savedCity = localStorage.getItem('snaproom_city') || '';
    setCurrentNickname(savedNick);
    setCurrentCity(savedCity);

    // Eğer linkle geldiyse ve rumuz yoksa, rumuz isteme modalını aç
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setShowAuthModal(true);
      } else if (!savedNick) {
        const username = session.user.user_metadata?.username || session.user.email?.split('@')[0];
        if (username) {
          localStorage.setItem('snaproom_nickname', username);
          setCurrentNickname(username);
        } else {
          setShowUserModal(true);
        }
      }
    });

    fetchData();
    fetchStorageStats();

    // Kayıtlı Reaksiyonları Yükle
    try {
      const savedReactions = localStorage.getItem(`snaproom_reactions_${params.short_id}`);
      if (savedReactions) setReactions(JSON.parse(savedReactions));
    } catch (e) {}

    // Supabase Realtime Channel: Presence (Canlı Sayacı) + Broadcast + DB Değişiklikleri
    const presenceKey = savedNick ? `${savedNick}_${Math.random().toString(36).slice(2, 6)}` : `guest_${Math.random().toString(36).slice(2, 6)}`;
    const channel = supabase.channel(`room_${params.short_id}`, {
      config: {
        presence: { key: presenceKey },
      },
    });
    channelRef.current = channel;

    const updateLiveViewers = (state: any) => {
      const keys = Object.keys(state);
      setActiveViewers(Math.max(1, keys.length));
      
      const nicks = new Set<string>();
      keys.forEach((key) => {
        if (key.startsWith('guest_')) return;
        // format is: nickname_random
        const nick = key.split('_').slice(0, -1).join('_');
        if (nick) nicks.add(nick);
      });
      setLiveViewers(Array.from(nicks));
    };

    channel
      .on('presence', { event: 'sync' }, () => updateLiveViewers(channel.presenceState()))
      .on('presence', { event: 'join' }, () => updateLiveViewers(channel.presenceState()))
      .on('presence', { event: 'leave' }, () => updateLiveViewers(channel.presenceState()))
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (payload?.photoId && payload?.emoji) {
          setReactions((prev) => ({
            ...prev,
            [payload.photoId]: [...(prev[payload.photoId] || []), payload.emoji],
          }));
        }
      })
      .on('broadcast', { event: 'selfie_reaction' }, ({ payload }) => {
        if (payload?.reaction) {
          const r = payload.reaction;
          setSelfieReactions((prev) => {
            const list = prev[r.photo_id] || [];
            if (list.some((existing) => existing.id === r.id)) return prev;
            return {
              ...prev,
              [r.photo_id]: [...list, r],
            };
          });
        }
      })
      .on('broadcast', { event: 'photo_deleted' }, ({ payload }) => {
        if (payload?.photoId) {
          serverDeletedSet.current.add(payload.photoId);
          setPhotos((prev) => prev.filter((p) => p.id !== payload.photoId));
        }
      })
      .on('broadcast', { event: 'spotify_updated' }, ({ payload }) => {
        if (payload?.spotify_url !== undefined) {
          setRoom((prev: any) => ({ ...prev, spotify_url: payload.spotify_url }));
        }
      })
      .on('broadcast', { event: 'polls_updated' }, ({ payload }) => {
        window.dispatchEvent(new CustomEvent('polls_updated', { detail: payload }));
      })
      .on('broadcast', { event: 'vibe_check_alert' }, ({ payload }) => {
        if (payload) {
          setActiveVibeCheck(payload);
          setLatestVibeCheck(payload);
          setShowVibeAlert(true);
          playVibeCheckAudio();
        }
      })
      .on('broadcast', { event: 'place_vote_start' }, ({ payload }) => {
        if (payload) {
          setActivePlaceVote(payload);
          playVibeCheckAudio(); // Ortak bir ses kullanabiliriz
        }
      })
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        if (payload?.sender_name) {
          setRecentChat({
            sender: payload.sender_name,
            text: payload.text || (payload.media_type === 'audio' ? '🎙️ Sesli Not' : payload.media_type === 'video' ? '🎬 5s Video' : '📷 Medya'),
            time: 'şimdi',
          });
        }
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photos' },
        (payload) => {
          fetchData();
          fetchStorageStats();

          // Uzaktan biri anı fırlattığında canlı kutlama toast'ı
          const rawUp = payload.new?.uploaded_by || 'Biri';
          const cleanUp = parsePhotoUploader(rawUp).nick;
          setLiveToast({
            msg: `🔥 ${cleanUp} yeni bir kare fırlattı!`,
            id: Date.now(),
          });

          // Mini kutlama konfetisi
          triggerConfetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.15 },
            colors: ['#CCFF00', '#FF2E93', '#FFFFFF'],
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'photos' },
        () => {
          fetchData();
          fetchStorageStats();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms' },
        (payload) => {
          if (payload.new?.short_id === params.short_id) {
            setRoom(payload.new);
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user: savedNick || 'Anonim',
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.short_id]);

  // Otomatik Toast Kapanışı
  useEffect(() => {
    if (liveToast) {
      const timer = setTimeout(() => setLiveToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [liveToast]);

  const fetchStorageStats = async () => {
    try {
      const res = await fetch('/api/upload');
      if (res.ok) {
        const data = await res.json();
        setStorageStats({
          usedBytes: data.usedBytes || 0,
          maxSafeBytes: data.maxSafeBytes || 9.5 * 1024 * 1024 * 1024,
          totalQuotaBytes: data.totalQuotaBytes || 10 * 1024 * 1024 * 1024,
          isExceeded: Boolean(data.isExceeded),
        });
        if (data.deletedIds && Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((id: string) => serverDeletedSet.current.add(id));
          setPhotos((prev) => prev.filter((p) => !serverDeletedSet.current.has(p.id)));
        }
      }
    } catch (err) {}
  };

  // Silinme Öncesi Uyarı & Otomatik Silme Kontrolü (Düşük frekanslı, 60 saniyede bir kontrol edilir)
  useEffect(() => {
    if (!room?.created_at) return;

    const checkExpiration = () => {
      const created = new Date(room.created_at).getTime();
      const isLegacy = created < new Date('2026-10-08T12:49:00Z').getTime();
      const expires = !isLegacy && room.upload_locked_at
        ? new Date(room.upload_locked_at).getTime()
        : created + 48 * 60 * 60 * 1000;
      const diff = expires - Date.now();

      if (diff <= 0) {
        setIsExpired(true);
        if (!hasPurgedExpired) {
          setHasPurgedExpired(true);
          fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expirePurge: true, roomId: room.id }),
          }).catch(() => {});
          setPhotos([]);
        }
        return;
      }

      const totalDurationMs = expires - created;
      const warningThreshold = totalDurationMs > 48 * 3600 * 1000 
        ? 24 * 3600 * 1000 
        : totalDurationMs > 24 * 3600 * 1000 
        ? 3 * 3600 * 1000 
        : 2 * 3600 * 1000;

      if (diff <= warningThreshold && diff > 0) {
        setIsClosingSoon(true);
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 60000);
    return () => clearInterval(interval);
  }, [room?.created_at, room?.upload_locked_at, hasPurgedExpired]);

  const fetchVibeCheckStatus = async (roomId: string) => {
    try {
      const res = await fetch(`/api/vibe-check?roomId=${roomId}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.activeVibeCheck) {
          setActiveVibeCheck(data.activeVibeCheck);
          setShowVibeAlert(true);
        } else {
          setActiveVibeCheck(null);
        }
        if (data.latestVibeCheck) {
          setLatestVibeCheck(data.latestVibeCheck);
        }
      }
    } catch {}
  };

  const fetchData = async () => {
    const { data: roomData, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('short_id', params.short_id)
      .maybeSingle();

    if (error || !roomData) {
      setRoomError(true);
      return;
    }

    if (roomData) {
      setRoom(roomData);
      fetchVibeCheckStatus(roomData.id);
      setIsLocked(new Date() > new Date(roomData.upload_locked_at));

      // Canlı Selfie Reaksiyonlarını Çek
      try {
        fetch(`/api/reactions?roomId=${roomData.id}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.reactions) {
              setSelfieReactions(data.reactions);
            }
          })
          .catch(() => {});
      } catch (e) {}

      // Oturum açmışsa bu odayı otomatik olarak kullanıcının geçmişine ekle (direkt linkten geldiyse diye)
      try {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            const currentCapsules = user.user_metadata?.capsules || [];
            if (!currentCapsules.includes(params.short_id)) {
              const newCapsules = [params.short_id, ...currentCapsules];
              supabase.auth.updateUser({ data: { capsules: newCapsules } });
            }
          }
        });
      } catch (e) {}


      // Zaman Tüneli: Çekilme saatine göre sıralı (en son çekilen üstte)
      const { data: photosData } = await supabase
        .from('photos')
        .select('*')
        .eq('room_id', roomData.id)
        .order('taken_at', { ascending: false });

      if (photosData) {
        const localDeleted = JSON.parse(localStorage.getItem(`snaproom_deleted_${roomData.id}`) || '[]');
        const activePhotos = photosData.filter((p: any) => {
          if (localDeleted.includes(p.id)) return false;
          if (serverDeletedSet.current.has(p.id)) return false;
          return true;
        });
        setPhotos(activePhotos);
      }

      // Hızlı DM ve Son Sohbet Hapı için son mesajı al
      try {
        const chatRes = await fetch(`/api/chat?roomId=${roomData.id}`);
        if (chatRes.ok) {
          const chatJson = await chatRes.json();
          if (chatJson.messages && chatJson.messages.length > 0) {
            const lastMsg = chatJson.messages[chatJson.messages.length - 1];
            setRecentChat({
              sender: lastMsg.sender_name,
              text: lastMsg.text || (lastMsg.media_type === 'audio' ? '🎙️ Sesli Not' : lastMsg.media_type === 'video' ? '🎬 5s Video' : '📷 Medya'),
              time: 'az önce',
            });
          }
        }
      } catch (e) {}
    }
  };


  // Story Navigasyon Fonksiyonları
  const nextStory = () => {
    if (storyIndex === null) return;
    if (storyIndex < storyItems.length - 1) {
      setStoryIndex((prev) => (prev !== null ? prev + 1 : null));
      setStoryProgress(0);
    } else {
      setStoryIndex(null);
      setStoryProgress(0);
    }
  };

  const prevStory = () => {
    if (storyIndex === null) return;
    if (storyIndex > 0) {
      setStoryIndex((prev) => (prev !== null ? prev - 1 : null));
      setStoryProgress(0);
    } else {
      setStoryProgress(0);
    }
  };

  // Story Otomatik İlerleme Sayacı (5 saniye)
  useEffect(() => {
    if (storyIndex === null) {
      setStoryProgress(0);
      return;
    }

    const currentItem = storyItems[storyIndex];
    const isVid = /\.(mp4|webm|mov|m4v)$/i.test(currentItem?.original_name || currentItem?.r2_file_key);
    if (isVid) return; // Videolarda video oynatımı çubuğu yönetir

    if (isStoryPaused) return;

    const intervalTime = 50;
    const totalDuration = 5000;
    const step = (intervalTime / totalDuration) * 100;

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          nextStory();
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [storyIndex, isStoryPaused, storyItems]);

  // Klavye Kontrolleri (Story Modunda Ok Tuşları & Escape)
  useEffect(() => {
    if (storyIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextStory();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStory();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setStoryIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [storyIndex, storyItems]);

  // Cihaz bilgisi yükleme anında uploaderTag içinde kaydedilmektedir; arka planda yüzlerce MB dosya indirilmez.


  // ==========================================
  // OFFLINE KUYRUK SENKRONİZASYONU (INDEXEDDB)
  // ==========================================
  const syncOfflineQueue = async () => {
    if (isSyncingOffline || !navigator.onLine) return;
    const roomId = room?.id || params.short_id;
    const items = await getOfflineUploads(roomId);
    if (!items.length) return;

    setIsSyncingOffline(true);
    let uploadedCount = 0;

    for (const item of items) {
      try {
        const fileKey = `${item.roomId}/${crypto.randomUUID()}-${item.fileName}`;
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: fileKey,
            contentType: item.fileType || 'image/jpeg',
            fileSize: item.fileSize,
          }),
        });

        if (!res.ok) continue;
        const { url } = await res.json();

        const uploadRes = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': item.fileType || 'image/jpeg' },
          body: item.fileBlob,
        });

        if (!uploadRes.ok) continue;

        // Offline senkronizasyonda da hafif WebP Thumbnail üret
        if (item.fileType?.startsWith('image/')) {
          try {
            const thumbBlob = await createThumbnailBlob(item.fileBlob, 400);
            if (thumbBlob) {
              const thumbKey = `thumbs/${fileKey}.webp`;
              const thumbRes = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filename: thumbKey,
                  contentType: 'image/webp',
                  fileSize: thumbBlob.size,
                }),
              });
              if (thumbRes.ok) {
                const { url: thumbPutUrl } = await thumbRes.json();
                await fetch(thumbPutUrl, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'image/webp' },
                  body: thumbBlob,
                });
              }
            }
          } catch (tErr) {}
        }

        const finalUploader = item.deviceModel 
          ? `${item.uploaderTag}__DEV:${item.deviceModel}` 
          : item.uploaderTag;

        const { data: newPhoto } = await supabase.from('photos').insert({
          room_id: item.roomId,
          r2_file_key: fileKey,
          original_name: item.fileName,
          uploaded_by: finalUploader,
          taken_at: item.takenAt,
        }).select().single();

        if (newPhoto?.id) {
          try {
            const myIds = JSON.parse(localStorage.getItem('snaproom_my_photos') || '[]');
            myIds.push(newPhoto.id);
            localStorage.setItem('snaproom_my_photos', JSON.stringify(myIds));
          } catch (e) {}
        }

        await removeOfflineUpload(item.id);
        uploadedCount++;
      } catch (e) {
        console.error('Offline senkronizasyon öğe hatası:', e);
      }
    }

    const remaining = await getOfflineUploads(roomId);
    setOfflineCount(remaining.length);
    setIsSyncingOffline(false);

    if (uploadedCount > 0) {
      setLiveToast({
        msg: `⚡ İnternet geldi! Kuyruktaki ${uploadedCount} anı kapsüle yüklendi!`,
        id: Date.now(),
      });
      triggerConfetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.2 },
        colors: ['#CCFF00', '#FF2E93', '#FFFFFF'],
      });
      fetchData();
      fetchStorageStats();
    }
  };

  // Online olunduğunda ve oda açıldığında offline kuyruğu tara
  useEffect(() => {
    const roomId = room?.id || params.short_id;
    getOfflineUploads(roomId).then((items) => {
      setOfflineCount(items.length);
      if (items.length > 0 && navigator.onLine) {
        syncOfflineQueue();
      }
    });

    const handleOnline = () => {
      syncOfflineQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [room?.id, params.short_id]);

// ==========================================
// CLIENT-SIDE THUMBNAIL MOTORU (<Canvas> 400px WebP, ~35 KB)
// EXIF OTO-DÖNDÜRME DESTEKLİ (Telefondan çekilen dikey/yatay kareleri asla ters çevirmez)
// ==========================================
async function createThumbnailBlob(file: File | Blob, maxDim = 400): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null;

  // 1. ÖNCELİKLİ YÖNTEM: createImageBitmap({ imageOrientation: 'from-image' })
  // Modern mobil tarayıcılarda (iOS Safari 15+, Chrome) donanım hızlandırmalı ve EXIF'e tam duyarlı
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      let w = bitmap.width;
      let h = bitmap.height;
      if (w > h) {
        if (w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        }
      } else {
        if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.82);
        });
      }
      bitmap.close();
    } catch (e) {
      // Desteklenmeyen veya hata veren tarayıcılarda güvenli fallback'e devam et
    }
  }

  // 2. GÜVENLİ FALLBACK: exifr ile EXIF tag tespiti + Canvas Transform Matrisi
  return new Promise(async (resolve) => {
    let orientation = 1;
    try {
      const exifrMod = await import('exifr');
      orientation = (await exifrMod.default.orientation(file)) || 1;
    } catch {}

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const isRotated90 = [5, 6, 7, 8].includes(orientation);
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;

      // EXIF yönelimine göre nihai dikey/yatay boyutları hesapla
      const logicalW = isRotated90 ? naturalH : naturalW;
      const logicalH = isRotated90 ? naturalW : naturalH;

      let displayW = logicalW;
      let displayH = logicalH;

      if (displayW > displayH) {
        if (displayW > maxDim) {
          displayH = Math.round((displayH * maxDim) / displayW);
          displayW = maxDim;
        }
      } else {
        if (displayH > maxDim) {
          displayW = Math.round((displayW * maxDim) / displayH);
          displayH = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = displayW;
      canvas.height = displayH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      const drawW = isRotated90 ? displayH : displayW;
      const drawH = isRotated90 ? displayW : displayH;

      switch (orientation) {
        case 2:
          ctx.translate(displayW, 0);
          ctx.scale(-1, 1);
          break;
        case 3:
          ctx.translate(displayW, displayH);
          ctx.rotate(Math.PI);
          break;
        case 4:
          ctx.translate(0, displayH);
          ctx.scale(1, -1);
          break;
        case 5:
          ctx.rotate(0.5 * Math.PI);
          ctx.scale(1, -1);
          break;
        case 6:
          ctx.translate(displayW, 0);
          ctx.rotate(0.5 * Math.PI);
          break;
        case 7:
          ctx.translate(displayW, displayH);
          ctx.rotate(0.5 * Math.PI);
          ctx.scale(-1, 1);
          break;
        case 8:
          ctx.translate(0, displayH);
          ctx.rotate(-0.5 * Math.PI);
          break;
      }

      ctx.drawImage(img, 0, 0, drawW, drawH);
      canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.82);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

  // Doğrudan Fotoğraf / Video Yükleme
  const processFiles = async (fileList: FileList | File[], forVibeCheckId?: string) => {
    if (storageStats.isExceeded) {
      handleQuotaExceeded('10 GB ücretsiz kota koruma altında! Yeni yükleme yapılamaz.');
      return;
    }
    if (isLocked) {
      alert('Bu kapsül kapanış süresini (24 saat) doldurmuş.');
      return;
    }
    const files = Array.from(fileList);
    if (!files.length) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    const nick = currentNickname || localStorage.getItem('snaproom_nickname') || 'Anonim';
    const city = currentCity || localStorage.getItem('snaproom_city') || '';
    const uploaderTag = city ? `${nick} · ${city}` : nick;

    let queuedOffline = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });

      // 1. EXIF ile Çekim Saati ve Cihaz Modelini Sessizce Çöz
      let takenAt = new Date();
      let deviceModel = '';
      try {
        const exifrMod = await import('exifr');
            const exifData = await exifrMod.default.parse(file, ['Make', 'Model', 'DateTimeOriginal']);
        if (exifData?.DateTimeOriginal) {
          takenAt = exifData.DateTimeOriginal;
        }
        const cleanedDev = formatDeviceName(exifData?.Make, exifData?.Model);
        if (cleanedDev) {
          deviceModel = cleanedDev;
        }
      } catch (err) {}

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `${room.id}/${crypto.randomUUID()}-${cleanFileName}`;

      // 2. OFFLINE KONTROLÜ (İnternet yoksa doğrudan IndexedDB'ye at)
      if (!navigator.onLine) {
        await addOfflineUpload({
          id: crypto.randomUUID(),
          roomId: room.id,
          fileBlob: file,
          fileName: cleanFileName,
          fileType: file.type || 'image/jpeg',
          fileSize: file.size,
          uploaderTag,
          deviceModel,
          takenAt: takenAt.toISOString ? takenAt.toISOString() : new Date().toISOString(),
          createdAt: Date.now(),
        });
        queuedOffline++;
        continue;
      }

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            filename: fileKey, 
            contentType: file.type || 'image/jpeg',
            fileSize: file.size
          }),
        });

        if (res.status === 403) {
          const errData = await res.json();
          handleQuotaExceeded(errData.message || '10 GB kota dolmak üzere! Yükleme durduruldu.');
          break;
        }

        if (!res.ok) throw new Error('Pre-signed URL alınamadı');
        const { url } = await res.json();

        // Orijinal dosyayı kayıpsız yükle (100% full kalite)
        const uploadRes = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file,
        });

        if (!uploadRes.ok) throw new Error('R2 Yükleme Hatası');

        // Hafif WebP Thumbnail üret ve R2'ye yükle (thumbs/ altına ~35 KB)
        if (file.type.startsWith('image/')) {
          try {
            const thumbBlob = await createThumbnailBlob(file, 400);
            if (thumbBlob) {
              const thumbKey = `thumbs/${fileKey}.webp`;
              const thumbRes = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filename: thumbKey,
                  contentType: 'image/webp',
                  fileSize: thumbBlob.size,
                }),
              });
              if (thumbRes.ok) {
                const { url: thumbPutUrl } = await thumbRes.json();
                await fetch(thumbPutUrl, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'image/webp' },
                  body: thumbBlob,
                });
              }
            }
          } catch (tErr) {
            console.warn('Thumbnail generation skipped:', tErr);
          }
        }

        let vibeTag = '';
        let isLate = false;
        const targetVibe = forVibeCheckId 
          ? (activeVibeCheck?.id === forVibeCheckId ? activeVibeCheck : latestVibeCheck?.id === forVibeCheckId ? latestVibeCheck : { id: forVibeCheckId, expires_at: new Date(0).toISOString() })
          : activeVibeCheck;

        if (targetVibe?.id) {
          isLate = Date.now() > new Date(targetVibe.expires_at).getTime();
          vibeTag = `__VC:${targetVibe.id}:${isLate ? 'LATE' : 'FAST'}`;
        }

        const finalUploader = (deviceModel ? `${uploaderTag}__DEV:${deviceModel}` : uploaderTag) + vibeTag;

        let insertData: any = {
          room_id: room.id,
          r2_file_key: fileKey,
          original_name: file.name,
          uploaded_by: finalUploader,
          taken_at: takenAt,
        };
        if (targetVibe?.id) {
          insertData.vibe_check_id = targetVibe.id;
          insertData.is_late = isLate;
        }

        let newPhoto: any = null;
        try {
          const res = await supabase.from('photos').insert(insertData).select().single();
          if (res.error) throw res.error;
          newPhoto = res.data;
        } catch (dbErr) {
          delete insertData.vibe_check_id;
          delete insertData.is_late;
          const retryRes = await supabase.from('photos').insert(insertData).select().single();
          newPhoto = retryRes.data;
        }

        if (newPhoto?.id) {
          try {
            const myIds = JSON.parse(localStorage.getItem('snaproom_my_photos') || '[]');
            myIds.push(newPhoto.id);
            localStorage.setItem('snaproom_my_photos', JSON.stringify(myIds));
          } catch (e) {}
          if (targetVibe?.id) {
            fetchVibeCheckStatus(room.id);
          }
        }
      } catch (err) {
        console.error('Yükleme hatası (Ağ koptu), IndexedDB kuyruğuna alınıyor:', err);
        // Ağ hatasında fotoğrafı kaybetme! IndexedDB kuyruğuna al
        await addOfflineUpload({
          id: crypto.randomUUID(),
          roomId: room.id,
          fileBlob: file,
          fileName: cleanFileName,
          fileType: file.type || 'image/jpeg',
          fileSize: file.size,
          uploaderTag,
          deviceModel,
          takenAt: takenAt.toISOString ? takenAt.toISOString() : new Date().toISOString(),
          createdAt: Date.now(),
        });
        queuedOffline++;
      }
    }

    setUploading(false);
    fetchData();
    fetchStorageStats();

    if (queuedOffline > 0) {
      const remaining = await getOfflineUploads(room.id);
      setOfflineCount(remaining.length);
      setLiveToast({
        msg: `📶 İnternet zayıf! ${queuedOffline} anı hafızaya alındı, bağlantı gelince fırlatılacak!`,
        id: Date.now(),
      });
    }
  };

  // ==========================================
  // SESLİ ANI (VOICE DUMP) KAYIT FONKSİYONLARI
  // ==========================================
  const startVoiceRecording = async () => {
    try {
      // 1. Önceki çalışan zamanlayıcıları ve önizlemeleri temizle
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setIsPlayingPreview(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setAudioBlob(null);
      audioChunksRef.current = [];

      // 2. Mikrofon akışı al
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const { mimeType } = getBestAudioMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        const finalType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        setAudioBlob(blob);
        setIsRecording(false);
      };

      mediaRecorder.start(250); // Her 250ms'de bir veri parçala
      setIsRecording(true);
      setRecordSeconds(0);
      startTimeRef.current = Date.now();

      // 3. Gerçek saat farkı (wall-clock time) ile çalışan saniye sayacı
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (elapsed >= 10) {
          setRecordSeconds(10);
          if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
          }
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        } else {
          setRecordSeconds(elapsed);
        }
      }, 200);
    } catch (err) {
      console.error('Mikrofon başlatma hatası:', err);
      alert('Mikrofon erişim izni verilmedi veya desteklenmiyor.');
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (startTimeRef.current) {
      const finalSec = Math.max(1, Math.min(10, Math.round((Date.now() - startTimeRef.current) / 1000)));
      setRecordSeconds(finalSec);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const togglePreview = () => {
    if (!audioBlob) return;
    if (!previewAudioRef.current) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      (audio as any).playsInline = true;
      audio.preload = 'auto';
      audio.onended = () => setIsPlayingPreview(false);
      audio.onerror = () => setIsPlayingPreview(false);
      previewAudioRef.current = audio;
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current.play().then(() => {
        setIsPlayingPreview(true);
      }).catch((e) => {
        console.error('Önizleme çalma hatası:', e);
        setIsPlayingPreview(false);
      });
    }
  };

  const closeVoiceModal = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPlayingPreview(false);
    setIsRecording(false);
    setAudioBlob(null);
    setRecordSeconds(0);
    setShowVoiceModal(false);
  };

  const uploadVoiceDump = async () => {
    if (!audioBlob) {
      alert('Ses kaydı bulunamadı. Lütfen kaydı tamamlayın.');
      return;
    }
    setVoiceUploading(true);

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    }

    const nick = currentNickname || localStorage.getItem('snaproom_nickname') || 'Anonim';
    const city = currentCity || localStorage.getItem('snaproom_city') || '';
    const cleanNick = parsePhotoUploader(nick).nick;
    const uploaderTag = city ? `${cleanNick} · ${city} 🎙️` : `${cleanNick} 🎙️`;

    // Dosya türü ve uzantısı tespiti (mp4 veya webm)
    const rawType = audioBlob.type || 'audio/webm';
    const cleanType = rawType.split(';')[0] || 'audio/webm';
    const ext = cleanType.includes('mp4') ? 'mp4' : cleanType.includes('aac') ? 'aac' : 'webm';
    const fileKey = `${room.id}/voice-${crypto.randomUUID()}.${ext}`;
    const duration = recordSeconds || 10;

    try {
      // 1. R2 Presigned URL al
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileKey,
          contentType: cleanType,
          fileSize: audioBlob.size,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Yükleme URL\'si alınamadı');
      }
      const { url } = await res.json();

      // 2. Doğrudan R2'ye PUT yap
      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': cleanType },
        body: audioBlob,
      });

      if (!uploadRes.ok) throw new Error('R2 ses yükleme hatası');

      // 3. Supabase veritabanına kaydet
      const { data: newVoice, error: dbErr } = await supabase.from('photos').insert({
        room_id: room.id,
        r2_file_key: fileKey,
        original_name: `Sesli Anı (${duration}s).${ext}`,
        uploaded_by: uploaderTag,
        taken_at: new Date(),
      }).select().single();

      if (dbErr) throw dbErr;

      // 4. Silme yetkisi için yerel kimliğe ekle
      if (newVoice?.id) {
        try {
          const myIds = JSON.parse(localStorage.getItem('snaproom_my_photos') || '[]');
          myIds.push(newVoice.id);
          localStorage.setItem('snaproom_my_photos', JSON.stringify(myIds));
        } catch (e) {}
      }

      // 5. Başarılı kapatma ve yenileme
      closeVoiceModal();
      fetchData();
      fetchStorageStats();

      // Mini kutlama konfetisi
      triggerConfetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.2 },
        colors: ['#CCFF00', '#FF2E93', '#FFFFFF'],
      });
    } catch (err: any) {
      console.error('Ses yükleme hatası:', err);
      alert(err.message || 'Ses kaydı kaydedilirken bir hata oluştu.');
    } finally {
      setVoiceUploading(false);
    }
  };

  const getMediaUrl = (fileKey: string, options?: { thumb?: boolean }) => {
    const base = `/api/media?key=${encodeURIComponent(fileKey)}`;
    if (options?.thumb) return `${base}&thumb=1`;
    return base;
  };

  // Tekil Orijinal İndir (ZIP'siz - Kayıpsız JPEG/PNG)
  const downloadSingleFile = (fileKey: string, originalName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const url = `/api/media?key=${encodeURIComponent(fileKey)}&download=1&filename=${encodeURIComponent(originalName)}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('İndirme hatası:', err);
    }
  };

  // Çoklu Dosyaları Güvenle İndir / Paylaş (Mobilde ve Masaüstünde Sıfır Kayıp)
  const downloadMultiplePhotos = async (targetPhotos: any[]) => {
    if (!targetPhotos.length) return;

    if (targetPhotos.length === 1) {
      downloadSingleFile(targetPhotos[0].r2_file_key, targetPhotos[0].original_name);
      return;
    }

    const isMobile = typeof window !== 'undefined' && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent)));

    // Mobilde: Tarayıcılar döngüsel dosya indirmeyi güvenlik nedeniyle engeller (sadece 1 tanesini indirir).
    // Bu yüzden mobilde:
    // 1) Web Share API ile doğrudan "Fotoğraflar / Galeriye Kaydet" menüsünü açar
    // 2) Ya da tek paket ZIP olarak tüm fotoğrafları eksiksiz teslim eder
    if (isMobile) {
      if (typeof navigator !== 'undefined' && (navigator as any).canShare) {
        try {
          setDownloading(true);
          setDownloadPercent(10);
          const files: File[] = [];
          for (let i = 0; i < targetPhotos.length; i++) {
            const p = targetPhotos[i];
            const res = await fetch(getMediaUrl(p.r2_file_key));
            const blob = await res.blob();
            files.push(new File([blob], p.original_name || `foto-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' }));
            setDownloadPercent(Math.round(((i + 1) / targetPhotos.length) * 80));
          }
          if ((navigator as any).canShare({ files })) {
            setDownloadPercent(100);
            await (navigator as any).share({ files, title: `Kapsül Fotoğrafları (${targetPhotos.length})` });
            setDownloading(false);
            return;
          }
        } catch (e: any) {
          if (e.name === 'AbortError') {
            setDownloading(false);
            return;
          }
        }
      }

      // Web Share yoksa veya desteklemiyorsa: Güvenli tek paket ZIP ile tüm fotoğrafları indir
      handleDownloadZip(targetPhotos);
      return;
    }

    // Masaüstünde (PC / Mac): Dosyaları sırayla kayıpsız indir
    setDownloading(true);
    setDownloadPercent(0);
    try {
      for (let i = 0; i < targetPhotos.length; i++) {
        const photo = targetPhotos[i];
        downloadSingleFile(photo.r2_file_key, photo.original_name);
        setDownloadPercent(Math.round(((i + 1) / targetPhotos.length) * 100));
        await new Promise((r) => setTimeout(r, 350));
      }
    } finally {
      setDownloading(false);
      setDownloadPercent(0);
    }
  };

  // Seçilenleri İndir
  const downloadSelectedIndividually = () => {
    const selectedPhotos = photos.filter((p) => selectedIds.has(p.id));
    downloadMultiplePhotos(selectedPhotos);
  };

  // Tüm Fotoğrafları İndir
  const downloadAllIndividually = () => {
    downloadMultiplePhotos(photos);
  };

  // ZIP ile Toplu İndir
  const handleDownloadZip = async (targetPhotos = photos) => {
    if (!targetPhotos.length || downloading) return;
    setDownloading(true);
    setDownloadPercent(0);

    const [{ default: JSZip }, { saveAs }] = await Promise.all([
      import('jszip'),
      import('file-saver'),
    ]);
    const zip = new JSZip();
    const folder = zip.folder(`kapsul-${room.short_id}`);

    try {
      let completed = 0;
      const fetchPromises = targetPhotos.map(async (photo) => {
        try {
          const res = await fetch(getMediaUrl(photo.r2_file_key));
          if (res.ok) {
            const blob = await res.blob();
            folder?.file(photo.original_name, blob);
          }
        } catch (e) {
          console.error('Fotoğraf çekilemedi:', photo.original_name);
        } finally {
          completed++;
          setDownloadPercent(Math.round((completed / targetPhotos.length) * 100));
        }
      });

      await Promise.all(fetchPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `kapsul-${room.short_id}-dump.zip`);
      // ZIP indirildikten sonra mini recap özet kartını patlat
      setTimeout(() => {
        setShowRecapModal(true);
        triggerConfetti({
          particleCount: 50,
          spread: 80,
          origin: { y: 0.3 },
          colors: ['#FFD700', '#CCFF00', '#FF2E93'],
        });
      }, 700);
    } catch (err) {
      alert('ZIP indirme sırasında bir hata oluştu.');
    } finally {
      setDownloading(false);
      setDownloadPercent(0);
    }
  };

  // Fotoğrafı Ekleyen Kişiyi Güvenli Doğrulama
  const checkIsOwner = (uploadedBy: string, photoId?: string) => {
    try {
      const myIds = JSON.parse(localStorage.getItem('snaproom_my_photos') || '[]');
      if (photoId && myIds.includes(photoId)) return true;
    } catch (e) {}

    const cleanNick = (currentNickname || localStorage.getItem('snaproom_nickname') || '').replace(/^@/, '').trim().toLowerCase();
    if (!cleanNick) return false;
    const parsed = parsePhotoUploader(uploadedBy);
    const cleanUploader = (parsed.nick || '').replace(/^@/, '').trim().toLowerCase();
    return cleanUploader.includes(cleanNick) || cleanNick.includes(cleanUploader);
  };

  // Fotoğraf / Ses Silme (Kendi Yükleyen Silebilir)
  const handleDeletePhoto = async (photo: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isOwner = checkIsOwner(photo.uploaded_by, photo.id);
    if (!isOwner) {
      alert('Sadece kendi yüklediğin anıları silebilirsin!');
      return;
    }

    if (!confirm(`"${photo.original_name}" karesini silmek istediğine emin misin?`)) return;

    // 1. ANINDA YEREL HAFIZAYA EKLE (ASLA GERİ GELEMEZ)
    const roomId = room?.id || params.short_id;
    try {
      const localDel = JSON.parse(localStorage.getItem(`snaproom_deleted_${roomId}`) || '[]');
      if (!localDel.includes(photo.id)) {
        localDel.push(photo.id);
        localStorage.setItem(`snaproom_deleted_${roomId}`, JSON.stringify(localDel));
      }
      serverDeletedSet.current.add(photo.id);

      const myIds = JSON.parse(localStorage.getItem('snaproom_my_photos') || '[]');
      localStorage.setItem('snaproom_my_photos', JSON.stringify(myIds.filter((id: string) => id !== photo.id)));
    } catch (e) {}

    // 2. Anında ekrandan uçur
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    if (selectedPhoto?.id === photo.id) setSelectedPhoto(null);
    if (storyIndex !== null && storyItems[storyIndex]?.id === photo.id) {
      nextStory();
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(photo.id);
      return next;
    });

    // 3. Realtime Broadcast ile odadaki herkesin ekranından anında sil
    channelRef.current?.send({
      type: 'broadcast',
      event: 'photo_deleted',
      payload: { photoId: photo.id },
    });

    // 4. Sunucuya bildir (R2'den fiziksel sil + sunucu kara listesine kaydet)
    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey: photo.r2_file_key,
          photoId: photo.id,
        }),
      });
      fetchStorageStats();
    } catch (err) {
      console.error('Silme isteği hatası:', err);
    }
  };

  // Çoklu Seçim
  const toggleSelectPhoto = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPhotos = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(photos.map((p) => p.id)));
    }
  };

  // Youtube Track Güncelleme & Canlı Eşzamanlama
  const handleSaveYoutube = async (videoId: string) => {
    setYoutubeSaving(true);
    let finalUrl = '';
    if (videoId) finalUrl = `yt:${videoId}`;
    
    // Call server-side API to bypass RLS issues for room updates
    await fetch('/api/update-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: room.id, spotify_url: finalUrl }),
    });

    setRoom((prev: any) => ({ ...prev, spotify_url: finalUrl }));
    channelRef.current?.send?.({
      type: 'broadcast',
      event: 'spotify_updated',
      payload: { spotify_url: finalUrl },
    });
    setYoutubeSaving(false);
  };
  
  const searchYoutube = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = youtubeQuery.trim();
    if (!query) return;

    // Doğrudan YouTube linki yapıştırıldıysa anında ID'yi çek ve kaydet
    const urlMatch = query.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (urlMatch && urlMatch[1]) {
      handleSaveYoutube(urlMatch[1]);
      setYoutubeQuery('');
      setYoutubeResults([]);
      return;
    }

    setIsYoutubeSearching(true);
    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.videos) {
        setYoutubeResults(data.videos);
      }
    } catch (err) {}
    setIsYoutubeSearching(false);
  };

  const toggleDisposableMode = async () => {
    if (!room) return;
    const newUnlocked = !room.is_unlocked;
    // Optimistic update
    setRoom({ ...room, is_unlocked: newUnlocked });
    
    try {
      await fetch('/api/update-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: room.id, is_unlocked: newUnlocked }),
      });
    } catch (err) {
      console.error('Failed to toggle lock', err);
      // Revert on failure
      setRoom({ ...room, is_unlocked: !newUnlocked });
    }
  };

  const addReaction = (photoId: string, emoji: string) => {
    setReactions((prev) => {
      const next = {
        ...prev,
        [photoId]: [...(prev[photoId] || []), emoji],
      };
      try {
        localStorage.setItem(`snaproom_reactions_${params.short_id}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // Realtime broadcast: Tüm katılımcılara anlık reaksiyon uçur
    channelRef.current?.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { photoId, emoji },
    });
  };

  const handleAddSelfieReaction = async (payload: SelfieReactionPayload) => {
    if (!room) return;
    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          photoId: payload.photoId,
          userName: payload.userName,
          selfieData: payload.selfieData,
          emoji: payload.emoji,
        }),
      });

      const data = await res.json();
      if (data.reaction) {
        // Yerel durumu anında güncelle
        setSelfieReactions((prev) => ({
          ...prev,
          [payload.photoId]: [...(prev[payload.photoId] || []), data.reaction],
        }));

        // Realtime broadcast: Tüm katılımcılara canlı uçur
        channelRef.current?.send({
          type: 'broadcast',
          event: 'selfie_reaction',
          payload: { reaction: data.reaction },
        });

        // Mini kutlama konfetisi
        triggerConfetti({
          particleCount: 25,
          spread: 50,
          origin: { y: 0.7 },
          colors: ['#CCFF00', '#FF2E93', '#FFFFFF'],
        });

        setLiveToast({
          msg: `📸 @${payload.userName} canlı yüz tepkisini yapıştırdı!`,
          id: Date.now(),
        });
      }
    } catch (err) {
      console.error('Selfie reaction submit error:', err);
    }
  };


  // Vibe Check Fotoğrafları Listesi
  const vibePhotos = useMemo(() => {
    if (!latestVibeCheck) return [];
    const targetId = latestVibeCheck.id;
    return photos
      .filter((p) => {
        if (p.vibe_check_id === targetId) return true;
        if (p.uploaded_by && p.uploaded_by.includes(`__VC:${targetId}`)) return true;
        const startMs = new Date(latestVibeCheck.started_at).getTime();
        const endMs = new Date(latestVibeCheck.expires_at).getTime() + 15 * 60 * 1000;
        const photoMs = new Date(p.created_at || p.taken_at).getTime();
        return photoMs >= startMs && photoMs <= endMs;
      })
      .map((p) => {
        const parsed = parsePhotoUploader(p.uploaded_by);
        const isLate = p.is_late !== undefined ? p.is_late : (
          parsed.isLate || new Date(p.created_at || p.taken_at).getTime() > new Date(latestVibeCheck.expires_at).getTime()
        );
        return {
          ...p,
          is_late: isLate,
        };
      });
  }, [photos, latestVibeCheck]);

  // Vibe Check Tetikleme Fonksiyonu
  const handleTriggerVibeCheck = async () => {
    if (!room?.id) return;
    setIsTriggeringVibe(true);

    try {
      const res = await fetch('/api/vibe-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger',
          roomId: room.id,
          initiatedBy: currentNickname || localStorage.getItem('snaproom_nickname') || 'Biri',
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || 'Vibe Check tetiklenemedi!');
        return;
      }

      if (resData.vibeCheck) {
        setActiveVibeCheck(resData.vibeCheck);
        setLatestVibeCheck(resData.vibeCheck);
        setShowVibeAlert(true);
        playVibeCheckAudio();

        // Realtime kanalı ile herkese anında fırlat
        channelRef.current?.send?.({
          type: 'broadcast',
          event: 'vibe_check_alert',
          payload: resData.vibeCheck,
        });

        triggerConfetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#FF2E93', '#CCFF00', '#FFFFFF', '#FFAA00'],
        });
      }
    } catch (e: any) {
      alert(`Bağlantı hatası: ${e?.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsTriggeringVibe(false);
    }
  };

  const handleVibePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const vId = pendingVibeCheckIdRef.current || latestVibeCheck?.id || activeVibeCheck?.id;
      processFiles(e.target.files, vId);
      pendingVibeCheckIdRef.current = null;
    }
  };

  const handleQuotaExceeded = (msg: string) => {
    setStorageModalMsg(msg);
    setShowStorageModal(true);
    setStorageStats((prev) => ({ ...prev, isExceeded: true }));
  };

  // Kullanıcı Rumuz/Şehir Kaydetme
  const handleSaveUserProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempNick.trim()) return;
    localStorage.setItem('snaproom_nickname', tempNick.trim());
    if (tempCity.trim()) localStorage.setItem('snaproom_city', tempCity.trim());
    setCurrentNickname(tempNick.trim());
    setCurrentCity(tempCity.trim());
    setShowUserModal(false);
  };

  if (roomError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white space-y-4 px-4 text-center">
        <span className="text-6xl">👻</span>
        <h1 className="text-2xl font-black text-[#FF2E93]">Kapsül Bulunamadı</h1>
        <p className="text-neutral-400 font-mono text-sm max-w-sm">
          Bu kapsül ya hiç var olmadı ya da süresi dolduğu için tamamen küle dönüştü.
        </p>
        <button 
          onClick={() => router.push('/')} 
          className="px-6 py-3 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-sm rounded-xl transition cursor-pointer mt-2"
        >
          Ana Sayfaya Dön
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-10 h-10 border-4 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-sm text-neutral-400">ORTAK KAPSÜL BAĞLANIYOR // SHARED VAULT</p>
      </div>
    );
  }

  const isDisposableLocked = room.is_disposable_mode && !room.is_unlocked;
  const capsuleName = room.location || "Günün Ortak Dump'ı ✨";

  // Davet Bağlantısı (PIN girmeden direkt bağlar)
  const shareInviteUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/room/${room.short_id}?token=${room.pin_hash}`
    : '';

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length) {
          processFiles(e.dataTransfer.files);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-screen text-[#F3F4F6] pb-36 selection:bg-[#CCFF00] selection:text-black overflow-x-hidden"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))',
      }}
    >
      
      {/* Gizli Dosya Seçici */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) processFiles(e.target.files);
        }}
      />

      {/* Vibe Check Kamerası (Doğrudan Cihaz Kamerasını Tetikler) */}
      <input
        ref={vibeCameraInputRef}
        type="file"
        accept="image/*"
        style={{ position: 'fixed', top: '-1000px', left: '-1000px', opacity: 0, pointerEvents: 'none' }}
        onChange={handleVibePhotoSelected}
      />

      {/* AMBİYANS IŞIKLARI - SIFIR GPU & BELLEK YÜKÜ (CSS Radial Gradients) */}
      <div 
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-50"
        style={{
          background: 'radial-gradient(circle at 20% 15%, rgba(121,40,202,0.18) 0%, transparent 45%), radial-gradient(circle at 80% 35%, rgba(255,46,147,0.14) 0%, transparent 45%), radial-gradient(circle at 30% 75%, rgba(204,255,0,0.08) 0%, transparent 40%)'
        }}
      />

      {/* OTOMATİK GÜNÜN KAPAĞI AMBİYANS IŞIĞI */}
      {coverPhoto && (
        <div className="hidden md:block absolute top-0 inset-x-0 h-[480px] overflow-hidden pointer-events-none z-0 opacity-25">
          <img
            src={getMediaUrl(coverPhoto.r2_file_key)}
            alt="Günün Kapağı Ambiyans"
            className="w-full h-full object-cover blur-3xl scale-125 filter saturate-200"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#08090E]/30 via-[#08090E]/80 to-[#08090E]" />
        </div>
      )}

      {/* CANLI REALTIME TOAST BİLDİRİMİ */}
      <AnimatePresence>
        {liveToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed inset-x-0 z-50 flex justify-center pointer-events-none px-4"
            style={{
              top: 'max(1.25rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))'
            }}
          >
            <div className="bg-[#12151F]/90 backdrop-blur-sm border-2 border-[#CCFF00] text-white px-5 py-2.5 rounded-full shadow-[0_10px_40px_rgba(204,255,0,0.4)] flex items-center gap-2 text-xs sm:text-sm font-black">
              <Sparkles className="w-4 h-4 text-[#CCFF00] animate-spin" />
              <span>{liveToast.msg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TAM EKRAN DROP OVERLAY */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#08090E]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 border-4 border-dashed border-[#CCFF00]"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="p-6 rounded-3xl bg-[#CCFF00]/20 border-2 border-[#CCFF00] text-[#CCFF00] mb-4 shadow-[0_0_50px_rgba(204,255,0,0.4)]"
            >
              <UploadCloud className="w-16 h-16" />
            </motion.div>
            <h2 className="text-3xl font-black text-white">Anıları Kapsüle Fırlat! 📸</h2>
            <p className="text-sm text-neutral-300 font-mono mt-2">
              KAYIPSIZ KALİTE // HERKESİN ZAMAN TÜNELİNDE AYNI ANDA BELİRECEK
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DYNAMIC ISLAND ÜST KAPSÜL (PWA / Mobil Çentik & Dinamik Ada Uyumlu) */}
      <div 
        className="sticky z-40 px-3 sm:px-6 w-full max-w-5xl mx-auto"
        style={{
          top: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))'
        }}
      >
        <header
          className="rounded-2xl bg-[#12151F]/90 backdrop-blur-xl border border-white/15 px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex items-center justify-between gap-1.5 sm:gap-2 overflow-hidden"
        >
          {/* SOL: Çıkış ve Oda Başlığı (Kırpılma Yok, Ferah) */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              onClick={() => router.push('/')}
              title="Ana Sayfaya ve Kapsüllerime Dön"
              className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 hover:border-[#CCFF00]/40 text-neutral-200 hover:text-white transition shrink-0 flex items-center gap-1.5 cursor-pointer text-xs font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#CCFF00]" />
              <span className="hidden xs:inline">Kapsüllerim</span>
            </button>
            
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse shrink-0" />
              <span className="font-black text-xs sm:text-sm tracking-wide text-white truncate max-w-[95px] xs:max-w-[150px] sm:max-w-none">
                {capsuleName}
              </span>
            </div>
          </div>

          {/* SAĞ: Geri Sayım Süresi & Paylaş */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <CountdownTimer
              createdAt={room?.created_at}
              uploadLockedAt={room?.upload_locked_at}
              roomId={room?.id}
              onExpire={() => setIsExpired(true)}
            />

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const text = `📸 "${capsuleName}" Kapsül Kodu: ${room.short_id}\nDoğrudan bağlanmak için tıkla:\n${shareInviteUrl}`;
                navigator.clipboard.writeText(text);
                alert(`Davet linki ve Kapsül Kodu (${room.short_id}) kopyalandı! WhatsApp grubuna atarak arkadaşlarını topla. ⚡`);
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-full bg-[#CCFF00]/15 hover:bg-[#CCFF00]/25 border border-[#CCFF00]/40 text-[#CCFF00] font-bold text-xs flex items-center gap-1 transition shrink-0 cursor-pointer shadow-sm active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Paylaş</span>
            </motion.button>
          </div>
        </header>
      </div>

      {/* ANA İÇERİK ALANI */}
      <main className="max-w-5xl mx-auto w-full px-3 sm:px-6 pt-5 pb-52 pb-[calc(14rem+env(safe-area-inset-bottom,2rem))] space-y-5">
        
        {/* ========================================================
            CANLI SPOTIFY OYNATICI (ODAYA GİRİNCE OTOMATİK ÇALMA)
           ======================================================== */}
        {(() => {
          if (!room.spotify_url?.startsWith('yt:')) return null;
          const videoId = room.spotify_url.replace('yt:', '');
          return <YoutubePlayer videoId={videoId} onOpenModal={() => setShowYoutubeModal(true)} />;
        })()}

        {/* ========================================================
            SİLİNMEDEN ÖNCEKİ GERİ SAYIM UYARI BANNERI
           ======================================================== */}
        {isClosingSoon && !dismissWarning && !isExpired && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-3 sm:p-4 bg-gradient-to-r from-red-500/20 via-amber-500/20 to-amber-600/15 border-2 border-amber-400 text-white shadow-[0_0_30px_rgba(245,158,11,0.25)] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400 flex items-center justify-center text-amber-300 shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-xs sm:text-sm text-amber-300 flex items-center gap-1.5">
                  ⚠️ Kapsülün Süresi Doluyor! Fotoğraflar Yakında Silinecek
                </h4>
                <p className="text-[11px] text-neutral-300 mt-0.5 leading-tight">
                  Belirlenen süre bittiğinde tüm anılar kalıcı olarak uçacak. Kaybetmemek için hemen tek tıkla indir!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowBulkDownloadModal(true)}
                className="px-3 py-1.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs flex items-center gap-1 shadow-md transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fotoğrafları İndir</span>
              </button>
              <button
                onClick={() => setDismissWarning(true)}
                className="p-1 rounded-full text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ========================================================
            SÜRE DOLDU VE FOTOĞRAFLAR SİLİNDİ BİLDİRİMİ
           ======================================================== */}
        {isExpired && (
          <div className="p-6 sm:p-8 rounded-3xl bg-red-950/40 border-2 border-red-500/40 text-center space-y-2 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-xl">
              ⏳
            </div>
            <h3 className="text-lg font-black text-white">Kapsülün Belirlenen Süresi Doldu</h3>
            <p className="text-xs text-neutral-300 max-w-sm mx-auto leading-relaxed">
              Kapsül için belirlenen süre tamamlandığı için tüm fotoğraflar kalıcı ve güvenli şekilde silindi.
            </p>
          </div>
        )}

        {/* ========================================================
            2. KAT: KOMPAKT PROFİL & DURUM ŞERİDİ
           ======================================================== */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-[#12151F]/60 backdrop-blur-sm border border-white/10 text-xs shadow-lg overflow-hidden">
          {/* Sol: Kullanıcı Profili */}
          <button
            onClick={() => setShowUserModal(true)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#CCFF00]/40 transition group cursor-pointer shrink-0 min-w-0"
            title="Profilini Düzenle"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#CCFF00] to-emerald-400 text-black font-black flex items-center justify-center text-[10px] shrink-0">
              {(currentNickname || 'A')[0].toUpperCase()}
            </div>
            <span className="text-xs font-bold text-white group-hover:text-[#CCFF00] transition truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px]">
              @{currentNickname || 'Anonim'}
            </span>
            {currentCity && <span className="text-[10px] text-neutral-400 font-mono hidden md:inline">📍 {currentCity}</span>}
            <span className="text-[10px] text-[#CCFF00]/70 ml-0.5">🟢</span>
          </button>

          {/* Sağ: Aktif Galeridekiler + Günün Kapağı + Disposable Kilit Durumu */}
          <div className="flex items-center gap-1.5 xs:gap-2 shrink-0">
            {/* Aktif Kişi Sayacı */}
            <div 
              title="Şu an galerideki aktif kişi sayısı"
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold shrink-0"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>{activeViewers} kişi</span>
            </div>

            {/* Günün Kapağı (Varsa) */}
            {coverPhoto && (
              <button
                onClick={() => {
                  const idx = storyItems.findIndex((p) => p.id === coverPhoto.id);
                  if (idx !== -1) setStoryIndex(idx);
                }}
                title="Günün Kapağını Story Modunda İzle"
                className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[11px] font-bold transition cursor-pointer shrink-0"
              >
                <span>👑</span>
                <span className="truncate max-w-[80px]">@{parsePhotoUploader(coverPhoto.uploaded_by).nick}</span>
              </button>
            )}

            {/* Disposable Kilit Butonu */}
            <button
              onClick={toggleDisposableMode}
              title={room.is_unlocked ? 'Canlı Akış Aktif (Herkes anlık görüyor)' : 'Disposable Kilitli (Süre sonu açılır)'}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer shrink-0 ${
                room.is_unlocked
                  ? 'bg-white/10 text-neutral-300 hover:bg-white/15 border border-white/15'
                  : 'bg-[#FF2E93]/20 border border-[#FF2E93]/40 text-[#FF2E93]'
              }`}
            >
              {room.is_unlocked ? (
                <>
                  <Unlock className="w-3 h-3 text-[#CCFF00]" />
                  <span>Canlı</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-[#FF2E93]" />
                  <span>Kilitli</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================
            3. KAT: KAPSÜL DÜĞMELERİ (Mobilde Tam Görünür Izgara / Masaüstünde Esnek Şerit)
           ======================================================== */}
        <div className="rounded-2xl p-2.5 sm:p-3 bg-[#12151F]/60 border border-white/10 backdrop-blur-sm shadow-md space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono font-bold text-neutral-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
              <span>KAPSÜL DÜĞMELERİ</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              Hızlı Kontroller ⚡
            </span>
          </div>

          {/* DÜĞME IZGARASI (Mobilde alt alta 2-3 kolon ızgara, masaüstünde esnek şerit) */}
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:flex md:flex-wrap items-center gap-2 py-1">
            {/* 0. NEREYE AKSAK? (MASA GURMESİ & RADAR) */}
            <button
              onClick={() => setShowPlaceRadar(true)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border bg-[#CCFF00]/15 hover:bg-[#CCFF00]/25 border-[#CCFF00]/50 text-[#CCFF00] font-black text-xs transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)] active:scale-95"
              title="Nereye Aksak? (Masa Gurmesi AI & Radar)"
            >
              <MapPin className="w-4 h-4 text-[#CCFF00]" />
              <span className="whitespace-nowrap">📍 Nereye Aksak?</span>
            </button>

            {/* 1. MÜZİK (YOUTUBE ŞARKI ARA & OYNAT) */}
            <button
              onClick={() => setShowYoutubeModal(true)}
              className={`min-h-[44px] px-3 py-2 rounded-xl border transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-95 ${
                room.spotify_url
                  ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-200 hover:text-white'
              }`}
              title="YouTube'dan Şarkı Ara ve Odaya Ekle"
            >
              <Music className={`w-4 h-4 ${room.spotify_url ? 'text-red-400 animate-pulse' : 'text-neutral-300'}`} />
              <span className="text-xs font-bold whitespace-nowrap">
                {room.spotify_url ? 'Müzik Çalıyor 🎵' : 'Müzik 🎵'}
              </span>
            </button>

            {/* 2. EN'LER (RECAP) */}
            <button
              onClick={() => {
                setShowRecapModal(true);
                triggerConfetti({
                  particleCount: 40,
                  spread: 60,
                  origin: { y: 0.2 },
                  colors: ['#FFD700', '#CCFF00', '#FF2E93'],
                });
              }}
              className={`min-h-[44px] px-3 py-2 rounded-xl border transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-95 ${
                isClosingSoon
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-200 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold whitespace-nowrap">En'ler</span>
            </button>

            {/* 3. GÜNÜN FATURASI */}
            <button
              onClick={() => {
                setShowReceiptModal(true);
                triggerConfetti({
                  particleCount: 40,
                  spread: 60,
                  origin: { y: 0.2 },
                  colors: ['#000000', '#FFFFFF', '#CCFF00'],
                });
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 text-neutral-200 hover:text-white transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-95"
            >
              <Receipt className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-bold whitespace-nowrap">Fatura</span>
            </button>

            {/* 4. KATILIMCILAR */}
            <button
              onClick={() => setShowParticipantsModal(true)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-[#FF2E93]/20 border border-white/10 hover:border-[#FF2E93]/40 text-neutral-200 hover:text-[#FF2E93] transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-95"
            >
              <Users className="w-4 h-4 text-[#FF2E93]" />
              <span className="text-xs font-bold whitespace-nowrap">
                {allRoomParticipants.length > 0 ? `${allRoomParticipants.length} Kişi` : 'Katılımcılar'}
              </span>
            </button>

            {/* 5. QR KOD */}
            <button
              onClick={() => setShowQrModal(true)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#CCFF00]/40 text-neutral-200 hover:text-white transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-95"
            >
              <QrCode className="w-4 h-4 text-[#CCFF00]" />
              <span className="text-xs font-bold whitespace-nowrap">QR Kod</span>
            </button>

            {/* 6. VİBE CHECK */}
            <button
              onClick={handleTriggerVibeCheck}
              disabled={isTriggeringVibe}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-red-600/15 hover:bg-red-600/30 border border-red-500/35 text-amber-300 transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold whitespace-nowrap">Vibe Check</span>
            </button>

            {/* 7. 10S KLİP (REELS) */}
            <button
              onClick={() => setShowReelsModal(true)}
              disabled={photos.length === 0}
              className="col-span-2 xs:col-span-1 sm:col-span-1 md:col-auto min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-[#CCFF00]/15 border border-white/10 hover:border-[#CCFF00]/40 text-neutral-200 hover:text-[#CCFF00] transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-95 disabled:opacity-30"
            >
              <Film className="w-4 h-4 text-[#CCFF00]" />
              <span className="text-xs font-bold whitespace-nowrap">10s Klip</span>
            </button>
          </div>

          {/* HIZLI FISILTI & DM AVATAR ÇUBUĞU (Story Çemberleri) */}
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              {/* GENEL MASA */}
              <button
                onClick={() => {
                  setSelectedChatTarget(null);
                  setShowChatDrawer(true);
                }}
                className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer"
              >
                <div className="relative w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-[#CCFF00] via-emerald-400 to-[#CCFF00] group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(204,255,0,0.3)]">
                  <div className="w-full h-full rounded-full bg-[#12151F] flex items-center justify-center text-sm">
                    💬
                  </div>
                </div>
                <span className="text-[10px] font-bold text-neutral-300 group-hover:text-[#CCFF00] transition">
                  Genel
                </span>
              </button>

              {/* KATILIMCILAR */}
              {allRoomParticipants
                .filter((p) => p !== currentNickname?.replace(/^@/, ''))
                .map((nick) => {
                  const hasRecentMsg = recentChat?.sender === nick;
                  return (
                    <button
                      key={nick}
                      onClick={() => openDirectChatWith(nick)}
                      className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer"
                    >
                      <div className={`relative w-11 h-11 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
                        hasRecentMsg
                          ? 'bg-gradient-to-tr from-[#FF2E93] via-violet-500 to-[#CCFF00] animate-pulse shadow-[0_0_15px_rgba(255,46,147,0.5)]'
                          : 'bg-gradient-to-tr from-violet-600/70 to-pink-500/70 hover:from-violet-500 hover:to-[#CCFF00]'
                      }`}>
                        <div className="w-full h-full rounded-full bg-[#0D0F18] flex items-center justify-center font-black text-xs text-white">
                          {nick.slice(0, 1).toUpperCase()}
                        </div>
                        {hasRecentMsg && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#FF2E93] text-[8px] flex items-center justify-center text-white font-bold shadow-md animate-bounce">
                            💬
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-neutral-300 group-hover:text-white transition truncate max-w-[56px]">
                        @{nick}
                      </span>
                    </button>
                  );
                })}

              {allRoomParticipants.filter((p) => p !== currentNickname?.replace(/^@/, '')).length === 0 && (
                <div className="text-[11px] text-neutral-400 font-mono py-1.5 pl-1">
                  Arkadaşların odaya katıldığında hızlı fısıltı çemberi burada parlayacak ✨
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Yükleme Devam Ediyorsa Progress Bar */}
        <AnimatePresence>
          {uploading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-[#12151F] border border-[#CCFF00]/40 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(204,255,0,0.2)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-xs font-black text-white">
                    Kayıpsız Yükleniyor ({uploadProgress.current}/{uploadProgress.total})
                  </p>
                  <p className="text-[10px] text-neutral-400 font-mono">DIRECT TO CLOUDFLARE R2</p>
                </div>
              </div>
              <div className="w-36 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#CCFF00]"
                  style={{
                    width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%`,
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================
            4. KAT: GALERİ BAŞLIĞI & AKSİYONLARI (Zaman Tüneli)
           ======================================================== */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3">
            {/* Başlık ve Anı Sayısı */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Zaman Tüneli</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-neutral-300 font-mono font-bold">
                  {photos.length} Anı
                </span>
              </h2>
            </div>

            {/* İki Geniş Parmak Dostu Buton (Geniş 2'li Grid) */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 w-full">
                {/* 🔥 AYIKLA (TINDER MODU) BUTONU */}
                <button
                  onClick={() => setShowSwipeModal(true)}
                  className="min-h-[46px] w-full text-xs sm:text-sm font-bold px-3 py-2.5 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white transition cursor-pointer flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                >
                  <Flame className="w-4 h-4 text-orange-400 fill-orange-400 shrink-0" />
                  <span className="truncate">Ayıkla (Tinder)</span>
                </button>

                {/* 📥 SEÇEREK İNDİR BUTONU */}
                <button
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    if (isSelectMode) setSelectedIds(new Set());
                  }}
                  className={`min-h-[46px] w-full text-xs sm:text-sm font-bold px-3 py-2.5 rounded-2xl border transition cursor-pointer flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] ${
                    isSelectMode
                      ? 'bg-[#CCFF00] text-black border-[#CCFF00] font-black'
                      : 'bg-white/5 border-white/10 text-neutral-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span className="truncate">{isSelectMode ? 'Seçimi Bitir' : 'Seçerek İndir'}</span>
                </button>
              </div>
            )}
          </div>

          {/* ÇOKLU SEÇİM KONTROL ŞERİDİ */}
          <AnimatePresence>
            {isSelectMode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 sm:p-4 rounded-2xl bg-[#12151F] border border-white/20 flex flex-wrap items-center justify-between gap-3 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={selectAllPhotos}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#CCFF00] hover:underline cursor-pointer"
                  >
                    {selectedIds.size === photos.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    <span>{selectedIds.size === photos.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}</span>
                  </button>
                  <span className="text-xs font-mono text-neutral-400">
                    ({selectedIds.size} / {photos.length} seçildi)
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* 1. TEMEL / BİRİNCİL: KAYIPSIZ JPEG / PNG */}
                  <button
                    onClick={downloadSelectedIndividually}
                    disabled={selectedIds.size === 0}
                    className="px-3.5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer shadow-sm"
                  >
                    <FileDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Seçilenleri İndir (Kayıpsız JPEG/PNG)</span>
                  </button>

                  {/* 2. EKSTRA / YAN SEÇENEK: ZIP */}
                  <button
                    onClick={() => {
                      const selected = photos.filter((p) => selectedIds.has(p.id));
                      handleDownloadZip(selected);
                    }}
                    disabled={selectedIds.size === 0}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Ekstra: ZIP</span>
                  </button>

                  {/* 3. SEÇİLENLERLE 10S VİDEO YAP */}
                  <button
                    onClick={() => setShowReelsModal(true)}
                    disabled={selectedIds.size === 0}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-[#CCFF00]/20 hover:from-emerald-500/30 hover:to-[#CCFF00]/30 border border-[#CCFF00]/40 text-[#CCFF00] font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>🎬 Video Yap</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ⚡ O ANIN VİTRİNİ (VIBE CHECK SPLIT BENTO SHOWCASE) */}
          {latestVibeCheck && (
            <VibeCheckShowcase
              vibeCheck={latestVibeCheck}
              photos={vibePhotos}
              capsuleName={capsuleName}
              getMediaUrl={getMediaUrl}
              onTakePhoto={() => handleTriggerVibePhoto(latestVibeCheck.id)}
              isActive={Boolean(activeVibeCheck && new Date(activeVibeCheck.expires_at).getTime() > Date.now())}
            />
          )}

          {/* BOŞ DURUM (EMPTY STATE - Locket & Gen-Z Neon Polaroid Vizörü) */}
          {photos.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group relative my-4 sm:my-8 py-10 sm:py-16 px-4 sm:px-8 rounded-3xl bg-[#12151F] border-2 border-[#CCFF00]/40 hover:border-[#CCFF00] flex flex-col items-center justify-center text-center cursor-pointer transition-all overflow-hidden shadow-[0_0_50px_rgba(204,255,0,0.15)] hover:shadow-[0_0_70px_rgba(204,255,0,0.3)] select-none"
            >
              {/* Arka plan hafif neon vizör ışıması */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(204,255,0,0.08)_0%,transparent_60%)] pointer-events-none" />

              {/* Hafif yan duran Polaroid vizör kartı (-3 derece eğimli) */}
              <div className="relative -rotate-3 group-hover:rotate-0 transition-transform duration-300 w-48 sm:w-60 bg-white p-3 pb-8 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] border border-white/50 mb-5">
                {/* Vizör Ekranı */}
                <div className="aspect-square rounded-xl bg-[#090A0F] border-2 border-dashed border-[#CCFF00]/60 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                  {/* Vizör Köşeleri */}
                  <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-[#CCFF00]" />
                  <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-[#CCFF00]" />
                  <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-[#CCFF00]" />
                  <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-[#CCFF00]" />

                  {/* Yanıp Sönen Vizör Hedefi */}
                  <div className="w-16 h-16 rounded-full border border-[#CCFF00]/30 flex items-center justify-center mb-2 animate-pulse">
                    <Camera className="w-8 h-8 text-[#CCFF00] drop-shadow-[0_0_15px_rgba(204,255,0,0.8)]" />
                  </div>
                  <span className="font-mono text-[9px] text-[#CCFF00] tracking-wider uppercase font-black">
                    [ VİZÖR HAZIR ]
                  </span>
                </div>
                <p className="mt-2.5 text-center font-black text-neutral-800 text-xs tracking-tight">
                  ortamı başlat ⚡
                </p>
              </div>

              {/* Başlık ve Açıklama */}
              <div className="space-y-2 max-w-md relative z-10">
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                  <span>📸 İLK KAREYİ SEN FIRLAT</span>
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed px-4">
                  Kapsül henüz boş. Ortamı başlatmak için aşağıdaki <span className="text-[#CCFF00] font-bold">+</span>&apos;ya dokun veya buraya bas!
                </p>
              </div>

              {/* Hızlı Aksiyon Butonları */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 relative z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-6 py-3 rounded-full bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.5)] cursor-pointer active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4 fill-black" />
                  <span>İlk Anıyı Fırlat 📸</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowVoiceModal(true);
                  }}
                  className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-white/15 cursor-pointer active:scale-95 transition-all"
                >
                  <Mic className="w-4 h-4 text-[#FF2E93]" />
                  <span>Ses Bırak 🎙️</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================
               MODERN POLAROID GRID (ZAMAN TÜNELİ DİZİLİMİ - DÜZGÜN & HİZALI)
               ======================================================== */
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-6">
              {photos.map((photo) => {
                const photoReactions = reactions[photo.id] || [];
                const timeString = photo.taken_at
                  ? new Date(photo.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Şimdi';
                
                const isSelected = selectedIds.has(photo.id);
                const isOwner = checkIsOwner(photo.uploaded_by, photo.id);
                const isCover = photo.id === coverPhoto?.id && reactions[coverPhoto.id]?.length > 0;
                const parsed = parsePhotoUploader(photo.uploaded_by);
                const dev = parsed.device || deviceMap[photo.id];
                const deviceBadge = getDeviceBadge(dev, photo.taken_at || photo.created_at);

                return (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    isSelected={isSelected}
                    isSelectMode={isSelectMode}
                    isDisposableLocked={isDisposableLocked}
                    isOwner={isOwner}
                    timeString={timeString}
                    isCover={isCover}
                    photoReactions={photoReactions}
                    selfieReactionsList={selfieReactions[photo.id] || []}
                    deviceBadge={deviceBadge}
                    uploaderNick={parsed.nick}
                    getMediaUrl={getMediaUrl}
                    onCardClick={(e) => {
                      if (isSelectMode) {
                        toggleSelectPhoto(photo.id, e);
                      } else if (!isDisposableLocked) {
                        const sIdx = storyItems.findIndex((p) => p.id === photo.id);
                        if (sIdx !== -1) {
                          setStoryIndex(sIdx);
                          setStoryProgress(0);
                        } else {
                          setSelectedPhoto(photo);
                        }
                      }
                    }}
                    onDoubleClick={() => addReaction(photo.id, '🔥')}
                    onDownload={(e) => downloadSingleFile(photo.r2_file_key, photo.original_name, e)}
                    onDelete={(e) => handleDeletePhoto(photo, e)}
                    onChatReply={(e) => {
                      e.stopPropagation();
                      setChatReplyPhoto(photo);
                      setShowChatDrawer(true);
                    }}
                    onSelfieReaction={() => setSelfieTargetPhoto(photo)}
                    audioPlayerState={audioPlayerState}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* GÜNÜN EN'LERİ ANKET KARTI */}
        <div className="pt-4">
          <PollsCard roomId={room?.id || params.short_id} channel={channelState} />
        </div>

      
      <AuthModal 
        forceLogin={true}
        isOpen={showAuthModal} 
        onClose={() => {}} 
        onSuccess={(newUser: any) => {
          setShowAuthModal(false);
          const username = newUser.user_metadata?.username || newUser.email?.split('@')[0];
          if (username) {
            localStorage.setItem('snaproom_nickname', username);
            setCurrentNickname(username);
          } else {
            setShowUserModal(true);
          }
          fetchData();
        }} 
      />
</main>

      {/* ========================================================
          YÜZEN ALT CAM DOCK (Locket + Modern Mobile Floating Island - SIFIR TAŞMA)
         ======================================================== */}
      <div 
        className="fixed inset-x-0 z-40 px-2.5 sm:px-4 pointer-events-none"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
      >
        <div className="w-full max-w-[390px] mx-auto pointer-events-auto bg-[#12151F]/95 backdrop-blur-xl border border-white/20 rounded-full p-1.5 px-2.5 sm:p-2 sm:px-3 shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex items-center justify-between gap-1.5 sm:gap-2 overflow-hidden">
          {/* SOL: Son DM Balonu / Hapı */}
          <button
            onClick={() => {
              if (recentChat?.sender && recentChat.sender !== currentNickname) {
                openDirectChatWith(recentChat.sender);
              } else {
                setSelectedChatTarget(null);
                setShowChatDrawer(true);
              }
            }}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/50 transition cursor-pointer flex-1 min-w-0 max-w-[105px] xs:max-w-[125px] sm:max-w-[150px]"
            title="Son Sohbete Git"
          >
            <div className="relative shrink-0">
              <span className="w-6 h-6 rounded-full bg-violet-600/40 border border-violet-400 flex items-center justify-center text-xs">
                💬
              </span>
              {recentChat && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
              )}
            </div>
            <div className="flex flex-col text-left truncate min-w-0">
              <span className="text-[10px] font-bold text-violet-300 truncate leading-tight">
                {recentChat ? `@${recentChat.sender}` : 'Sohbet'}
              </span>
              <span className="text-[8.5px] text-neutral-400 truncate leading-tight">
                {recentChat ? recentChat.text : 'Fısılda...'}
              </span>
            </div>
          </button>

          {/* ORTA: DEV NEON YEŞİL + FOTOĞRAF BAS BUTONU */}
          <motion.button
            whileHover={{ scale: storageStats.isExceeded ? 1 : 1.05 }}
            whileTap={{ scale: storageStats.isExceeded ? 1 : 0.95 }}
            onClick={() => {
              if (storageStats.isExceeded) {
                handleQuotaExceeded('Kasa şu an dolu, fotoğraf yüklenemiyor 🛑');
                return;
              }
              fileInputRef.current?.click();
            }}
            disabled={storageStats.isExceeded}
            className={`flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-black text-xs sm:text-sm transition-all cursor-pointer shrink-0 shadow-lg ${
              storageStats.isExceeded
                ? 'bg-[#FF2E93]/30 text-[#FF2E93] border border-[#FF2E93]/50 cursor-not-allowed'
                : 'bg-[#CCFF00] text-black shadow-[0_0_25px_rgba(204,255,0,0.5)] hover:shadow-[0_0_35px_rgba(204,255,0,0.7)]'
            }`}
          >
            {storageStats.isExceeded ? (
              <>
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Dolu</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                <span className="tracking-wide">+ FOTO</span>
              </>
            )}
          </motion.button>

          {/* SAĞ: HIZLI AKSİYONLAR (Ses Kaydet & Vibe) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* YENİ: MEKAN RADARI BUTONU */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPlaceRadar(true)}
              title="Mekan Radarı (AI)"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#CCFF00]/20 hover:bg-[#CCFF00]/30 border border-[#CCFF00]/40 text-[#CCFF00] flex items-center justify-center transition cursor-pointer shadow-sm active:scale-95"
            >
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </motion.button>

            {/* SES KAYDET BUTONU */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowVoiceModal(true)}
              title="Ses Kaydet"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#7928CA]/25 hover:bg-[#7928CA]/40 border border-[#7928CA]/40 text-[#FF2E93] flex items-center justify-center transition cursor-pointer shadow-sm active:scale-95"
            >
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF2E93]" />
            </motion.button>

            {/* VİBE TETİKLEYİCİ */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTriggerVibeCheck}
              disabled={isTriggeringVibe}
              title="🚨 Vibe Check Patlat"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-600/20 hover:bg-red-600/35 border border-red-500/40 text-amber-400 flex items-center justify-center transition cursor-pointer shadow-sm active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 animate-pulse" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* ========================================================
          SESLİ ANI (VOICE DUMP) KAYIT MODALI
         ======================================================== */}
      <AnimatePresence>
        {showVoiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => {
              if (!isRecording) closeVoiceModal();
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border border-white/20 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-violet-300">5-10 SN SESLİ DUMP</span>
                <button
                  onClick={closeVoiceModal}
                  disabled={isRecording}
                  className="p-1 text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Animasyonlu Mikrofon & Dinleme Dairesi */}
              <div className="relative my-4 flex justify-center">
                <button
                  type="button"
                  onClick={audioBlob && !isRecording ? togglePreview : undefined}
                  className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all ${
                    isRecording 
                      ? 'bg-[#FF2E93]/20 border-2 border-[#FF2E93] shadow-[0_0_40px_rgba(255,46,147,0.5)] animate-pulse'
                      : audioBlob
                      ? 'bg-[#CCFF00]/20 border-2 border-[#CCFF00] shadow-[0_0_30px_rgba(204,255,0,0.3)] hover:scale-105 cursor-pointer'
                      : 'bg-white/5 border border-white/15'
                  }`}
                >
                  {isRecording ? (
                    <Mic className="w-12 h-12 text-[#FF2E93]" />
                  ) : audioBlob ? (
                    isPlayingPreview ? (
                      <>
                        <Pause className="w-10 h-10 text-[#CCFF00] fill-[#CCFF00]" />
                        <span className="text-[10px] font-black text-[#CCFF00] mt-1 font-mono tracking-wider">DURDUR</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-10 h-10 text-[#CCFF00] fill-[#CCFF00] ml-1" />
                        <span className="text-[10px] font-black text-[#CCFF00] mt-1 font-mono tracking-wider">DİNLE</span>
                      </>
                    )
                  ) : (
                    <Mic className="w-12 h-12 text-neutral-400" />
                  )}
                </button>
              </div>

              <div>
                <p className="font-mono text-2xl font-black text-white">
                  00:{String(recordSeconds).padStart(2, '0')} / 00:10
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  {isRecording 
                    ? 'Kayıt yapılıyor... Konuş veya ortamın sesini yakala!' 
                    : audioBlob 
                    ? (isPlayingPreview ? 'Ses kaydı dinleniyor... 🎧' : 'Kayıt hazır! Ortadaki butona basarak dinleyebilir veya kapsüle atabilirsin.') 
                    : 'Butona basıp 5-10 saniyelik sesli anını kaydet.'}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                {!isRecording && !audioBlob && (
                  <button
                    onClick={startVoiceRecording}
                    className="w-full py-3.5 rounded-2xl bg-[#FF2E93] hover:bg-[#ff1a88] text-white font-black text-xs transition cursor-pointer shadow-[0_0_25px_rgba(255,46,147,0.4)]"
                  >
                    Kaydı Başlat 🎙️
                  </button>
                )}

                {isRecording && (
                  <button
                    onClick={stopVoiceRecording}
                    className="w-full py-3.5 rounded-2xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs transition cursor-pointer shadow-[0_0_25px_rgba(204,255,0,0.4)]"
                  >
                    Durdur & Kaydet ⏹️
                  </button>
                )}

                {audioBlob && !isRecording && (
                  <>
                    <button
                      onClick={startVoiceRecording}
                      className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-neutral-300 font-bold text-xs transition cursor-pointer"
                    >
                      Tekrar Çek
                    </button>
                    <button
                      onClick={uploadVoiceDump}
                      disabled={voiceUploading}
                      className="flex-1 py-3 rounded-2xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs transition cursor-pointer disabled:opacity-50 shadow-[0_0_25px_rgba(204,255,0,0.4)]"
                    >
                      {voiceUploading ? 'Fırlatılıyor...' : 'Kapsüle Fırlat 🚀'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================
          DAVET EDİLEN KULLANICI PROFİL MODALI (RUMUZ & ŞEHİR)
         ======================================================== */}
      <AnimatePresence>
        {showUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-[#12151F] border border-white/20 rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 text-center shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 flex items-center justify-center mx-auto text-[#CCFF00]">
                <Globe className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Kapsüle Katılıyorsun! ⚡</h3>
                <p className="text-xs text-neutral-300 mt-1">
                  Arkadaşların seni tanısın ve nereden bağlandığını bilsin:
                </p>
              </div>

              <form onSubmit={handleSaveUserProfile} className="space-y-3">
                <input
                  type="text"
                  placeholder="Rumuzun (Örn: Selin) *"
                  value={tempNick}
                  required
                  onChange={(e) => setTempNick(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 text-white placeholder:text-neutral-500 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-[#CCFF00]"
                />

                <input
                  type="text"
                  placeholder="Şu an neredesin? (Örn: İzmir, Çekmeköy...)"
                  value={tempCity}
                  onChange={(e) => setTempCity(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 text-white placeholder:text-neutral-500 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-[#CCFF00]"
                />

                <button
                  type="submit"
                  disabled={!tempNick.trim()}
                  className="w-full py-3.5 rounded-xl bg-[#CCFF00] text-black font-black text-xs hover:bg-[#b8e600] transition disabled:opacity-50 cursor-pointer"
                >
                  Kapsüle Dal 🚀
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KATILIMCILAR MODALI */}
      <AnimatePresence>
        {showParticipantsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowParticipantsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border border-white/15 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-white font-black text-lg">
                  <Users className="w-5 h-5 text-[#FF2E93]" />
                  <h3>Kapsüldekiler</h3>
                </div>
                <button
                  onClick={() => setShowParticipantsModal(false)}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                {(() => {
                  const activeNicks = new Set(liveViewers);
                  const uploadedNicks = Object.keys(recapData?.uploaderCounts || {});
                  
                  // Merge live and uploaded, prioritizing live
                  const allParticipants = new Set([...activeNicks, ...uploadedNicks]);
                  
                  if (allParticipants.size === 0) {
                    return <p className="text-sm text-neutral-500 text-center py-4">Henüz kimse yok.</p>;
                  }

                  return Array.from(allParticipants).map((nick, idx) => {
                    const isLive = activeNicks.has(nick);
                    const hasUploaded = uploadedNicks.includes(nick);
                    const uploadedData = recapData?.uploaderCounts[nick];
                    
                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-neutral-600'}`} />
                          <div>
                            <p className="text-sm font-bold text-white leading-tight">{nick}</p>
                            {uploadedData?.display && uploadedData.display !== nick && (
                              <p className="text-[10px] text-neutral-500 mt-0.5">{uploadedData.display}</p>
                            )}
                          </div>
                        </div>
                        {hasUploaded && (
                          <span className="text-[10px] font-black bg-[#CCFF00]/10 text-[#CCFF00] px-2 py-0.5 rounded-full border border-[#CCFF00]/20">
                            {uploadedData?.count} Katkı
                          </span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* YOUTUBE MODALI */}
      <AnimatePresence>
        {showYoutubeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowYoutubeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border border-white/15 rounded-3xl p-5 sm:p-7 max-w-md w-full space-y-4 shadow-2xl my-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-500">
                    <Music className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Kapsülün Şarkısı 🎧
                    </h3>
                    <p className="text-[11px] text-neutral-400">
                      YouTube'dan şarkı ara ve odaya ekle
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowYoutubeModal(false)}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ÇALAN ŞARKI GÖSTERİCİ (YOUTUBE EMBED PLAYER) */}
              {(() => {
                if (room.spotify_url?.startsWith('yt:')) {
                  const videoId = room.spotify_url.replace('yt:', '');
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-300 px-1">
                        <span className="flex items-center gap-1.5 text-red-500">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          Şu An Odada Çalıyor
                        </span>
                        <button
                          onClick={() => handleSaveYoutube('')}
                          disabled={youtubeSaving}
                          className="text-neutral-400 hover:text-red-400 text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Şarkıyı Kaldır
                        </button>
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-red-500/30 shadow-[0_0_25px_rgba(255,0,0,0.2)] bg-black/70">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&controls=1`}
                          width="100%"
                          height="152"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          loading="lazy"
                          className="w-full rounded-xl"
                        />
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                    <Disc3 className="w-7 h-7 text-neutral-400 mx-auto" />
                    <p className="text-xs font-bold text-white">Şu an seçili müzik yok</p>
                  </div>
                );
              })()}

              {/* ÖZEL LİNK GİRME / ARAMA */}
              <div className="space-y-2 pt-1">
                <form onSubmit={searchYoutube} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="YouTube'da şarkı ara (Örn: Sezen Aksu)..."
                    value={youtubeQuery}
                    onChange={(e) => setYoutubeQuery(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/15 text-white placeholder:text-neutral-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={isYoutubeSearching || !youtubeQuery.trim()}
                    className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-xs flex items-center justify-center gap-1 transition disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isYoutubeSearching ? '...' : 'Ara 🔍'}
                  </button>
                </form>
              </div>

              {/* ARAMA SONUÇLARI */}
              {youtubeResults.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    🎵 Arama Sonuçları
                  </p>
                  <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                    {youtubeResults.map((video) => (
                      <button
                        key={video.id}
                        onClick={() => {
                          handleSaveYoutube(video.id);
                          setYoutubeResults([]);
                          setYoutubeQuery('');
                        }}
                        disabled={youtubeSaving}
                        className="flex gap-3 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition cursor-pointer text-left"
                      >
                        <img src={video.thumbnail} alt={video.title} className="w-20 h-14 object-cover rounded-md bg-black" />
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <p className="text-xs font-bold text-white truncate">{video.title}</p>
                          <p className="text-[10px] text-neutral-400 mt-1">{video.author} • {video.duration}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KOTA DOLDU UYARI TOAST / MODAL */}
      <AnimatePresence>
        {showStorageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowStorageModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border-2 border-[#FF2E93] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-[0_0_50px_rgba(255,46,147,0.35)]"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#FF2E93]/20 border border-[#FF2E93]/50 flex items-center justify-center mx-auto text-[#FF2E93]">
                <ShieldAlert className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">
                  Kasa Şu An Dolu 🛑
                </h3>
                <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
                  {storageModalMsg || 'Kasa şu an dolu, fotoğraf yüklenemiyor. Eski anıların 48 saatlik otomatik temizliğini bekleyin.'}
                </p>
              </div>
              <button
                onClick={() => setShowStorageModal(false)}
                className="w-full py-3.5 rounded-2xl bg-[#FF2E93] hover:bg-[#ff1a88] text-white font-black text-xs transition cursor-pointer"
              >
                Anladım
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STORY MODU (INSTAGRAM / SNAPCHAT STYLE FULLSCREEN TAP-TO-ADVANCE) */}
      <AnimatePresence>
        {currentStoryPhoto && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/98 backdrop-blur-md flex flex-col select-none touch-none"
            onPointerDown={() => setIsStoryPaused(true)}
            onPointerUp={() => setIsStoryPaused(false)}
          >
            {/* 1. ÜST İNCE İLERLEME ÇUBUĞU (SEGMENTED PROGRESS BARS) */}
            <div 
              className="absolute top-0 inset-x-0 z-30 px-3 sm:px-6"
              style={{
                paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))'
              }}
            >
              <div className="flex items-center gap-1.5 w-full max-w-2xl mx-auto">
                {storyItems.map((item, idx) => {
                  let fill = 0;
                  if (idx < storyIndex!) fill = 100;
                  else if (idx === storyIndex!) fill = storyProgress;
                  else fill = 0;

                  return (
                    <div
                      key={item.id}
                      className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm"
                    >
                      <div
                        className="h-full bg-white transition-[width] ease-linear duration-75"
                        style={{ width: `${fill}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* 2. STORY HEADER (KULLANICI KÜNYESİ + EXIF + AKSİYONLAR) */}
              <div className="flex items-center justify-between pt-3 max-w-2xl mx-auto">
                {/* Sol: Yükleyen & Cihaz Künyesi */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#CCFF00] to-emerald-400 text-black font-black flex items-center justify-center text-xs shadow-md shrink-0">
                    {parsePhotoUploader(currentStoryPhoto.uploaded_by).nick.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-white truncate">
                        @{parsePhotoUploader(currentStoryPhoto.uploaded_by).nick}
                      </span>
                      {currentStoryPhoto.id === coverPhoto?.id && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-black uppercase">
                          👑 Kapak
                        </span>
                      )}
                    </div>
                    {/* Cihaz & Zaman Bilgisi */}
                    <div className="text-[11px] font-mono text-neutral-300 truncate">
                      {getDeviceBadge(
                        parsePhotoUploader(currentStoryPhoto.uploaded_by).device || deviceMap[currentStoryPhoto.id],
                        currentStoryPhoto.taken_at || currentStoryPhoto.created_at
                      ) || 'Az önce'}
                    </div>
                  </div>
                </div>

                {/* Sağ: İndir, Sil, Kapat Butonları */}
                <div 
                  className="flex items-center gap-2 shrink-0"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Orijinal Kayıpsız İndir */}
                  <button
                    onClick={(e) => downloadSingleFile(currentStoryPhoto.r2_file_key, currentStoryPhoto.original_name, e)}
                    title="Kayıpsız Orijinal İndir"
                    className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-white/10 hover:bg-[#CCFF00] hover:text-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">İndir</span>
                  </button>

                  {/* Silme Butonu (Sadece yükleyen kişiye) */}
                  {checkIsOwner(currentStoryPhoto.uploaded_by, currentStoryPhoto.id) && (
                    <button
                      onClick={(e) => {
                        handleDeletePhoto(currentStoryPhoto, e);
                        nextStory();
                      }}
                      title="Sil"
                      className="p-2 rounded-full bg-red-950/80 hover:bg-red-900 text-red-400 border border-red-500/30 transition cursor-pointer backdrop-blur-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Kapat (X) */}
                  <button
                    onClick={() => {
                      setStoryIndex(null);
                      setStoryProgress(0);
                    }}
                    title="Kapat (Esc)"
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer backdrop-blur-md"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 3. ANA MEDYA ALANI (TAP ZONELARI İLE) */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden w-full h-full p-2 sm:p-6 my-16">
              {/\.(mp4|webm|mov|m4v)$/i.test(currentStoryPhoto.original_name || currentStoryPhoto.r2_file_key) ? (
                <video
                  ref={storyVideoRef}
                  src={getMediaUrl(currentStoryPhoto.r2_file_key)}
                  controls={false}
                  autoPlay
                  playsInline
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration) {
                      setStoryProgress((v.currentTime / v.duration) * 100);
                    }
                  }}
                  onEnded={() => nextStory()}
                  className="max-h-full max-w-full rounded-2xl sm:rounded-3xl shadow-2xl object-contain pointer-events-none"
                />
              ) : (
                <img
                  src={getMediaUrl(currentStoryPhoto.r2_file_key)}
                  alt={currentStoryPhoto.original_name}
                  className="max-h-full max-w-full object-contain rounded-2xl sm:rounded-3xl shadow-2xl pointer-events-none"
                />
              )}

              {/* TAP SOL: ÖNCEKİ FOTOĞRAF (35% genişlik) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  prevStory();
                }}
                className="absolute inset-y-0 left-0 w-[35%] cursor-pointer z-10"
                title="Önceki"
              />

              {/* TAP SAĞ: SONRAKİ FOTOĞRAF (35% genişlik) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  nextStory();
                }}
                className="absolute inset-y-0 right-0 w-[35%] cursor-pointer z-10"
                title="Sonraki"
              />

              {/* ÇİFT DOKUNMA İLE ALEV FIRLAT */}
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  addReaction(currentStoryPhoto.id, '🔥');
                }}
                className="absolute inset-y-0 left-[35%] right-[35%] cursor-pointer z-10"
              />

              {/* CANLI YÜZ REAKSİYONLARI YIĞINI (LOCKET AVATAR STACK ON STORY) */}
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 pointer-events-auto">
                <SelfieReactionStack
                  reactions={selfieReactions[currentStoryPhoto.id] || []}
                  onAddReaction={() => setSelfieTargetPhoto(currentStoryPhoto)}
                  size="md"
                />
              </div>
            </div>

            {/* 4. ALT REAKSİYON BARI (INSTAGRAM STORY EMOJİ ÇUBUĞU) */}
            <div 
              className="absolute inset-x-0 z-30 flex items-center justify-center gap-3 px-4"
              style={{
                bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))'
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/15 shadow-2xl">
                {/* 📸 Canlı Yüz Reaksiyonu Butonu */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelfieTargetPhoto(currentStoryPhoto);
                  }}
                  className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-gradient-to-r from-[#CCFF00]/20 to-emerald-400/20 border border-[#CCFF00]/60 hover:border-[#CCFF00] text-[#CCFF00] font-black text-xs flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg shadow-[#CCFF00]/15"
                >
                  <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Canlı Tepki</span>
                </button>

                <div className="w-[1px] h-4 bg-white/20" />

                {['🔥', '💀', '🫠', '✨'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      addReaction(currentStoryPhoto.id, emoji);
                    }}
                    className="p-1 sm:p-1.5 rounded-full hover:bg-white/15 text-xl sm:text-2xl hover:scale-125 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR KOD MODALI */}
      <AnimatePresence>
        {showQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowQrModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl"
            >
              <div className="inline-flex p-3 rounded-2xl bg-white mx-auto shadow-2xl">
                <QRCodeSVG value={shareInviteUrl} size={180} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">{capsuleName}</h3>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 mt-2 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[11px] text-neutral-400 font-mono">KAPSÜL KODU:</span>
                  <span className="font-mono text-base text-[#CCFF00] font-black tracking-widest">
                    {room.short_id}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-2">
                  Bu QR kodu taratanlar veya bu 6 haneli kodu girenler doğrudan kapsüle bağlanır.
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareInviteUrl);
                  alert('Davet linki kopyalandı!');
                }}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 font-bold text-xs flex items-center justify-center gap-2 text-white transition cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[#CCFF00]" /> Bağlantıyı Kopyala
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TÜMÜNÜ İNDİR SEÇENEK MODALI (ZIP ZORUNLULUĞU YOK) */}
      <AnimatePresence>
        {showBulkDownloadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowBulkDownloadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border border-white/20 rounded-3xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-[#CCFF00]" /> İndirme Yöntemi
                </h3>
                <button
                  onClick={() => setShowBulkDownloadModal(false)}
                  className="p-1 rounded-full text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-neutral-300">
                Kapsüldeki <span className="font-bold text-[#CCFF00]">{photos.length}</span> anıyı nasıl indirmek istersin?
              </p>

              <div className="space-y-2.5 pt-1">
                {/* 1. SEÇENEK: TEK TEK ORİJİNAL (ZIP'SİZ - KAYIPSIZ JPEG/PNG) */}
                <button
                  onClick={() => {
                    setShowBulkDownloadModal(false);
                    downloadAllIndividually();
                  }}
                  className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-[#CCFF00]/40 text-left flex items-start gap-3 transition cursor-pointer group shadow-[0_0_20px_rgba(204,255,0,0.1)]"
                >
                  <div className="p-2.5 rounded-xl bg-[#CCFF00]/15 border border-[#CCFF00]/30 text-[#CCFF00] group-hover:scale-110 transition shrink-0">
                    <FileDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      Kayıpsız İndir (ZIP&apos;siz)
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#CCFF00] text-black font-black uppercase">Önerilen</span>
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                      Her fotoğrafı orijinal formatında (JPEG / PNG) tek tek doğrudan indirir. Arşiv programı açma derdi olmaz.
                    </p>
                  </div>
                </button>

                {/* 2. SEÇENEK: TEK ZIP PAKETİ */}
                <button
                  onClick={() => {
                    setShowBulkDownloadModal(false);
                    handleDownloadZip(photos);
                  }}
                  className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-left flex items-start gap-3 transition cursor-pointer group"
                >
                  <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 group-hover:scale-110 transition shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      ZIP Paketi Olarak İndir
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-bold uppercase">Ekstra</span>
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                      İstersen tüm arşivi tek bir sıkıştırılmış .zip klasöründe toplar ve tek seferde indirir.
                    </p>
                  </div>
                </button>

                {/* 3. SEÇENEK: 10S REELS / TIKTOK BEAT-SYNC VİDEO ÖZETİ */}
                <button
                  onClick={() => {
                    setShowBulkDownloadModal(false);
                    setShowReelsModal(true);
                  }}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-[#CCFF00]/10 hover:from-emerald-500/20 hover:to-[#CCFF00]/20 border border-[#CCFF00]/40 text-left flex items-start gap-3 transition cursor-pointer group shadow-[0_0_20px_rgba(204,255,0,0.1)]"
                >
                  <div className="p-2.5 rounded-xl bg-[#CCFF00]/15 border border-[#CCFF00]/30 text-[#CCFF00] group-hover:scale-110 transition shrink-0">
                    <Film className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      🎬 10s Beat-Sync Video Özeti (Reels / TikTok)
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#CCFF00] text-black font-black uppercase">Yeni</span>
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                      Kareleri ritme göre flaş ve zoom efektleriyle kesip 10 saniyelik dikey MP4 klibe dönüştürür.
                    </p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* OFFLINE KUYRUK YÜZEN GÖSTERGESİ (İNDEXEDDB) */}
      <AnimatePresence>
        {offlineCount > 0 && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="fixed bottom-24 inset-x-0 z-40 flex justify-center pointer-events-none px-4"
          >
            <div className="bg-[#12151F]/95 backdrop-blur-sm border border-amber-500/50 text-amber-300 px-4 py-2 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.3)] flex items-center gap-2.5 text-xs font-bold pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>📶 {offlineCount} anı sırada bekliyor (İnternet gelince fırlatılacak)</span>
              {typeof navigator !== 'undefined' && navigator.onLine && (
                <button
                  onClick={syncOfflineQueue}
                  disabled={isSyncingOffline}
                  className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-[11px] font-black cursor-pointer hover:bg-amber-300 transition"
                >
                  {isSyncingOffline ? 'Yükleniyor...' : 'Şimdi Fırlat 🚀'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================
          KAPSÜL KAPANIŞ RAPORU (MINI RECAP MODALI)
         ======================================================== */}
      <AnimatePresence>
        {showRecapModal && recapData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowRecapModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border-2 border-amber-400/50 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-[0_0_60px_rgba(245,158,11,0.25)] relative overflow-hidden"
            >
              {/* Arka plan altın ışıltısı */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest">
                      KAPSÜL HATIRASI
                    </span>
                    <h3 className="text-lg font-black text-white">
                      Mini Recap // Kapanış Raporu ✨
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setShowRecapModal(false)}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 3 NOKTA ATIŞI BAŞLIK KARTI */}
              <div className="space-y-3 relative z-10 pt-1">
                {/* 1. 🏆 GÜNÜN FOTOĞRAF MAKİNESİ / KAPSÜLÜN MİMARI */}
                <div className="p-4 rounded-2xl bg-white/5 border border-[#CCFF00]/30 flex items-center gap-3.5 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-[#CCFF00]/15 border border-[#CCFF00]/30 flex items-center justify-center text-2xl shrink-0">
                    🏆
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase block">
                      {recapData.topUploader.title}
                    </span>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="font-black text-base text-white truncate">
                        @{recapData.topUploader.nick}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#CCFF00] text-black font-black shrink-0">
                        {recapData.topUploader.count} Kare
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. ZAMAN / GECE KUŞU / AÇILIŞ KAPTANI KARTI */}
                {recapData.card2 && (
                  <div className="p-4 rounded-2xl bg-white/5 border border-violet-500/30 flex items-center gap-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-2xl shrink-0">
                      {recapData.card2.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase block">
                        {recapData.card2.title}
                      </span>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="font-black text-base text-white truncate">
                          @{recapData.card2.nick}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/25 border border-violet-500/40 text-violet-300 font-mono font-bold shrink-0">
                          {recapData.card2.tag}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. 🔥 GÜNÜN KARESİ VEYA 📸 AÇILIŞ KARESİ */}
                {recapData.card3?.photo && (
                  <div className="p-4 rounded-2xl bg-white/5 border border-orange-500/30 flex items-center gap-3.5 shadow-sm">
                    <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-neutral-900 border border-orange-500/30 shrink-0">
                      <img
                        src={getMediaUrl(recapData.card3.photo.r2_file_key)}
                        alt="Özet Fotoğrafı"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-sm">
                        {recapData.card3.isFlame ? '🔥' : '📸'}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase block">
                        {recapData.card3.title}
                      </span>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="font-black text-base text-white truncate">
                          @{recapData.card3.nick}
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-black shrink-0 ${
                          recapData.card3.isFlame 
                            ? 'bg-orange-500/25 border border-orange-500/40 text-orange-300' 
                            : 'bg-white/10 text-neutral-300 border border-white/15'
                        }`}>
                          {recapData.card3.tag}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* WHATSAPP / GRUPTA PAYLAŞ BUTONU */}
              <div className="pt-2 relative z-10 space-y-2">
                <button
                  onClick={() => {
                    setShowRecapModal(false);
                    setShowReceiptModal(true);
                  }}
                  className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Receipt className="w-4 h-4 text-amber-300" />
                  <span>🧾 Günün Faturasını Kes (Receiptify)</span>
                </button>

                <button
                  onClick={() => {
                    const c2 = recapData.card2 ? `${recapData.card2.icon} ${recapData.card2.title}: @${recapData.card2.nick} (${recapData.card2.tag})\n` : '';
                    const c3 = recapData.card3 ? `${recapData.card3.isFlame ? '🔥' : '📸'} ${recapData.card3.title}: @${recapData.card3.nick} (${recapData.card3.tag})\n` : '';
                    const text = `📸 "${capsuleName}" Kapanış Raporu ✨\n\n🏆 ${recapData.topUploader.title}: @${recapData.topUploader.nick} (${recapData.topUploader.count} kare)\n${c2}${c3}\nToplam ${recapData.totalPhotos} anı birikti! 🎉`;
                    navigator.clipboard.writeText(text);
                    alert('Recap özeti panoya kopyalandı! WhatsApp grubuna yapıştırıp arkadaşlarınla paylaşabilirsin. 🚀');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_25px_rgba(245,158,11,0.35)]"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Özeti Kopyala & WhatsApp&apos;ta Paylaş</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* SWIPE KURATÖRÜ (TINDER MODU) MODALI */}
      <SwipeCuratorModal
        isOpen={showSwipeModal}
        onClose={() => setShowSwipeModal(false)}
        photos={photos}
        roomShortId={room?.short_id || params.short_id}
      />

      {/* MEKAN RADARI ÇEKMECESİ */}
      <PlaceRadarDrawer
        isOpen={showPlaceRadar}
        onClose={() => setShowPlaceRadar(false)}
        roomId={room?.id || params.short_id}
        currentUserNick={currentNickname}
        channel={channelRef.current}
      />

      {/* SOHBET & DM ÇEKMECESİ */}
      <ChatDrawer
        isOpen={showChatDrawer}
        onClose={() => {
          setShowChatDrawer(false);
          setSelectedChatTarget(null);
        }}
        roomId={room?.id || params.short_id}
        currentUserNick={currentNickname}
        participants={allRoomParticipants}
        roomPhotos={photos}
        channel={channelRef.current}
        getMediaUrl={getMediaUrl}
        replyPhoto={chatReplyPhoto}
        onClearReplyPhoto={() => setChatReplyPhoto(null)}
        initialDirectTarget={selectedChatTarget}
        onDirectTargetHandled={() => setSelectedChatTarget(null)}
      />

      {/* GÜNÜN FATURASI (RECEIPTIFY TARZI FİŞ MODALI) */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        capsuleName={capsuleName}
        roomShortId={room?.short_id || params.short_id}
        createdAt={room?.created_at || new Date().toISOString()}
        uploadLockedAt={room?.upload_locked_at}
        photos={photos}
        reactions={reactions}
        spotifyUrl={room?.spotify_url}
        parsePhotoUploader={parsePhotoUploader}
      />

      {/* 10S BEAT-SYNC REELS / TIKTOK VİDEO MODALI */}
      <ReelsGeneratorModal
        isOpen={showReelsModal}
        onClose={() => setShowReelsModal(false)}
        photos={selectedIds.size > 0 ? photos.filter((p) => selectedIds.has(p.id)) : photos}
        capsuleName={capsuleName}
        roomShortId={room?.short_id || params.short_id}
        participants={allRoomParticipants}
        getMediaUrl={getMediaUrl}
        reactions={reactions}
        location={room?.location || undefined}
      />

      {/* CANLI YÜZ REAKSİYONU (LOCKET STYLE SELFIE MODAL) */}
      <SelfieReactionModal
        isOpen={!!selfieTargetPhoto}
        onClose={() => setSelfieTargetPhoto(null)}
        targetPhoto={selfieTargetPhoto}
        currentUserName={currentNickname}
        onSubmit={handleAddSelfieReaction}
      />

      {/* VIBE CHECK CANLI ALARMI (SENKRONİZE GERİ SAYIM & FOTOĞRAF RULETİ) */}
      <AnimatePresence>
        {showVibeAlert && activeVibeCheck && (
          <VibeCheckAlert
            vibeCheck={activeVibeCheck}
            onClose={() => setShowVibeAlert(false)}
            onTakePhoto={() => {
              setShowVibeAlert(false);
              handleTriggerVibePhoto(activeVibeCheck.id);
            }}
            shareUrl={shareInviteUrl}
          />
        )}
      </AnimatePresence>

      {/* YENİ: MEKAN OYLAMASI ALERT */}
      {activePlaceVote && (
        <PlaceVoteAlert
          voteData={activePlaceVote}
          onClose={() => setActivePlaceVote(null)}
          roomId={room?.id || params.short_id}
          currentUserNick={currentNickname}
        />
      )}
    </div>
  );
}
