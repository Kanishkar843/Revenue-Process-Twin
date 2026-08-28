import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

export interface CardData {
  icon: React.ReactNode;
  title: string;
  description: string;
  date: string;
  iconBg?: string;
  accentColor?: string;
}

interface DisplayCardsProps {
  cards: CardData[];
  className?: string;
}

/**
 * DisplayCards — interactive cycling card deck.
 *
 * • Front card is fully readable (z-top, no rotation)
 * • Cards behind are fanned at increasing rotation & offset
 * • Click anywhere on the deck → front card animates to back,
 *   next card slides forward with a spring
 * • Auto-cycles every 4 seconds when idle
 */
export function DisplayCards({ cards, className }: DisplayCardsProps) {
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [cycling, setCycling] = useState(false);

  const cycle = useCallback(() => {
    if (cycling) return;
    setCycling(true);
    setOrder((prev) => {
      const next = [...prev];
      const front = next.shift()!;
      next.push(front);
      return next;
    });
    // Unlock after animation completes
    setTimeout(() => setCycling(false), 550);
  }, [cycling]);

  // Fan parameters indexed from front (0) to back
  const FAN = [
    { rotate: 0,   x: 0,   y: 0,   scale: 1,      z: 30 },
    { rotate: 5,   x: 18,  y: 10,  scale: 0.96,   z: 20 },
    { rotate: -4,  x: -14, y: 16,  scale: 0.92,   z: 10 },
  ];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center select-none",
        // Size of the "stage" — must be big enough to contain the fanned deck
        "w-[340px] h-[260px]",
        className
      )}
      onClick={cycle}
      style={{ cursor: cycling ? "default" : "pointer" }}
      role="button"
      aria-label="Click to see next card"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && cycle()}
    >
      {/* Render from back → front so DOM stacking is correct */}
      {[...order].reverse().map((cardIdx, visualPos) => {
        // visualPos 0 = back, visualPos (n-1) = front
        const depthFromFront = (order.length - 1) - visualPos;
        const fan = FAN[Math.min(depthFromFront, FAN.length - 1)];
        const card = cards[cardIdx];
        const isFront = depthFromFront === 0;

        return (
          <motion.div
            key={cardIdx}
            layout
            initial={false}
            animate={{
              rotate: fan.rotate,
              x: fan.x,
              y: fan.y,
              scale: fan.scale,
              zIndex: fan.z,
            }}
            // When the front card is clicked, it swings out to the right/down before settling
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 26,
              mass: 0.9,
            }}
            style={{ position: "absolute" }}
            className={cn(
              "w-[290px] rounded-2xl border bg-white p-5",
              "shadow-[0_8px_32px_-4px_rgba(10,10,10,0.12),0_2px_8px_-2px_rgba(10,10,10,0.06)]",
              isFront
                ? "border-[rgba(0,0,0,0.08)] shadow-[0_16px_48px_-8px_rgba(10,10,10,0.18),0_4px_12px_-2px_rgba(10,10,10,0.08)]"
                : "border-[rgba(0,0,0,0.06)]"
            )}
          >
            {/* Icon */}
            <div
              className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
              style={{
                background: card.iconBg ?? "rgba(109, 91, 208, 0.10)",
                border: "1px solid rgba(109, 91, 208, 0.15)",
              }}
            >
              <span style={{ color: card.accentColor ?? "var(--color-accent)" }}>
                {card.icon}
              </span>
            </div>

            {/* Content */}
            <div className="text-sm font-bold text-[var(--color-ink)] mb-1.5 leading-snug">
              {card.title}
            </div>
            <div className="text-xs text-[var(--color-muted)] leading-relaxed mb-3">
              {card.description}
            </div>

            {/* Badge / tag */}
            <div
              className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg"
              style={{
                background: card.iconBg ?? "rgba(109, 91, 208, 0.08)",
                color: card.accentColor ?? "var(--color-accent)",
              }}
            >
              {card.date}
            </div>

            {/* Hint only on front card */}
            {isFront && (
              <motion.div
                className="absolute bottom-3 right-4 text-[10px] text-[var(--color-muted)] font-medium opacity-60 flex items-center gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 0.4 }}
              >
                tap to cycle
                <span className="text-[9px]">→</span>
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
