"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const CoffeeCupSVG = () => (
  <svg width="200" height="250" viewBox="0 0 200 250" fill="none" xmlns="http://www.w3.org/2000/svg" >
    {/* Lid */}
    <path d="M40 50 L160 50 L155 30 C150 20 50 20 45 30 Z" fill="#ffffff" stroke="#ddd" strokeWidth="4"/>
    <path d="M30 50 L170 50 L170 55 L30 55 Z" fill="#fff" />
    {/* Cup Body */}
    <path d="M50 55 L70 230 C72 245 128 245 130 230 L150 55 Z" fill="#E8E8E8" />
    {/* Sleeve */}
    <path d="M57 100 L143 100 L137 150 L63 150 Z" fill="#C28E55" />
    {/* Siren / Logo Circle */}
    <circle cx="100" cy="125" r="18" fill="#00704A" />
    <circle cx="100" cy="125" r="14" stroke="#fff" strokeWidth="1" fill="none" />
    {/* Smoke */}
    <path d="M80 20 Q90 -10 100 0 T120 -20" stroke="white" strokeWidth="6" strokeLinecap="round" opacity="0.4" fill="transparent" />
  </svg>
);

const GhostSVG = () => (
  <svg width="180" height="180" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" >
    <path d="M30 140 L30 75 C30 25 120 25 120 75 L120 140 L105 125 L90 140 L75 125 L60 140 L45 125 Z" fill="#F5F5F5" />
    <circle cx="60" cy="65" r="9" fill="#111" />
    <circle cx="90" cy="65" r="9" fill="#111" />
    <ellipse cx="75" cy="95" rx="12" ry="18" fill="#111" />
    {/* Blush */}
    <circle cx="45" cy="75" r="6" fill="#FF88AA" opacity="0.5" />
    <circle cx="105" cy="75" r="6" fill="#FF88AA" opacity="0.5" />
  </svg>
);

const PumpkinSVG = () => (
  <svg width="200" height="190" viewBox="0 0 160 150" fill="none" xmlns="http://www.w3.org/2000/svg" >
    <ellipse cx="80" cy="85" rx="70" ry="55" fill="#E65100" />
    <ellipse cx="80" cy="85" rx="45" ry="55" fill="#EF6C00" />
    <ellipse cx="80" cy="85" rx="20" ry="55" fill="#F57C00" />
    {/* Stem */}
    <path d="M75 35 Q70 5 95 10" stroke="#4CAF50" strokeWidth="14" fill="none" strokeLinecap="round"/>
    {/* Eyes */}
    <polygon points="45,70 65,95 35,95" fill="#222" />
    <polygon points="115,70 125,95 95,95" fill="#222" />
    {/* Mouth */}
    <path d="M45 115 Q80 140 115 115 Q95 135 65 135 Z" fill="#222" />
  </svg>
);

const SpiderSVG = () => (
  <svg width="150" height="150" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" >
    <line x1="60" y1="0" x2="60" y2="40" stroke="#fff" strokeWidth="2" opacity="0.15" strokeDasharray="4 4" />
    {/* Legs Left */}
    <path d="M45 60 Q20 40 10 60" stroke="#1A1A1A" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M42 65 Q15 65 5 80" stroke="#1A1A1A" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M42 75 Q15 90 10 110" stroke="#1A1A1A" strokeWidth="6" fill="none" strokeLinecap="round" />
    {/* Legs Right */}
    <path d="M75 60 Q100 40 110 60" stroke="#1A1A1A" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M78 65 Q105 65 115 80" stroke="#1A1A1A" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M78 75 Q105 90 110 110" stroke="#1A1A1A" strokeWidth="6" fill="none" strokeLinecap="round" />
    {/* Body */}
    <circle cx="60" cy="70" r="22" fill="#1A1A1A" />
    <circle cx="60" cy="45" r="14" fill="#1A1A1A" />
    {/* Eyes */}
    <circle cx="54" cy="42" r="4" fill="#CCFF00" />
    <circle cx="66" cy="42" r="4" fill="#CCFF00" />
  </svg>
);

const LeafSVG = () => (
  <svg width="120" height="140" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" >
    <path d="M50 110 C 50 110, 15 80, 5 45 C -5 10, 45 5, 50 5 C 55 5, 105 10, 95 45 C 85 80, 50 110, 50 110 Z" fill="#D9534F" />
    <path d="M50 5 L50 110" stroke="#A93226" strokeWidth="4" opacity="0.6" strokeLinecap="round" />
    <path d="M50 50 L20 35" stroke="#A93226" strokeWidth="4" opacity="0.6" strokeLinecap="round" />
    <path d="M50 70 L80 50" stroke="#A93226" strokeWidth="4" opacity="0.6" strokeLinecap="round" />
    <path d="M50 90 L30 75" stroke="#A93226" strokeWidth="4" opacity="0.6" strokeLinecap="round" />
  </svg>
);

const DRAWINGS = [CoffeeCupSVG, GhostSVG, PumpkinSVG, SpiderSVG, LeafSVG];

export default function BackgroundAnimations() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    // Sadece client side'da oluştur
    const generateItems = () => {
      const newItems = Array.from({ length: 4 }).map((_, i) => {
        const DrawingComponent = DRAWINGS[Math.floor(Math.random() * DRAWINGS.length)];
        return {
          id: i,
          Component: DrawingComponent,
          left: Math.random() * 100, // % olarak
          duration: Math.random() * 40 + 40, // 20-40 saniye arası (yavaş)
          delay: Math.random() * 15,
          scale: Math.random() * 0.8 + 0.8, // 0.8x - 1.6x büyüklük
        };
      });
      setItems(newItems);
    };

    generateItems();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="hidden md:block fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.10]">
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{ y: "-20vh", x: `${item.left}vw`, rotate: -15 }}
          animate={{
            y: "120vh",
            x: `${item.left + (Math.random() * 20 - 10)}vw`,
            rotate: Math.random() > 0.5 ? 360 : -360,
          }}
          transition={{
            duration: item.duration,
            repeat: Infinity,
            delay: item.delay,
            ease: "linear",
          }}
          className="absolute"
          style={{
            left: `${item.left}%`,
            transform: `scale(${item.scale})`,
          }}
        >
          <item.Component />
        </motion.div>
      ))}
    </div>
  );
}
