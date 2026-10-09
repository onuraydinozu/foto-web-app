'use client';

import React from 'react';
import { 
  Download, MessageSquare, Trash2, Camera, Lock, 
  Check, Radio, Play, Pause, RefreshCw 
} from 'lucide-react';
import SelfieReactionStack, { SelfieReactionItem } from '@/components/SelfieReactionStack';
import { globalAudioPlayer } from '@/lib/audioPlayer';

interface PhotoCardProps {
  photo: any;
  isSelected: boolean;
  isSelectMode: boolean;
  isDisposableLocked: boolean;
  isOwner: boolean;
  timeString: string;
  isCover: boolean;
  photoReactions: string[];
  selfieReactionsList: SelfieReactionItem[];
  deviceBadge?: string | null;
  uploaderNick: string;
  getMediaUrl: (fileKey: string, options?: { thumb?: boolean }) => string;
  onCardClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onDownload: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onChatReply: (e: React.MouseEvent) => void;
  onSelfieReaction: () => void;
  audioPlayerState?: { isPlaying: boolean; isLoading: boolean; currentId: string | null };
}

function PhotoCardComponent({
  photo,
  isSelected,
  isSelectMode,
  isDisposableLocked,
  isOwner,
  timeString,
  isCover,
  photoReactions,
  selfieReactionsList,
  deviceBadge,
  uploaderNick,
  getMediaUrl,
  onCardClick,
  onDoubleClick,
  onDownload,
  onDelete,
  onChatReply,
  onSelfieReaction,
  audioPlayerState,
}: PhotoCardProps) {
  const isVoiceDump = photo.original_name?.startsWith('Sesli Anı') || /\.(mp3|wav|ogg|m4a)$/i.test(photo.original_name || photo.r2_file_key);
  const isVideo = !isVoiceDump && /\.(mp4|webm|mov|m4v)$/i.test(photo.original_name || photo.r2_file_key);

  // Sesli Anı Kartı
  if (isVoiceDump) {
    const isPlaying = audioPlayerState?.currentId === photo.id && audioPlayerState?.isPlaying;
    const isLoading = audioPlayerState?.currentId === photo.id && audioPlayerState?.isLoading;

    return (
      <div
        onClick={onCardClick}
        className={`group relative bg-[#12151F] border border-white/15 p-3.5 sm:p-4 rounded-2xl shadow-xl transition-transform duration-150 cursor-pointer select-none hover:scale-[1.02] active:scale-[0.98] ${
          isSelected ? 'ring-4 ring-[#CCFF00]' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#7928CA]/30 text-violet-300 border border-[#7928CA]/40 flex items-center gap-1">
            <Radio className="w-3 h-3 text-[#CCFF00] animate-pulse" /> SESLİ DUMP
          </span>
          <span className="font-mono text-[10px] text-neutral-400">{timeString}</span>
        </div>

        <div className="flex items-center gap-3 py-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              globalAudioPlayer.toggle(photo.id, getMediaUrl(photo.r2_file_key));
            }}
            className="w-12 h-12 rounded-full bg-[#CCFF00] hover:bg-[#b8e600] active:scale-95 text-black flex items-center justify-center font-black shadow-[0_0_20px_rgba(204,255,0,0.4)] cursor-pointer transition-transform shrink-0"
            title={isPlaying ? 'Durdur' : 'Dinle'}
          >
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin text-black" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-black" />
            ) : (
              <Play className="w-5 h-5 fill-black ml-0.5" />
            )}
          </button>

          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-1 h-6">
              {[12, 24, 16, 28, 20, 14, 26, 18, 22, 10, 24, 15].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isPlaying ? 'bg-[#CCFF00] animate-pulse' : 'bg-white/20'
                  }`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
          <span className="font-bold text-white truncate max-w-[150px]">
            @{uploaderNick}
          </span>
          {isOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e);
              }}
              className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onCardClick}
      onDoubleClick={onDoubleClick}
      className={`group relative bg-[#F4F4F6] text-neutral-900 border border-black/5 p-2 sm:p-2.5 pb-3.5 sm:pb-4 rounded-2xl shadow-[0_10px_28px_rgba(0,0,0,0.5)] transition-transform duration-150 cursor-pointer select-none hover:scale-[1.02] active:scale-[0.98] hover:z-20 ${
        isSelected ? 'ring-4 ring-[#CCFF00]' : ''
      }`}
    >
      {/* Seçim Onay Rozeti */}
      {isSelectMode && (
        <div className="absolute top-4 left-4 z-20">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-[#CCFF00] text-black shadow-lg'
                : 'bg-black/70 border border-white/40 text-transparent'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
        </div>
      )}

      {/* Polaroid Medya Alanı */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-900">
        {isVideo ? (
          <>
            <video
              src={getMediaUrl(photo.r2_file_key)}
              muted
              playsInline
              preload="metadata"
              className={`object-cover w-full h-full ${
                isDisposableLocked ? 'blur-2xl scale-125 filter' : ''
              }`}
            />
            {!isDisposableLocked && (
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 border border-white/20 text-[9px] font-mono font-bold text-white flex items-center gap-1 pointer-events-none z-10 backdrop-blur-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
                <span>VIDEO</span>
              </div>
            )}
          </>
        ) : (
          <img
            src={getMediaUrl(photo.r2_file_key, { thumb: true })}
            alt={photo.original_name}
            loading="lazy"
            decoding="async"
            className={`object-cover w-full h-full ${
              isDisposableLocked ? 'blur-2xl scale-125 filter' : ''
            }`}
          />
        )}

        {/* Disposable Kilit Damgası (Sıfır backdrop-blur ile yüksek FPS) */}
        {isDisposableLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-black/60">
            <Lock className="w-6 h-6 text-[#FF2E93] mb-1" />
            <span className="font-mono text-[10px] font-black uppercase text-white tracking-widest bg-black/80 px-2 py-0.5 rounded">
              🔒 KİLİTLİ
            </span>
          </div>
        )}

        {/* Masaüstü Hover Aksiyon Butonları (Mobilde kart tıklanınca tam ekran modal açılır) */}
        {!isDisposableLocked && !isSelectMode && (
          <div className="absolute top-2 right-2 z-10 hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelfieReaction();
              }}
              title="Canlı Yüz Reaksiyonu Ver 📸"
              className="p-1.5 rounded-full bg-black/80 hover:bg-[#CCFF00] hover:text-black text-amber-300 transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onChatReply(e);
              }}
              title="Sohbette Alıntıla"
              className="p-1.5 rounded-full bg-black/80 hover:bg-black text-pink-400 hover:text-pink-300 transition cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(e);
              }}
              title="Orijinal formatında indir"
              className="p-1.5 rounded-full bg-black/80 hover:bg-black text-[#CCFF00] transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {isOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(e);
                }}
                title="Sil"
                className="p-1.5 rounded-full bg-red-950 hover:bg-red-900 text-white transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* VIBE CHECK ROZETİ */}
        {photo.vibe_check_id && (
          <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-mono font-black shadow-lg pointer-events-none flex items-center gap-1 bg-black/85 border border-white/20">
            {photo.is_late ? (
              <span className="text-amber-400">🐢 Geç Kaldı</span>
            ) : (
              <span className="text-[#CCFF00]">⚡ Zamanında</span>
            )}
          </div>
        )}

        {/* GÜNÜN KAPAĞI TAÇ ROZETİ */}
        {isCover && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-[9px] flex items-center gap-1 shadow-md pointer-events-none">
            <span>👑 GÜNÜN KAPAĞI</span>
          </div>
        )}

        {/* SESSİZ EXIF & SAAT KÜNYESİ ROZETİ */}
        {deviceBadge && (
          <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/80 border border-white/15 text-[9px] font-mono text-neutral-200 flex items-center gap-1 shadow-sm pointer-events-none">
            <span>{deviceBadge}</span>
          </div>
        )}

        {/* CANLI YÜZ REAKSİYONU (LOCKET STYLE AVATAR STACK) */}
        <div className="absolute bottom-2.5 right-2.5 z-20">
          <SelfieReactionStack
            reactions={selfieReactionsList}
            onAddReaction={!isDisposableLocked && !isSelectMode ? onSelfieReaction : undefined}
            size="sm"
          />
        </div>

        {/* Standart Emojiler (Selfie yoksa) */}
        {photoReactions.length > 0 && !(selfieReactionsList.length > 0) && (
          <div className="absolute bottom-2 right-2 flex flex-wrap gap-1 max-w-[80px] pointer-events-none">
            {photoReactions.map((emoji, i) => (
              <span
                key={i}
                className="text-xs bg-black/75 rounded-full px-1 py-0.5"
              >
                {emoji}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Polaroid Alt Not & Lokasyon Alanı (El Yazısı Hissi) */}
      <div className="mt-2.5 px-1 flex items-center justify-between text-neutral-800">
        <div className="truncate max-w-[140px]">
          <p className="font-black text-xs truncate">@{uploaderNick}</p>
        </div>

        <span className="font-mono text-[11px] font-bold text-neutral-500 shrink-0">
          {timeString}
        </span>
      </div>
    </div>
  );
}

// React.memo ile sarmalanmış ultra-hızlı kart (Sadece kendi verisi değiştiğinde re-render olur)
export const PhotoCard = React.memo(PhotoCardComponent);
export default PhotoCard;
