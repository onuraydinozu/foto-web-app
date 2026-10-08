'use client';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Disc3, Music, Play, Pause } from 'lucide-react';

export default function YoutubePlayer({ videoId, onOpenModal }: { videoId: string, onOpenModal: () => void }) {
  const [title, setTitle] = useState('Bağlanıyor...');
  const [author, setAuthor] = useState('Kapsül Radyosu');
  const [isPlaying, setIsPlaying] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      .then((res) => res.json())
      .then((data) => {
        setTitle(data.title);
        setAuthor(data.author_name);
      })
      .catch(() => {
        setTitle('Canlı Kapsül Şarkısı');
        setAuthor('Radyo Aktif ⚡');
      });
  }, [videoId]);

  const togglePlay = () => {
    if (!iframeRef.current?.contentWindow) return;
    const command = isPlaying ? 'pauseVideo' : 'playVideo';
    iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), '*');
    setIsPlaying(!isPlaying);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.25rem] overflow-hidden border border-[#FF2E93]/30 bg-[#12151F]/80 backdrop-blur-2xl flex flex-col sm:flex-row items-center justify-between p-2 sm:p-2.5 gap-3 shadow-[0_0_30px_rgba(255,46,147,0.15)] relative"
    >
      <div className="flex items-center gap-3.5 w-full sm:w-auto min-w-0">
        
        {/* Sol: Gizli / Ufak iframe (Sadece ses için veya küçük thumbnail) */}
        <div 
          className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-[0.9rem] overflow-hidden bg-black border border-white/10 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] relative group cursor-pointer flex items-center justify-center" 
          onClick={togglePlay}
        >
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-all z-10 pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-white fill-white" /> : <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />}
            </div>
          </div>
          <iframe
            ref={iframeRef}
            width="300%"
            height="300%"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&enablejsapi=1&showinfo=0&fs=0&rel=0&playsinline=1`}
            title="Kapsül Müziği"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>

        {/* Orta: Şarkı Bilgileri */}
        <div className="flex flex-col min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF2E93] animate-pulse shrink-0" />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-[#FF2E93]">CANLI RADYO</span>
            <Disc3 className={`w-3 h-3 text-[#FF2E93] ml-0.5 ${isPlaying ? 'animate-[spin_3s_linear_infinite]' : ''}`} />
          </div>
          <h3 className="text-white text-xs sm:text-sm font-black truncate w-full" title={title}>
            {title}
          </h3>
          <p className="text-neutral-400 text-[10px] sm:text-[11px] truncate w-full mt-0.5">
            {author}
          </p>
        </div>

      </div>
      
      {/* Sağ: Şarkı Değiştir */}
      <button
        onClick={onOpenModal}
        className="w-full sm:w-auto px-4 py-2 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
      >
        <Music className="w-3.5 h-3.5" />
        Şarkıyı Değiştir
      </button>
    </motion.div>
  );
}
