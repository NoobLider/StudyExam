"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, XCircle, RefreshCw, Trophy, Filter, Timer } from "lucide-react";
import { db, type ContentItem } from "@/lib/db";
import { useContentMode } from "@/components/features/ContentModeProvider";
import { awardXp, recordAnswer, finalizeStreak, XP_VALUES } from "@/lib/gamification";
import { notifyBadge, notifyLevelUp, notifyStreak } from "@/lib/notify";
import { pushUserData } from "@/lib/syncUserData";
import { Button } from "@/components/ui/button";

type Phase = "setup" | "playing" | "result";

const TIMER_SECONDS = 30;

interface SessionResult {
  total: number;
  correct: number;
  xpEarned: number;
}

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<ContentItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ correct: 0, xp: 0 });
  const [result, setResult] = useState<SessionResult | null>(null);
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [sessionStart, setSessionStart] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [subtopicFilter, setSubtopicFilter] = useState<string>("all");
  const { mode: globalMode } = useContentMode();
  const isCumhuriyet = topicFilter === "Cumhuriyet Dönemi";

  const allContent = useLiveQuery(() => db.content.where("type").equals("quiz").toArray(), []);
  const topics = [...new Set((allContent ?? []).map((c) => c.topic))];
  const subtopics = [...new Set((allContent ?? [])
    .filter((c) => topicFilter === "all" || c.topic === topicFilter)
    .map((c) => c.subtopic)
    .filter(Boolean) as string[])];

  useEffect(() => {
    if (timerEnabled && phase === "playing" && !revealed) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setSelected("__timeout__");
            setRevealed(true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerEnabled, phase, revealed, current]);

  const startQuiz = useCallback(async () => {
    let items = allContent ?? [];
    if (topicFilter !== "all") items = items.filter((c) => c.topic === topicFilter);
    if (subtopicFilter !== "all") items = items.filter((c) => c.subtopic === subtopicFilter);

    if (globalMode && globalMode !== "both") {
      items = items.filter((c) => c.topic !== "Cumhuriyet Dönemi" || !c.mode || c.mode === globalMode || c.mode === "both");
    }

    let selected: ContentItem[];
    if (topicFilter === "all") {
      const byTopic: Record<string, ContentItem[]> = {};
      for (const c of items) {
        if (!byTopic[c.topic]) byTopic[c.topic] = [];
        byTopic[c.topic].push(c);
      }
      const topics = Object.keys(byTopic);
      const perTopic = Math.max(1, Math.ceil(20 / topics.length));
      selected = topics.flatMap((t) =>
        [...byTopic[t]].sort(() => Math.random() - 0.5).slice(0, perTopic)
      ).sort(() => Math.random() - 0.5).slice(0, 20);
    } else {
      selected = [...items].sort(() => Math.random() - 0.5).slice(0, 20);
    }

    const shuffled = selected.map((q) => ({
        ...q,
        options: q.options ? [...q.options].sort(() => Math.random() - 0.5) : q.options,
      }));
    setQuestions(shuffled);
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setScore({ correct: 0, xp: 0 });
    setSessionStart(Date.now());
    setTimeLeft(TIMER_SECONDS);
    setPhase("playing");
  }, [allContent, topicFilter, subtopicFilter, globalMode, isCumhuriyet]);

  const handleSelect = (option: string) => {
    if (revealed) return;
    setSelected(option);
    setRevealed(true);
  };

  const handleNext = async () => {
    const q = questions[current];
    const isCorrect = selected === q.answer;
    const xp = isCorrect ? XP_VALUES.quizCorrect : XP_VALUES.quizIncorrect;
    const quality = isCorrect ? 4 : 1;

    await recordAnswer(q.id, isCorrect, quality as 0 | 1 | 2 | 3 | 4 | 5);
    const { newBadges, leveledUp, newLevel } = await awardXp(xp);
    newBadges.forEach(notifyBadge);
    if (leveledUp) notifyLevelUp(newLevel);

    const newCorrect = score.correct + (isCorrect ? 1 : 0);
    const newXp = score.xp + xp;
    setScore({ correct: newCorrect, xp: newXp });

    if (current + 1 >= questions.length) {
      const isPerfect = newCorrect === questions.length;
      let bonusXp = 0;
      if (isPerfect) {
        const { newBadges: b2, leveledUp: lu2, newLevel: nl2 } = await awardXp(30, {
          perfectSession: true,
          sessionQuestions: questions.length,
        });
        b2.forEach(notifyBadge);
        if (lu2) notifyLevelUp(nl2);
        bonusXp = 30;
      } else {
        const { newBadges: b2, leveledUp: lu2, newLevel: nl2 } = await awardXp(0, {
          sessionQuestions: questions.length,
        });
        b2.forEach(notifyBadge);
        if (lu2) notifyLevelUp(nl2);
      }
      const durationSeconds = Math.round((Date.now() - sessionStart) / 1000);
      const topics = [...new Set(questions.map((q) => q.topic))];
      await db.sessions.add({
        date: new Date().toISOString().split("T")[0],
        xpEarned: newXp + bonusXp,
        questionsAnswered: questions.length,
        correctAnswers: newCorrect,
        durationSeconds,
        topics,
      });
      const newStreak = await finalizeStreak(questions.length);
      notifyStreak(newStreak);
      setResult({ total: questions.length, correct: newCorrect, xpEarned: newXp + bonusXp });
      pushUserData();
      setPhase("result");
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setRevealed(false);
      setTimeLeft(TIMER_SECONDS);
    }
  };

  if (!allContent) {
    return <PageLoader />;
  }

  if (allContent.length === 0) {
    return <EmptyState />;
  }

  if (phase === "setup") {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Quiz</h2>
          <p className="text-muted-foreground text-sm mt-1">Bilgini test et</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter size={15} />
              <span>Filtreler</span>
            </div>
            <button
              onClick={() => setTimerEnabled((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                timerEnabled ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <Timer size={12} /> Zamanlayıcı {timerEnabled ? "Açık" : "Kapalı"}
            </button>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Konu</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip label="Tümü" active={topicFilter === "all"} onClick={() => { setTopicFilter("all"); setSubtopicFilter("all"); }} />
              {topics.map((t) => (
                <FilterChip key={t} label={t} active={topicFilter === t} onClick={() => { setTopicFilter(t); setSubtopicFilter("all"); }} />
              ))}
            </div>
          </div>
          {isCumhuriyet && globalMode && (
            <p className="text-xs text-muted-foreground">
              📚 {globalMode === "comprehensive" ? "Kapsamlı" : "Sınav Odaklı"} set aktif — Sidebar’dan değiştirebilirsin.
            </p>
          )}
          {subtopics.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Alt Konu</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip label="Tümü" active={subtopicFilter === "all"} onClick={() => setSubtopicFilter("all")} />
                {subtopics.map((s) => (
                  <FilterChip key={s} label={s} active={subtopicFilter === s} onClick={() => setSubtopicFilter(s)} />
                ))}
              </div>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            {(allContent ?? []).filter((c) =>
              (topicFilter === "all" || c.topic === topicFilter) &&
              (subtopicFilter === "all" || c.subtopic === subtopicFilter)
            ).length} soru mevcut
          </div>
          <Button onClick={startQuiz} className="w-full">Quiz Başlat</Button>
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    const pct = Math.round((result.correct / result.total) * 100);
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <Trophy size={40} className="mx-auto text-yellow-400" />
          <h2 className="text-2xl font-bold">Oturum Tamamlandı!</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-2xl font-bold">{result.correct}/{result.total}</p><p className="text-xs text-muted-foreground">Doğru</p></div>
            <div><p className="text-2xl font-bold text-green-500">{pct}%</p><p className="text-xs text-muted-foreground">Başarı</p></div>
            <div><p className="text-2xl font-bold text-yellow-400">+{result.xpEarned}</p><p className="text-xs text-muted-foreground">XP</p></div>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <Button onClick={() => setPhase("setup")} className="w-full gap-2">
            <RefreshCw size={15} /> Tekrar Oyna
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  if (!q) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{current + 1} / {questions.length}</span>
        <div className="flex items-center gap-3">
          {timerEnabled && (
            <span className={`flex items-center gap-1 font-bold ${
              timeLeft <= 10 ? "text-red-500" : "text-foreground"
            }`}>
              <Timer size={13} /> {timeLeft}s
            </span>
          )}
          <span className="font-medium text-foreground">{score.correct} doğru</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((current) / questions.length) * 100}%` }} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-1">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{q.topic}{q.subtopic ? ` · ${q.subtopic}` : ""}</span>
        <p className="text-base font-medium leading-relaxed mt-2">{q.question}</p>
      </div>

      <div className="space-y-2">
        {(q.options ?? []).map((opt) => {
          let variant: "default" | "outline" = "outline";
          let extraClass = "";
          if (revealed) {
            if (opt === q.answer) extraClass = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
            else if (opt === selected) extraClass = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
          } else if (opt === selected) {
            extraClass = "border-primary bg-primary/10";
          }
          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={revealed}
              className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all ${extraClass || "border-border hover:border-primary hover:bg-accent"}`}
            >
              <span className="flex items-center gap-2">
                {revealed && opt === q.answer && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                {revealed && opt === selected && opt !== q.answer && <XCircle size={16} className="text-red-500 shrink-0" />}
                {opt}
              </span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <Button onClick={handleNext} className="w-full">
          {current + 1 >= questions.length ? "Sonuçları Gör" : "Sonraki Soru →"}
        </Button>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
    >
      {label}
    </button>
  );
}

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center space-y-2">
        <p className="font-medium">Henüz quiz sorusu yok</p>
        <p className="text-sm text-muted-foreground">Admin panelinden içerik yükle.</p>
      </div>
    </div>
  );
}
