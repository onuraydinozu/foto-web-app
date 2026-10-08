"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const EMOJIS = ["🕷️", "🕸️", "🎃", "☕️", "👻", "🦇", "🍂", "☕", "🧡"];

export default function BackgroundAnimations() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    // Sadece client side'da oluştur
    const generateItems = () => {
      const newItems = Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        left: Math.random() * 100, // % olarak
        duration: Math.random() * 15 + 10, // 10-25 saniye arası
        delay: Math.random() * 10,
        size: Math.random() * 1.5 + 1, // 1-2.5rem arası
      }));
      setItems(newItems);
    };

    generateItems();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1] opacity-20">
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{ y: -100, x: `${item.left}vw`, rotate: 0 }}
          animate={{
            y: "110vh",
            x: `${item.left + (Math.random() * 10 - 5)}vw`,
            rotate: 360,
          }}
          transition={{
            duration: item.duration,
            repeat: Infinity,
            delay: item.delay,
            ease: "linear",
          }}
          className="absolute text-3xl"
          style={{
            fontSize: `${item.size}rem`,
            left: `${item.left}%`,
          }}
        >
          {item.emoji}
        </motion.div>
      ))}
    </div>
  );
}
