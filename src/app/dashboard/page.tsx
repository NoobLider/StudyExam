"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Brain, BookOpen, Flame, Star, Target, TrendingUp, ChevronRight, Clock, CalendarCheck } from "lucide-react";
import { db, getOrCreateUserStats } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seedDb";
import { xpProgressPercent, xpForLevel, BADGES } from "@/lib/gamification";
import { fetchSession } from "@/lib/auth";

export default function DashboardPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Önce kullanıcı oturumunu al (cache boşsa API'den çek)
      let user = await fetchSession();
      // Oturum alınana kadar bekle (max 3 deneme)
      let attempts = 0;
      while (!user && attempts < 3) {
        await new Promise(resolve => setTimeout(resolve, 500));
        user = await fetchSession();
        attempts++;
      }
      
      if (!mounted) return;
      
      await getOrCreateUserStats();
      await seedIfEmpty();
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  const stats = useLiveQuery(() => db.userStats.toArray().then((arr) => arr[0] ?? null), []);
  const contentCount = useLiveQuery(() => db.content.count(), []);
  const recentSessions = useLiveQuery(
    () => db.sessions.orderBy("date").reverse().limit(7).toArray(),
    []
  );
  const dueCount = useLiveQuery(
    () => db.progress.where("nextReview").belowOrEqual(new Date()).count(),
    []
  );

  // stats === null ise kayıt henüz oluşturuluyor demektir, loading göster
  if (!ready || stats === undefined || stats === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const s = stats ?? { xp: 0, level: 1, streak: 0, badges: [], todayQuestions: 0, dailyGoal: 20, totalSessions: 0, todayXp: 0, lastActiveDate: "" };
  const xpPercent = xpProgressPercent(s.xp);
  const nextXp = xpForLevel(s.level);
  const earnedBadges = BADGES.filter((b) => s.badges.includes(b.id));
  const dailyPercent = Math.min(100, Math.round((s.todayQuestions / s.dailyGoal) * 100));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Hoş geldin! 👋</h2>
        <p className="text-muted-foreground text-sm mt-1">Bugün ne öğreneceksin?</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<Flame className="text-orange-500" size={20} />} label="Seri" value={`${s.streak} gün`} />
        <StatCard icon={<Star className="text-yellow-400" size={20} />} label="Toplam XP" value={`${s.xp}`} />
        <StatCard icon={<Target className="text-blue-500" size={20} />} label="Bugün" value={`${s.todayQuestions}/${s.dailyGoal}`} />
        <StatCard icon={<TrendingUp className="text-green-500" size={20} />} label="Seviye" value={`${s.level}`} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span>Seviye {s.level} → {s.level + 1}</span>
          <span className="text-muted-foreground">{xpPercent}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{nextXp - s.xp} XP kaldı</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span>Günlük Hedef</span>
          <span className="text-muted-foreground">{dailyPercent}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-700"
            style={{ width: `${dailyPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{s.todayQuestions}/{s.dailyGoal} soru tamamlandı</p>
      </div>

      {(dueCount ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-amber-500" />
            <div>
              <p className="text-sm font-semibold">{dueCount} kart tekrar bekliyor</p>
              <p className="text-xs text-muted-foreground">Spaced repetition zamanı geldi</p>
            </div>
          </div>
          <Link href="/flashcards" className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline">
            Başla <ChevronRight size={13} />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ActionCard
          href="/quiz"
          icon={<Brain size={24} className="text-purple-500" />}
          title="Quiz Çöz"
          desc={`${contentCount ?? 0} soru hazır`}
          color="from-purple-500/10 to-purple-500/5"
        />
        <ActionCard
          href="/flashcards"
          icon={<BookOpen size={24} className="text-blue-500" />}
          title="Flashcard"
          desc="Kart çevirerek öğren"
          color="from-blue-500/10 to-blue-500/5"
        />
      </div>

      {(recentSessions?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck size={15} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">Son Oturumlar</h3>
          </div>
          <div className="space-y-1.5">
            {recentSessions?.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{s.date}</span>
                <div className="flex items-center gap-3">
                  <span>{s.questionsAnswered} soru</span>
                  <span className="text-green-500 font-medium">{s.correctAnswers} doğru</span>
                  <span className="text-yellow-500 font-medium">+{s.xpEarned} XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {earnedBadges.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-sm mb-3">Son Kazanılan Rozetler</h3>
          <div className="flex flex-wrap gap-2">
            {earnedBadges.slice(-4).map((b) => (
              <div key={b.id} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                <span>{b.icon}</span>
                <span>{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{contentCount ?? 0} içerik yüklü</p>
          <p className="text-xs text-muted-foreground">Daha fazla soru eklemek için Admin panelini kullan.</p>
        </div>
        <Link href="/admin" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          Admin <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  desc,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-xl border border-border bg-gradient-to-br ${color} p-4 transition-all hover:scale-[1.02] hover:shadow-md`}
    >
      <div className="rounded-lg bg-background p-2 shadow-sm">{icon}</div>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight size={18} className="text-muted-foreground" />
    </Link>
  );
}
