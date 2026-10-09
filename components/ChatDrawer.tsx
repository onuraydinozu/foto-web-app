'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Send, Mic, Video, Image as ImageIcon, Flame, Bomb, 
  Users, MessageSquare, Lock, Palette, Play, Pause, CornerDownRight, 
  Plus, Check, Sparkles, AlertCircle, RefreshCw, EyeOff, Radio
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { globalAudioPlayer } from '@/lib/audioPlayer';

export interface ChatChannel {
  id: string;
  room_id: string;
  name: string;
  is_direct: boolean;
  participants: string[];
  wallpaper?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_name: string;
  text?: string;
  media_url?: string;
  media_type?: 'text' | 'image' | 'audio' | 'video';
  is_bomb?: boolean;
  reply_to_photo_id?: string;
  created_at: string;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUserNick: string;
  participants: string[];
  roomPhotos: any[];
  channel: any;
  getMediaUrl: (key: string) => string;
  replyPhoto: any | null;
  onClearReplyPhoto: () => void;
}

type TabMode = 'general' | 'direct' | 'groups';
type WallpaperTheme = 'obsidian' | 'y2k' | 'matrix' | 'custom_photo';

export default function ChatDrawer({
  isOpen,
  onClose,
  roomId,
  currentUserNick,
  participants,
  roomPhotos,
  channel,
  getMediaUrl,
  replyPhoto,
  onClearReplyPhoto,
}: ChatDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('general');
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  
  // Mesajlaşma State'leri
  const [inputText, setInputText] = useState('');
  const [isBombMode, setIsBombMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Duvar Kağıdı (Wallpaper)
  const [currentWallpaper, setCurrentWallpaper] = useState<WallpaperTheme>('obsidian');
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string>('');
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  // Ses Kayıt State'leri
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioSeconds, setAudioSeconds] = useState(0);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<any>(null);

  // 5 Saniyelik Video Loop State'leri
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState(5);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<any>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Ses Oynatıcı Durumu (Universal Mobile Player)
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
    return globalAudioPlayer.subscribe('chat-drawer', setAudioPlayerState);
  }, []);

  // Bomba Mesaj Geri Sayımları (Okunduktan sonra 5 sn)
  const [burningBombIds, setBurningBombIds] = useState<Record<string, number>>({});
  const [revealedBombIds, setRevealedBombIds] = useState<Set<string>>(new Set());

  // Gıybet Radarı ("Yazıyor ve sildi...")
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [clearedTypingUser, setClearedTypingUser] = useState<string | null>(null);
  const typingTimerRef = useRef<any>(null);
  const hadTextRef = useRef(false);

  // Reaksiyon Yağmuru (Uçuşan emojiler)
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; x: number }[]>([]);

  // Yeni Grup Açma Modalı
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupParticipants, setSelectedGroupParticipants] = useState<string[]>([]);

  // Mesajlar listesi scroll referansı
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cleanUserNick = useMemo(() => {
    return (currentUserNick || 'Anonim').replace(/^@/, '').trim();
  }, [currentUserNick]);

  // 1. Kanalları ve Mesajları Çek
  const fetchChatData = async () => {
    try {
      const res = await fetch(`/api/chat?roomId=${encodeURIComponent(roomId)}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        setMessages(data.messages || []);

        // Varsayılan kanalı ayarla
        if (!activeChannelId && data.channels?.length > 0) {
          const general = data.channels.find((c: any) => !c.is_direct && c.name === 'Genel Masa') || data.channels[0];
          setActiveChannelId(general.id);
          if (general.wallpaper) setCurrentWallpaper(general.wallpaper as WallpaperTheme);
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchChatData();
    }
  }, [isOpen, roomId]);

  // Mesaj listesi en alta kaysın
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannelId]);

  // 2. Realtime Kanal Dinleyicileri
  useEffect(() => {
    if (!channel) return;

    const handleBroadcast = (e: any) => {
      const { event, payload } = e;
      if (event === 'chat_message') {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      } else if (event === 'chat_typing') {
        const { user, isTyping, wasCleared } = payload;
        if (user === cleanUserNick) return;

        if (wasCleared) {
          setClearedTypingUser(user);
          setTimeout(() => setClearedTypingUser(null), 4000);
        }

        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (isTyping) next.add(user);
          else next.delete(user);
          return next;
        });
      } else if (event === 'chat_reaction_rain') {
        triggerEmojiRain(payload.emoji || '🔥');
      } else if (event === 'chat_bomb_burned') {
        setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
      }
    };

    const sub = channel.on('broadcast', { event: 'chat_message' }, ({ payload }: any) => handleBroadcast({ event: 'chat_message', payload }))
      .on('broadcast', { event: 'chat_typing' }, ({ payload }: any) => handleBroadcast({ event: 'chat_typing', payload }))
      .on('broadcast', { event: 'chat_reaction_rain' }, ({ payload }: any) => handleBroadcast({ event: 'chat_reaction_rain', payload }))
      .on('broadcast', { event: 'chat_bomb_burned' }, ({ payload }: any) => handleBroadcast({ event: 'chat_bomb_burned', payload }));

    return () => {};
  }, [channel, cleanUserNick]);

  // Gıybet Radarı: Kullanıcı yazarken veya silerken
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!channel) return;

    if (val.length > 0) {
      hadTextRef.current = true;
      channel.send?.({
        type: 'broadcast',
        event: 'chat_typing',
        payload: { user: cleanUserNick, isTyping: true, wasCleared: false },
      });

      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        channel.send?.({
          type: 'broadcast',
          event: 'chat_typing',
          payload: { user: cleanUserNick, isTyping: false, wasCleared: false },
        });
      }, 2500);
    } else {
      if (hadTextRef.current) {
        // Bir şeyler yazıp sildi! Gıybet alarmı
        hadTextRef.current = false;
        channel.send?.({
          type: 'broadcast',
          event: 'chat_typing',
          payload: { user: cleanUserNick, isTyping: false, wasCleared: true },
        });
      }
    }
  };

  // Reaksiyon Yağmuru Efekti
  const triggerEmojiRain = (emoji: string) => {
    const newItems = Array.from({ length: 12 }).map((_, i) => ({
      id: Date.now() + i,
      emoji,
      x: Math.random() * 80 + 10,
    }));
    setFloatingEmojis((prev) => [...prev, ...newItems]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => !newItems.some((n) => n.id === item.id)));
    }, 2000);
  };

  const handleDoubleTapMessage = (msg: ChatMessage) => {
    const emojis = ['🔥', '💀', '🤡', '😭', '✨'];
    const chosen = emojis[Math.floor(Math.random() * emojis.length)];
    triggerEmojiRain(chosen);
    channel?.send?.({
      type: 'broadcast',
      event: 'chat_reaction_rain',
      payload: { emoji: chosen },
    });
  };

  // 3. Mesaj Gönderme
  const handleSendMessage = async (customPayload?: Partial<ChatMessage>) => {
    const textToSend = customPayload?.text !== undefined ? customPayload.text : inputText.trim();
    const mediaUrl = customPayload?.media_url;
    const mediaType = customPayload?.media_type || 'text';
    const isBomb = customPayload?.is_bomb !== undefined ? customPayload.is_bomb : isBombMode;

    if (!textToSend && !mediaUrl) return;
    if (!activeChannelId) return;

    setIsSending(true);

    try {
      const payload = {
        action: 'send_message',
        roomId,
        channelId: activeChannelId,
        senderName: cleanUserNick,
        text: textToSend,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType,
        isBomb: isBomb,
        replyToPhotoId: replyPhoto?.id || null,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);

          // Realtime Broadcast
          channel?.send?.({
            type: 'broadcast',
            event: 'chat_message',
            payload: data.message,
          });

          setInputText('');
          setIsBombMode(false);
          hadTextRef.current = false;
          onClearReplyPhoto();
        }
      }
    } catch {} finally {
      setIsSending(false);
    }
  };

  // 4. Bomba Mesaj Okuma & 5 Sn Geri Sayım
  const handleRevealBomb = (msg: ChatMessage) => {
    if (revealedBombIds.has(msg.id)) return;
    setRevealedBombIds((prev) => new Set(prev).add(msg.id));
    setBurningBombIds((prev) => ({ ...prev, [msg.id]: 5 }));

    const timer = setInterval(() => {
      setBurningBombIds((prev) => {
        const cur = prev[msg.id];
        if (cur <= 1) {
          clearInterval(timer);
          // Sunucudan ve ekrandan sil
          fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_bomb', roomId, messageId: msg.id }),
          });

          channel?.send?.({
            type: 'broadcast',
            event: 'chat_bomb_burned',
            payload: { messageId: msg.id },
          });

          setMessages((m) => m.filter((item) => item.id !== msg.id));
          return { ...prev, [msg.id]: 0 };
        }
        return { ...prev, [msg.id]: cur - 1 };
      });
    }, 1000);
  };

  // 5. Ses Kaydı (Waveform MediaRecorder)
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const finalType = mediaRecorder.mimeType || mimeType || 'audio/mp4';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalType });
        stream.getTracks().forEach((track) => track.stop());

        // Base64 veya R2 yüklemesi (DataURL ile anında hafif gönderim)
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleSendMessage({
            text: '🎤 Sesli Fısıltı',
            media_url: base64Audio,
            media_type: 'audio',
          });
        };
      };

      audioRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecordingAudio(true);
      setAudioSeconds(0);

      audioTimerRef.current = setInterval(() => {
        setAudioSeconds((sec) => {
          if (sec >= 15) {
            stopAudioRecording();
            return 15;
          }
          return sec + 1;
        });
      }, 1000);
    } catch {
      alert('Mikrofon erişimi verilemedi!');
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorderRef.current && isRecordingAudio) {
      audioRecorderRef.current.stop();
      clearInterval(audioTimerRef.current);
      setIsRecordingAudio(false);
    }
  };

  // 6. 5 Saniyelik Video Loop (Locket Style)
  const startVideoRecording = async () => {
    try {
      setShowVideoModal(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 360, height: 360 },
        audio: false,
      });
      videoStreamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      videoChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        stream.getTracks().forEach((t) => t.stop());
        setShowVideoModal(false);

        const reader = new FileReader();
        reader.readAsDataURL(videoBlob);
        reader.onloadend = () => {
          const base64Video = reader.result as string;
          handleSendMessage({
            text: '🎥 Video Döngüsü',
            media_url: base64Video,
            media_type: 'video',
          });
        };
      };

      videoRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsVideoRecording(true);
      setVideoSeconds(5);

      videoTimerRef.current = setInterval(() => {
        setVideoSeconds((s) => {
          if (s <= 1) {
            stopVideoRecording();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      alert('Ön kamera erişimi verilemedi!');
      setShowVideoModal(false);
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && isVideoRecording) {
      videoRecorderRef.current.stop();
      clearInterval(videoTimerRef.current);
      setIsVideoRecording(false);
    }
  };

  // 7. Kanal Seçimi ve 1-e-1 Fısıltı Başlatma
  const handleStartDirectChat = async (targetNick: string) => {
    const pair = [cleanUserNick, targetNick].sort();
    const existing = channels.find((c) => c.is_direct && c.participants?.sort().join(',') === pair.join(','));

    if (existing) {
      setActiveChannelId(existing.id);
      setActiveTab('direct');
      return;
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_channel',
          roomId,
          isDirect: true,
          participants: pair,
          name: `@${targetNick}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.channel) {
          setChannels((prev) => [...prev, data.channel]);
          setActiveChannelId(data.channel.id);
          setActiveTab('direct');
        }
      }
    } catch {}
  };

  // Yeni Alt Grup Açma
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_channel',
          roomId,
          isDirect: false,
          name: newGroupName.trim(),
          participants: [cleanUserNick, ...selectedGroupParticipants],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.channel) {
          setChannels((prev) => [...prev, data.channel]);
          setActiveChannelId(data.channel.id);
          setShowNewGroupModal(false);
          setNewGroupName('');
          setSelectedGroupParticipants([]);
          setActiveTab('groups');
        }
      }
    } catch {}
  };

  // Aktif Kanal Mesajları
  const activeMessages = useMemo(() => {
    return messages.filter((m) => m.channel_id === activeChannelId);
  }, [messages, activeChannelId]);

  const activeChannel = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId) || channels[0];
  }, [channels, activeChannelId]);

  // Wallpaper arka plan sınıfları
  const wallpaperStyles = useMemo(() => {
    switch (currentWallpaper) {
      case 'y2k':
        return 'bg-[#0E1512] text-[#8DFFA9] [background-image:radial-gradient(rgba(141,255,169,0.1)_1px,transparent_1px)] [background-size:16px_16px]';
      case 'matrix':
        return 'bg-[#050C07] text-[#00FF66] font-mono [background-image:linear-gradient(rgba(0,255,102,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.06)_1px,transparent_1px)] [background-size:20px_20px]';
      case 'custom_photo':
        return customPhotoUrl
          ? 'bg-cover bg-center bg-no-repeat'
          : 'bg-[#0B0C14] text-white';
      case 'obsidian':
      default:
        return 'bg-[#0A0B12]/95 text-white [background:radial-gradient(circle_at_20%_20%,rgba(121,40,202,0.15)_0%,transparent_50%),radial-gradient(circle_at_80%_80%,rgba(255,46,147,0.12)_0%,transparent_50%)]';
    }
  }, [currentWallpaper, customPhotoUrl]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
          {/* Arka Plan Karartması */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Çekmece Paneli (Slide-Over) */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className={`relative z-10 w-full sm:max-w-md h-full flex flex-col border-l border-white/15 shadow-2xl backdrop-blur-2xl ${wallpaperStyles}`}
            style={
              currentWallpaper === 'custom_photo' && customPhotoUrl
                ? { backgroundImage: `linear-gradient(rgba(10,12,20,0.85), rgba(10,12,20,0.85)), url(${customPhotoUrl})` }
                : undefined
            }
          >
            {/* UÇUŞAN EMOJİ REAKSİYON YAĞMURU */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
              {floatingEmojis.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ y: '90%', opacity: 1, scale: 0.8 }}
                  animate={{ y: '-10%', opacity: 0, scale: 1.5 }}
                  transition={{ duration: 1.8, ease: 'easeOut' }}
                  className="absolute text-4xl"
                  style={{ left: `${item.x}%` }}
                >
                  {item.emoji}
                </motion.div>
              ))}
            </div>

            {/* ÜST BAR (KANALLAR & BUTONLAR) */}
            <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 bg-black/40 backdrop-blur-md">
              <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/10 text-xs font-bold">
                <button
                  onClick={() => {
                    setActiveTab('general');
                    const gen = channels.find((c) => !c.is_direct && c.name === 'Genel Masa');
                    if (gen) setActiveChannelId(gen.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    activeTab === 'general' ? 'bg-[#CCFF00] text-black shadow-sm font-black' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Genel Masa
                </button>

                <button
                  onClick={() => setActiveTab('direct')}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                    activeTab === 'direct' ? 'bg-[#FF2E93] text-white shadow-sm font-black' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Fısıltı</span>
                </button>

                <button
                  onClick={() => setActiveTab('groups')}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                    activeTab === 'groups' ? 'bg-violet-600 text-white shadow-sm font-black' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>Gruplar</span>
                </button>
              </div>

              {/* Sağ: Tema Paleti ve Kapat */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-[#CCFF00] border border-white/10 transition cursor-pointer"
                  title="Atmosfer & Duvar Kağıdı Değiştir"
                >
                  <Palette className="w-4 h-4" />
                </button>

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* DUVAR KAĞIDI SEÇİM PANELİ */}
            <AnimatePresence>
              {showWallpaperPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-3 bg-black/70 border-b border-white/10 shrink-0 space-y-2 text-xs"
                >
                  <span className="font-mono text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                    VIBE ATMOSFERİ SEÇ:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'obsidian', label: 'Obsidian Pulse', icon: '🌌' },
                      { id: 'y2k', label: 'Y2K Glitch', icon: '📼' },
                      { id: 'matrix', label: 'Cyber Matrix', icon: '📟' },
                      { id: 'custom_photo', label: 'Meme Duvarı', icon: '🖼️' },
                    ].map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          setCurrentWallpaper(w.id as WallpaperTheme);
                          if (w.id === 'custom_photo' && roomPhotos.length > 0) {
                            setCustomPhotoUrl(getMediaUrl(roomPhotos[0].r2_file_key));
                          }
                          setShowWallpaperPicker(false);
                        }}
                        className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                          currentWallpaper === w.id
                            ? 'border-[#CCFF00] bg-[#CCFF00]/15 text-white font-black'
                            : 'border-white/10 bg-white/5 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="text-sm">{w.icon}</span>
                        <span className="text-[10px] truncate w-full">{w.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SEKME ÖZEL LİSTELERİ */}
            {activeTab === 'direct' && (
              <div className="p-3 border-b border-white/10 bg-black/30 shrink-0">
                <span className="text-[10px] font-mono text-neutral-400 block mb-2 font-bold uppercase">
                  1-E-1 FISILTI BAŞLAT (KATILIMCILAR):
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {participants
                    .filter((p) => p.replace(/^@/, '') !== cleanUserNick)
                    .map((p) => {
                      const nick = p.replace(/^@/, '');
                      return (
                        <button
                          key={nick}
                          onClick={() => handleStartDirectChat(nick)}
                          className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-[#FF2E93]/20 border border-white/10 hover:border-[#FF2E93]/50 text-neutral-300 hover:text-white text-xs font-bold shrink-0 transition flex items-center gap-1.5"
                        >
                          <Lock className="w-3 h-3 text-[#FF2E93]" />
                          <span>@{nick}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {activeTab === 'groups' && (
              <div className="p-3 border-b border-white/10 bg-black/30 shrink-0 flex items-center justify-between gap-2">
                <div className="flex gap-1.5 overflow-x-auto custom-scrollbar flex-1">
                  {channels
                    .filter((c) => !c.is_direct && c.name !== 'Genel Masa')
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveChannelId(c.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 border ${
                          activeChannelId === c.id
                            ? 'bg-violet-600 text-white border-violet-400'
                            : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>

                <button
                  onClick={() => setShowNewGroupModal(true)}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-[#CCFF00] hover:text-black text-white text-xs font-bold transition shrink-0 flex items-center gap-1 border border-white/15"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Grup Aç</span>
                </button>
              </div>
            )}

            {/* MESAJ AKIŞ LİSTESİ */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
              {activeMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                  <span className="text-4xl mb-2">💬</span>
                  <p className="font-bold text-white text-sm">
                    {activeChannel?.name || 'Sohbet Başlasın'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xs font-mono">
                    İlk dedikoduyu veya fotoğrafı sen ateşle.
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isMe = msg.sender_name === cleanUserNick;
                  const isBomb = msg.is_bomb;
                  const isRevealed = revealedBombIds.has(msg.id);
                  const burnSec = burningBombIds[msg.id];

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      onDoubleClick={() => handleDoubleTapMessage(msg)}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group select-none`}
                    >
                      {/* Gönderen İsmi */}
                      {!isMe && (
                        <span className="text-[10px] font-mono text-neutral-400 mb-0.5 ml-2">
                          @{msg.sender_name}
                        </span>
                      )}

                      {/* Mesaj Balonu */}
                      <div
                        className={`relative max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed transition-all shadow-md ${
                          isBomb
                            ? isRevealed
                              ? 'bg-red-950/80 border-2 border-red-500 text-red-200'
                              : 'bg-amber-950/60 border border-amber-500/50 text-amber-200 cursor-pointer hover:scale-102'
                            : isMe
                            ? 'bg-[#CCFF00] text-black font-semibold rounded-br-none shadow-[0_4px_15px_rgba(204,255,0,0.15)]'
                            : 'bg-white/10 text-white rounded-bl-none border border-white/10'
                        }`}
                        onClick={() => isBomb && !isRevealed && handleRevealBomb(msg)}
                      >
                        {/* BOMBA MESAJ KAPALIYSA */}
                        {isBomb && !isRevealed ? (
                          <div className="flex items-center gap-2 font-mono font-bold py-1">
                            <Bomb className="w-4 h-4 text-amber-400 animate-pulse" />
                            <span>💣 Bomba Mesaj (Dokun & Oku)</span>
                          </div>
                        ) : (
                          <>
                            {/* BOMBA GERİ SAYIM ROZETİ */}
                            {isBomb && burnSec !== undefined && (
                              <div className="flex items-center justify-between gap-3 text-[10px] font-mono font-black text-red-400 mb-1 pb-1 border-b border-red-500/30">
                                <span className="flex items-center gap-1 animate-pulse">
                                  <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                                  KÜL OLUYOR...
                                </span>
                                <span>0{burnSec}s</span>
                              </div>
                            )}

                            {/* FOTOĞRAF ALINTILAMA ÖNİZLEMESİ */}
                            {msg.reply_to_photo_id && (
                              <div className="mb-2 p-1.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
                                <CornerDownRight className="w-3 h-3 text-[#CCFF00] shrink-0" />
                                <span className="text-[10px] text-neutral-300 font-mono">
                                  Kapsülden bir anı alıntılandı
                                </span>
                              </div>
                            )}

                            {/* SES KAYDI (WAVEFORM SES OYNATICI) */}
                            {msg.media_type === 'audio' && msg.media_url && (
                              <div className="flex items-center gap-2.5 py-1">
                                <button
                                  onClick={() => globalAudioPlayer.toggle(msg.id, msg.media_url!)}
                                  className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-sm"
                                  title={
                                    audioPlayerState.currentId === msg.id && audioPlayerState.isPlaying
                                      ? 'Durdur'
                                      : 'Dinle'
                                  }
                                >
                                  {audioPlayerState.currentId === msg.id && audioPlayerState.isLoading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin text-[#CCFF00]" />
                                  ) : audioPlayerState.currentId === msg.id && audioPlayerState.isPlaying ? (
                                    <Pause className="w-4 h-4 text-[#CCFF00]" />
                                  ) : (
                                    <Play className="w-4 h-4 ml-0.5" />
                                  )}
                                </button>

                                {/* Dalga Çizgileri */}
                                <div className="flex items-center gap-1 h-6">
                                  {[40, 70, 100, 60, 30, 80, 50, 90, 40].map((h, i) => (
                                    <span
                                      key={i}
                                      className={`w-1 rounded-full transition-all ${
                                        audioPlayerState.currentId === msg.id && audioPlayerState.isPlaying
                                          ? 'bg-red-500 animate-pulse'
                                          : isMe ? 'bg-black/60' : 'bg-[#CCFF00]'
                                      }`}
                                      style={{ height: `${h}%` }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 5 SANİYELİK VİDEO DÖNGÜSÜ (LOCKET CIRCLE) */}
                            {msg.media_type === 'video' && msg.media_url && (
                              <div className="my-1.5 w-44 h-44 rounded-full overflow-hidden border-2 border-[#CCFF00] shadow-md bg-black">
                                <video
                                  src={msg.media_url}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            {/* FOTOĞRAF / STICKER */}
                            {msg.media_type === 'image' && msg.media_url && (
                              <div className="my-1 rounded-xl overflow-hidden max-w-[220px]">
                                <img
                                  src={msg.media_url}
                                  alt="Chat media"
                                  className="w-full h-auto object-cover rounded-xl"
                                />
                              </div>
                            )}

                            {/* METİN */}
                            {msg.text && <p>{msg.text}</p>}
                          </>
                        )}
                      </div>

                      {/* Saat */}
                      <span className="text-[9px] font-mono text-neutral-500 mt-0.5 mx-2">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </motion.div>
                  );
                })
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* GIYBET RADARI BİLDİRİMİ */}
            {(typingUsers.size > 0 || clearedTypingUser) && (
              <div className="px-4 py-1.5 bg-black/50 text-[11px] font-mono flex items-center gap-2 border-t border-white/5 shrink-0">
                {clearedTypingUser ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                    👀 @{clearedTypingUser} bir şeyler yazdı ama sildi...
                  </span>
                ) : (
                  <span className="text-neutral-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-ping" />
                    @{Array.from(typingUsers).join(', ')} yazıyor...
                  </span>
                )}
              </div>
            )}

            {/* ALINTILANAN FOTOĞRAF ÖNİZLEME BARI */}
            {replyPhoto && (
              <div className="px-4 py-2 bg-black/60 border-t border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <img
                    src={getMediaUrl(replyPhoto.r2_file_key)}
                    alt="Alıntı"
                    className="w-8 h-8 rounded-lg object-cover border border-[#CCFF00]"
                  />
                  <span className="text-xs font-bold text-white">Fotoğrafa yanıt veriliyor</span>
                </div>
                <button
                  onClick={onClearReplyPhoto}
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ALT GİRDİ ÇUBUĞU (INPUT BAR) */}
            <div className="p-3 sm:p-4 border-t border-white/10 bg-black/60 backdrop-blur-md shrink-0 space-y-2">
              {isRecordingAudio ? (
                // Ses Kaydı Canlı Barı
                <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-red-950/60 border border-red-500/50">
                  <div className="flex items-center gap-2 text-red-400 font-mono font-bold text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span>KAYDEDİLİYOR: 0{audioSeconds}s / 15s</span>
                  </div>

                  <button
                    onClick={stopAudioRecording}
                    className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition cursor-pointer"
                  >
                    Bitti & Fırlat 🚀
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {/* BOMBA MESAJ BUTONU */}
                  <button
                    type="button"
                    onClick={() => setIsBombMode(!isBombMode)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                      isBombMode
                        ? 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
                        : 'bg-white/5 hover:bg-white/10 text-neutral-400 border-white/10'
                    }`}
                    title="Bomba Mesaj Modu (Okunduktan 5 sn sonra kül olur)"
                  >
                    <Bomb className="w-4 h-4" />
                  </button>

                  {/* SES KAYDET BUTONU */}
                  <button
                    type="button"
                    onClick={startAudioRecording}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-[#7928CA]/30 text-neutral-400 hover:text-violet-300 border border-white/10 transition cursor-pointer shrink-0"
                    title="Bas & 15 Sn Ses Kaydet"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* 5S VİDEO LOOP BUTONU */}
                  <button
                    type="button"
                    onClick={startVideoRecording}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-neutral-400 hover:text-emerald-300 border border-white/10 transition cursor-pointer shrink-0"
                    title="5 Saniyelik Video Loop Çek"
                  >
                    <Video className="w-4 h-4" />
                  </button>

                  {/* METİN GİRDİSİ */}
                  <input
                    type="text"
                    placeholder={isBombMode ? '💣 Bomba mesaj yaz...' : 'Dedikodu fırlat...'}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 bg-black/50 border border-white/15 text-white placeholder:text-neutral-500 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#CCFF00] transition"
                  />

                  {/* GÖNDER BUTONU */}
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={isSending || !inputText.trim()}
                    className="p-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black transition disabled:opacity-30 cursor-pointer shrink-0 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* 5 SANİYELİK VİDEO KAYIT MODALI */}
          <AnimatePresence>
            {showVideoModal && (
              <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
                <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-[#CCFF00] relative bg-black shadow-[0_0_50px_rgba(204,255,0,0.5)]">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute top-4 inset-x-0 text-center font-mono font-black text-2xl text-amber-400 drop-shadow-md">
                    0{videoSeconds}s
                  </div>
                </div>
                <p className="text-white font-bold text-sm mt-4">5 Saniyelik Video Döngüsü Çekiliyor 🎥</p>
                <button
                  onClick={stopVideoRecording}
                  className="mt-4 px-6 py-2.5 rounded-full bg-red-600 text-white font-black text-xs cursor-pointer"
                >
                  Kaydı Durdur
                </button>
              </div>
            )}
          </AnimatePresence>

          {/* YENİ GRUP AÇMA MODALI */}
          <AnimatePresence>
            {showNewGroupModal && (
              <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-[#12151F] border border-white/15 rounded-3xl p-5 max-w-sm w-full space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-white">+ Yeni Kaos Odası Aç</h4>
                    <button onClick={() => setShowNewGroupModal(false)} className="text-neutral-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateGroup} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Örn: Arabada Olanlar, Dedikodu..."
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#CCFF00]"
                    />

                    <div>
                      <span className="text-[10px] font-mono text-neutral-400 block mb-1">Grup Üyelerini Seç:</span>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {participants
                          .filter((p) => p.replace(/^@/, '') !== cleanUserNick)
                          .map((p) => {
                            const nick = p.replace(/^@/, '');
                            const isSelected = selectedGroupParticipants.includes(nick);
                            return (
                              <button
                                type="button"
                                key={nick}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedGroupParticipants((prev) => prev.filter((n) => n !== nick));
                                  } else {
                                    setSelectedGroupParticipants((prev) => [...prev, nick]);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                                  isSelected
                                    ? 'bg-[#CCFF00] text-black border-[#CCFF00]'
                                    : 'bg-white/5 text-neutral-300 border-white/10'
                                }`}
                              >
                                @{nick}
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!newGroupName.trim()}
                      className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs transition disabled:opacity-40"
                    >
                      Odayı Başlat 🚀
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
