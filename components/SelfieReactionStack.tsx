'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';

export interface SelfieReactionItem {
  id: string;
  room_id?: string;
  photo_id: string;
  user_name: string;
  selfie_url: string;
  emoji?: string;
  created_at: string;
}

interface SelfieReactionStackProps {
  reactions: SelfieReactionItem[];
  onAddReaction?: () => void;
  maxVisible?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ROTATIONS = ['rotate-[-4deg]', 'rotate-[3deg]', 'rotate-[-2deg]', 'rotate-[5deg]', 'rotate-[-3deg]'];

export default function SelfieReactionStack({
  reactions,
  onAddReaction,
  maxVisible = 5,
  className = '',
  size = 'md',
}: SelfieReactionStackProps) {
  const [activeTooltip, setActiveTooltip] = useState<SelfieReactionItem | null>(null);

  if ((!reactions || reactions.length === 0) && !onAddReaction) {
    return null;
  }

  const visibleReactions = (reactions || []).slice(-maxVisible);
  const extraCount = Math.max(0, (reactions || []).length - maxVisible);

  const dimClasses =
    size === 'sm'
      ? 'w-7 h-7 sm:w-8 sm:h-8'
      : size === 'lg'
      ? 'w-12 h-12 sm:w-14 sm:h-14'
      : 'w-9 h-9 sm:w-10 sm:h-10';

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Az önce';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={`relative flex items-end ${className}`}>
      {/* Detay Tooltip / Popover (Tıklanan selfie'nin kimin olduğu) */}
      <AnimatePresence>
        {activeTooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 5 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-full right-0 mb-2 z-40 bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-2.5 shadow-2xl flex items-center gap-2.5 min-w-[150px] max-w-[220px]"
          >
            <img
              src={activeTooltip.selfie_url}
              alt={activeTooltip.user_name}
              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md shrink-0"
            />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-xs text-white truncate">
                  @{activeTooltip.user_name}
                </span>
                <span className="text-sm">{activeTooltip.emoji || '🤪'}</span>
              </div>
              <p className="font-mono text-[9px] text-neutral-400 mt-0.5">
                {formatTime(activeTooltip.created_at)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTooltip(null);
              }}
              className="p-1 rounded-full text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Küme / Avatar Yığını (Locket Style Overlapping Avatars) */}
      <div className="flex items-end -space-x-3 sm:-space-x-3.5">
        {visibleReactions.map((item, idx) => {
          const rotClass = ROTATIONS[idx % ROTATIONS.length];
          const isSelected = activeTooltip?.id === item.id;

          return (
            <motion.div
              key={item.id}
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: idx * 0.05, type: 'spring', damping: 15 }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTooltip(isSelected ? null : item);
              }}
              className={`group relative flex flex-col items-center cursor-pointer transition-transform hover:scale-115 hover:z-30 select-none ${rotClass}`}
              title={`@${item.user_name} (${item.emoji || '🤪'})`}
            >
              {/* Dairesel Beyaz Çerçeveli Selfie Rozeti */}
              <div
                className={`${dimClasses} rounded-full overflow-hidden border-[2.5px] border-white shadow-xl bg-black relative flex items-center justify-center ring-1 ring-black/30`}
              >
                <img
                  src={item.selfie_url}
                  alt={item.user_name}
                  className="w-full h-full object-cover pointer-events-none"
                  loading="lazy"
                />
              </div>

              {/* Alt Rumuz Hapı (Black Pill Badge) */}
              <div className="absolute -bottom-2 z-10 px-1.5 py-0.2 rounded-full bg-black/90 backdrop-blur-xs border border-white/25 text-[8px] sm:text-[9px] font-black text-white shadow-md max-w-[48px] sm:max-w-[56px] truncate text-center leading-tight">
                @{item.user_name}
              </div>

              {/* Köşe Mini Emoji */}
              {item.emoji && (
                <span className="absolute -top-1 -right-1 z-10 text-[10px] sm:text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] pointer-events-none">
                  {item.emoji}
                </span>
              )}
            </motion.div>
          );
        })}

        {/* Ekstra Sayı Rozeti */}
        {extraCount > 0 && (
          <div
            className={`${dimClasses} rounded-full bg-neutral-900 border-2 border-white shadow-lg text-[10px] font-black text-white flex items-center justify-center ring-1 ring-black/40 z-20`}
          >
            +{extraCount}
          </div>
        )}

        {/* Canlı Tepki Ekle Butonu (+) */}
        {onAddReaction && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddReaction();
            }}
            title="Canlı Yüz Reaksiyonu Ekle"
            className={`${dimClasses} rounded-full bg-black/80 hover:bg-[#CCFF00] hover:text-black border-2 border-white/80 text-white shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer z-20 group ml-1`}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </div>
    </div>
  );
}
