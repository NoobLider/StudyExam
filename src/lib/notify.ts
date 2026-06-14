"use client";

import { toast } from "sonner";
import type { BadgeDef } from "./gamification";

export function notifyBadge(badge: BadgeDef) {
  toast.success(`${badge.icon} Rozet Kazandın!`, {
    description: `"${badge.name}" — ${badge.description}`,
    duration: 5000,
  });
}

export function notifyLevelUp(level: number) {
  toast.success(`⭐ Seviye Atladın!`, {
    description: `Seviye ${level}'e ulaştın! Harika gidiyorsun.`,
    duration: 5000,
  });
}

export function notifyStreak(streak: number) {
  if (streak === 3 || streak === 7 || streak === 14 || streak === 30 || streak % 10 === 0) {
    toast(`🔥 ${streak} Günlük Seri!`, {
      description: `${streak} gün üst üste çalıştın. Böyle devam!`,
      duration: 4000,
    });
  }
}

export function notifyDailyGoal() {
  toast.success("🎯 Günlük Hedef Tamamlandı!", {
    description: "+50 bonus XP kazandın!",
    duration: 4000,
  });
}

export function notifyXp(amount: number) {
  toast(`+${amount} XP`, { duration: 1500 });
}
