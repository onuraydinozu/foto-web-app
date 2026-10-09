import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#090A0F] text-white flex flex-col items-center justify-center p-4 selection:bg-[#CCFF00]">
      {/* Ambiyans Arka Plan Parıltısı */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-40 z-0"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(204,255,0,0.08) 0%, transparent 60%)'
        }}
      />

      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center text-center space-y-6">
        {/* Neon Vizör & Logo İskeleti */}
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-[#12151F] border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(204,255,0,0.2)]">
            <span className="w-6 h-6 rounded-full bg-[#CCFF00] animate-ping opacity-75" />
          </div>
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#CCFF00] animate-pulse" />
        </div>

        {/* Başlık ve Alt Yazı İskeleti */}
        <div className="space-y-2.5 w-full flex flex-col items-center">
          <div className="h-6 w-44 rounded-full bg-white/10 animate-pulse" />
          <div className="h-3.5 w-60 rounded-full bg-white/5 animate-pulse" />
        </div>

        {/* Ana Kart İskeleti */}
        <div className="w-full rounded-3xl bg-[#12151F]/80 border border-white/10 p-6 space-y-4 shadow-2xl">
          <div className="h-12 w-full rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-12 w-full rounded-full bg-[#CCFF00]/15 border border-[#CCFF00]/30 animate-pulse" />
        </div>

        {/* Yükleniyor Durum Metni */}
        <p className="text-[11px] font-mono text-neutral-400 tracking-wider uppercase font-bold">
          ⚡ SNAPROOM YÜKLENİYOR...
        </p>
      </div>
    </div>
  );
}
