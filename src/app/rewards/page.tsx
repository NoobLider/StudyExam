"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { db, getOrCreateUserStats, type UserStats } from "@/lib/db";
import { BADGES, xpProgressPercent, xpForLevel, LEVEL_THRESHOLDS } from "@/lib/gamification";
import { fetchSession } from "@/lib/auth";

export default function RewardsPage() {
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function loadData() {
      let user = await fetchSession();
      let attempts = 0;
      while (!user && attempts < 3) {
        await new Promise(resolve => setTimeout(resolve, 500));
        user = await fetchSession();
        attempts++;
      }
      
      if (!mounted) return;
      
      await getOrCreateUserStats();
      
      if (!mounted) return;
      
      const userStatsArr = await db.userStats.toArray();
      const userStats = userStatsArr[0] ?? null;
      
      if (mounted) {
        setStats(userStats);
        setReady(true);
      }
    }
    
    loadData();
    
    return () => { mounted = false; };
  }, []);

  if (!ready || stats === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const s = stats ?? { xp: 0, level: 1, streak: 0, badges: [] as string[] };
  const xpPercent = xpProgressPercent(s.xp);
  const nextXp = xpForLevel(s.level);
  const earnedSet = new Set(s.badges);

  const milestones = [5, 10, 15, 20, 25, 30, 40, 50];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ödüller & Seviye</h2>
        <p className="text-muted-foreground text-sm mt-1">Kazandıkların ve hedeflerin</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-black">Seviye {s.level}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{s.xp} XP toplandı</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm font-medium text-muted-foreground">🔥 {s.streak} günlük seri</span>
          </div>
        </div>
        <div className="h-4 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Seviye {s.level}</span>
          <span>{nextXp - s.xp} XP kaldı → Seviye {s.level + 1}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-sm">Seviye Yol Haritası</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {milestones.map((lvl) => {
            const reached = s.level >= lvl;
            return (
              <div
                key={lvl}
                className={`flex-shrink-0 flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium w-14 ${reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                <span className="text-base">{reached ? "⭐" : "○"}</span>
                <span>Lv.{lvl}</span>
                <span className="text-[10px] opacity-70">{LEVEL_THRESHOLDS[lvl - 1]} XP</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">Rozetler</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BADGES.map((badge) => {
            const earned = earnedSet.has(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded-xl border p-4 flex items-start gap-3 transition-all ${earned ? "border-border bg-card" : "border-dashed border-border bg-muted/30 opacity-60"}`}
              >
                <span className="text-2xl">{earned ? badge.icon : <Lock size={20} className="text-muted-foreground mt-1" />}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${!earned && "text-muted-foreground"}`}>{badge.name}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{badge.description}</p>
                  {earned && <span className="text-[10px] text-green-500 font-medium">Kazanıldı ✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h3 className="font-semibold text-sm">XP Kazanma Rehberi</h3>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex justify-between"><span>Quiz sorusu (doğru)</span><span className="font-medium text-foreground">+10 XP</span></div>
          <div className="flex justify-between"><span>Quiz sorusu (yanlış)</span><span className="font-medium text-foreground">+2 XP</span></div>
          <div className="flex justify-between"><span>Flashcard (biliyorum)</span><span className="font-medium text-foreground">+5 XP</span></div>
          <div className="flex justify-between"><span>Flashcard (bilmiyorum)</span><span className="font-medium text-foreground">+1 XP</span></div>
          <div className="flex justify-between"><span>Günlük hedefe ulaş</span><span className="font-medium text-foreground">+50 XP</span></div>
          <div className="flex justify-between"><span>Seri devamı</span><span className="font-medium text-foreground">+20 XP</span></div>
          <div className="flex justify-between"><span>Mükemmel oturum</span><span className="font-medium text-foreground">+30 XP</span></div>
        </div>
      </div>
    </div>
  );
}
