import React from 'react';

export default function RoomLoading() {
  return (
    <div className="min-h-screen bg-[#090A0F] text-white selection:bg-[#CCFF00] overflow-x-hidden p-3 sm:p-6 space-y-5">
      {/* 1. KAT: Header İskeleti */}
      <div className="w-full max-w-5xl mx-auto">
        <div className="rounded-2xl bg-[#12151F]/90 border border-white/10 px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-full bg-white/10 animate-pulse" />
            <div className="h-8 w-32 rounded-full bg-white/5 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 rounded-full bg-white/5 animate-pulse" />
            <div className="h-7 w-16 rounded-full bg-[#CCFF00]/15 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 2. KAT: Profil & Durum İskeleti */}
      <div className="w-full max-w-5xl mx-auto">
        <div className="rounded-2xl bg-[#12151F]/60 border border-white/10 px-3 py-2 flex items-center justify-between gap-2">
          <div className="h-7 w-28 rounded-full bg-white/10 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 rounded-full bg-emerald-500/10 animate-pulse" />
            <div className="h-6 w-16 rounded-full bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 3. KAT: Masanın Araçları İskeleti */}
      <div className="w-full max-w-5xl mx-auto">
        <div className="rounded-2xl bg-[#12151F]/60 border border-white/10 p-3 space-y-3">
          <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
          <div className="flex items-center gap-2 overflow-hidden py-1">
            {[80, 95, 90, 85, 90, 85].map((w, i) => (
              <div 
                key={i} 
                className="h-10 rounded-xl bg-white/5 border border-white/5 animate-pulse shrink-0" 
                style={{ width: `${w}px` }} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* 4. KAT: Galeri Izgarası İskeleti */}
      <div className="w-full max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-36 rounded-full bg-white/10 animate-pulse" />
          <div className="h-7 w-24 rounded-xl bg-white/5 animate-pulse" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div 
              key={i} 
              className="bg-[#12151F]/70 border border-white/10 p-2 sm:p-2.5 pb-4 rounded-2xl space-y-2.5 shadow-lg animate-pulse"
            >
              <div className="aspect-square rounded-xl bg-white/5" />
              <div className="flex items-center justify-between px-1">
                <div className="h-3 w-16 rounded bg-white/10" />
                <div className="h-3 w-10 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
