"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Flame, Star, CalendarCheck, TrendingUp } from "lucide-react";
import { db, getOrCreateUserStats, type UserStats, type ProgressItem, type ContentItem, type StudySession } from "@/lib/db";
import { useAuth } from "@/components/features/AuthProvider";

export default function StatsPage() {
  const { loading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [allProgress, setAllProgress] = useState<ProgressItem[]>([]);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    if (authLoading) return;
    
    let mounted = true;
    
    async function loadData() {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (!mounted) return;
      
      await getOrCreateUserStats();
      
      if (!mounted) return;
      
      const [userStatsArr, progress, content, sess] = await Promise.all([
        db.userStats.toArray(),
        db.progress.toArray(),
        db.content.toArray(),
        db.sessions.orderBy("date").reverse().limit(30).toArray()
      ]);
      
      if (mounted) {
        setStats(userStatsArr[0] ?? null);
        setAllProgress(progress);
        setAllContent(content);
        setSessions(sess);
        setReady(true);
      }
    }
    
    loadData();
    
    return () => { mounted = false; };
  }, [authLoading]);

  // Activity heatmap
  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) map[s.date] = (map[s.date] ?? 0) + s.questionsAnswered;
    const days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().split("T")[0];
      days.push({ date: key.slice(5), count: map[key] ?? 0 });
    }
    return days;
  }, [sessions]);

  if (!ready || stats === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const s = stats ?? { xp: 0, level: 1, streak: 0, badges: [] as string[], totalSessions: 0, todayXp: 0, todayQuestions: 0, dailyGoal: 20, lastActiveDate: "" };

  const contentMap = Object.fromEntries(allContent.map((c) => [c.id, c]));

  const topicStats: Record<string, { correct: number; total: number }> = {};
  for (const p of allProgress) {
    const c = contentMap[p.contentId];
    if (!c) continue;
    if (!topicStats[c.topic]) topicStats[c.topic] = { correct: 0, total: 0 };
    topicStats[c.topic].correct += p.correct;
    topicStats[c.topic].total += p.correct + p.incorrect;
  }

  const topicChartData = Object.entries(topicStats)
    .map(([topic, { correct, total }]) => ({
      topic: topic.length > 18 ? topic.slice(0, 18) + "…" : topic,
      fullTopic: topic,
      oran: total > 0 ? Math.round((correct / total) * 100) : 0,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const sessionChartData = (sessions ?? [])
    .slice()
    .reverse()
    .map((s) => ({
      date: s.date.slice(5),
      xp: s.xpEarned,
      sorular: s.questionsAnswered,
    }));

  const totalAnswered = allProgress.reduce((s, p) => s + p.correct + p.incorrect, 0);
  const totalCorrect = allProgress.reduce((s, p) => s + p.correct, 0);
  const totalIncorrect = totalAnswered - totalCorrect;
  const overallRate = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const weakTopics = Object.entries(topicStats)
    .filter(([, v]) => v.total >= 3)
    .map(([topic, { correct, total }]) => ({ topic, rate: Math.round((correct / total) * 100), total }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  const PIE_COLORS = ["#22c55e", "#ef4444"];
  const pieData = [
    { name: "Doğru", value: totalCorrect },
    { name: "Yanlış", value: totalIncorrect },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">İstatistikler</h2>
        <p className="text-muted-foreground text-sm mt-1">Gelişimini takip et</p>
      </div>

      {/* Üst özet kartları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<TrendingUp size={14} className="text-primary" />} label="Toplam Soru" value={totalAnswered} />
        <StatCard icon={<span className="text-green-500 text-sm">✓</span>} label="Başarı Oranı" value={`${overallRate}%`} color={overallRate >= 60 ? "text-green-500" : "text-red-500"} />
        <StatCard icon={<Star size={14} className="text-yellow-400" />} label="Toplam XP" value={s.xp} color="text-yellow-400" />
        <StatCard icon={<Flame size={14} className="text-amber-500" />} label="Seri (gün)" value={s.streak} color="text-amber-500" />
      </div>

      {/* Doğru/Yanlış Pie + Konu Başarı yan yana */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {totalAnswered > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-sm">Doğru / Yanlış</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  formatter={(v) => [v, "Soru"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {topicChartData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-sm">Konu Başarısı (%)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topicChartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="topic" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={48} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  formatter={(v) => [`${v}%`, "Başarı"]}
                  labelFormatter={(_, p) => p[0]?.payload?.fullTopic ?? ""}
                />
                <Bar dataKey="oran" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Aktivite heatmap — 30 gün */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><CalendarCheck size={14} /> Son 30 Gün Aktivitesi</h3>
        <div className="flex flex-wrap gap-1">
          {heatmapData.map(({ date, count }) => (
            <div
              key={date}
              title={`${date}: ${count} soru`}
              className={`h-5 w-5 rounded-sm ${
                count === 0 ? "bg-muted" :
                count < 5 ? "bg-primary/30" :
                count < 15 ? "bg-primary/60" :
                "bg-primary"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Koyu = daha fazla soru çözüldü</p>
      </div>

      {/* XP çizgi grafiği */}
      {sessionChartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Oturum Bazlı XP</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={sessionChartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Line type="monotone" dataKey="xp" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {weakTopics.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Zayıf Alanlar (En düşük başarı)</h3>
          <div className="space-y-2">
            {weakTopics.map(({ topic, rate, total }) => (
              <div key={topic} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{topic}</span>
                  <span className="text-muted-foreground">{rate}% ({total} soru)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${rate >= 60 ? "bg-green-500" : rate >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalAnswered === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="font-medium">Henüz veri yok</p>
          <p className="text-sm text-muted-foreground mt-1">Quiz veya Flashcard çalış, istatistikler burada görünür.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color = "text-foreground" }: { icon?: React.ReactNode; label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{typeof value === "number" ? value.toLocaleString("tr") : value}</p>
    </div>
  );
}
