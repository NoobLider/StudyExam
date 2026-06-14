"use client";

import { useState, useCallback, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RefreshCw, CheckCircle2, XCircle, RotateCcw, BookOpen, Pen, Shuffle } from "lucide-react";
import { db, type ContentItem } from "@/lib/db";
import { useContentMode } from "@/components/features/ContentModeProvider";
import { awardXp, recordAnswer, finalizeStreak, XP_VALUES } from "@/lib/gamification";
import { notifyBadge, notifyLevelUp, notifyStreak } from "@/lib/notify";
import { pushUserData } from "@/lib/syncUserData";
import { Button } from "@/components/ui/button";

type CardDirection = "front" | "back" | "mixed";

export default function FlashcardsPage() {
  const [deck, setDeck] = useState<ContentItem[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState<"setup" | "playing" | "done">("setup");
  const [stats, setStats] = useState({ know: 0, dontKnow: 0 });
  const sessionStartRef = useRef<number>(0);
  const [topicFilter, setTopicFilter] = useState("all");
  const [cardDirection, setCardDirection] = useState<CardDirection>("front");
  const [cardDirections, setCardDirections] = useState<boolean[]>([]);

  const [subtopicFilter, setSubtopicFilter] = useState("all");
  const { mode: globalMode } = useContentMode();
  const isCumhuriyet = topicFilter === "Cumhuriyet Dönemi";

  const allCards = useLiveQuery(() => db.content.where("type").equals("flashcard").toArray(), []);
  const topics = [...new Set((allCards ?? []).map((c) => c.topic))];
  const subtopics = [...new Set((allCards ?? [])
    .filter((c) => topicFilter === "all" || c.topic === topicFilter)
    .map((c) => c.subtopic)
    .filter(Boolean) as string[])];

  const startDeck = useCallback(async () => {
    let items = allCards ?? [];
    if (topicFilter !== "all") items = items.filter((c) => c.topic === topicFilter);
    if (subtopicFilter !== "all") items = items.filter((c) => c.subtopic === subtopicFilter);
    if (isCumhuriyet && globalMode && globalMode !== "both") {
      items = items.filter((c) => !c.mode || c.mode === globalMode || c.mode === "both");
    }
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCardDirections(
      shuffled.map(() =>
        cardDirection === "mixed" ? Math.random() < 0.5 : cardDirection === "back"
      )
    );
    setIndex(0);
    setFlipped(false);
    setStats({ know: 0, dontKnow: 0 });
    sessionStartRef.current = Date.now();
    setPhase("playing");
  }, [allCards, topicFilter, subtopicFilter, globalMode, isCumhuriyet, cardDirection]);

  const handleAnswer = async (knows: boolean) => {
    const card = deck[index];
    const xp = knows ? XP_VALUES.flashcardKnow : XP_VALUES.flashcardDontKnow;
    const quality: 0 | 1 | 2 | 3 | 4 | 5 = knows ? 4 : 1;

    await recordAnswer(card.id, knows, quality);
    const { newBadges, leveledUp, newLevel } = await awardXp(xp);
    newBadges.forEach(notifyBadge);
    if (leveledUp) notifyLevelUp(newLevel);

    const newStats = { know: stats.know + (knows ? 1 : 0), dontKnow: stats.dontKnow + (knows ? 0 : 1) };
    setStats(newStats);

    if (index + 1 >= deck.length) {
      const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
      const total = newStats.know + newStats.dontKnow;
      await db.sessions.add({
        date: new Date().toISOString().split("T")[0],
        xpEarned: total * XP_VALUES.flashcardKnow,
        questionsAnswered: total,
        correctAnswers: newStats.know,
        durationSeconds,
        topics: [...new Set(deck.map((c) => c.topic))],
      });
      const { newBadges: sessionBadges, leveledUp: slu, newLevel: snl } = await awardXp(0, { sessionQuestions: total });
      sessionBadges.forEach(notifyBadge);
      if (slu) notifyLevelUp(snl);
      const newStreak = await finalizeStreak(total);
      notifyStreak(newStreak);
      pushUserData();
      setPhase("done");
    } else {
      setIndex((i) => i + 1);
      setFlipped(false);

    }
  };

  if (!allCards) return <PageLoader />;
  if (allCards.length === 0) return <EmptyState />;

  if (phase === "setup") {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Flashcard</h2>
          <p className="text-muted-foreground text-sm mt-1">Kartları çevirerek öğren</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
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
          <p className="text-sm text-muted-foreground">
            {(allCards ?? []).filter((c) =>
              (topicFilter === "all" || c.topic === topicFilter) &&
              (subtopicFilter === "all" || c.subtopic === subtopicFilter)
            ).length} kart
          </p>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Kart Yönü</p>
            <div className="flex flex-wrap gap-2">
              <DirectionChip icon={<BookOpen size={12}/>} label="Ön → Arka" active={cardDirection==="front"} onClick={()=>setCardDirection("front")} />
              <DirectionChip icon={<Pen size={12}/>} label="Arka → Ön" active={cardDirection==="back"} onClick={()=>setCardDirection("back")} />
              <DirectionChip icon={<Shuffle size={12}/>} label="Karışık" active={cardDirection==="mixed"} onClick={()=>setCardDirection("mixed")} />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {cardDirection==="front" ? "Ön yüzü gör, arka yüzü tahmin et" : cardDirection==="back" ? "Arka yüzü gör, ön yüzü tahmin et" : "Her kart rastgele yönde gösterilir"}
            </p>
          </div>
          <Button onClick={startDeck} className="w-full">Başlat</Button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const total = stats.know + stats.dontKnow;
    const pct = total > 0 ? Math.round((stats.know / total) * 100) : 0;
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <h2 className="text-2xl font-bold">Destesi Bitirdin!</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-green-500/10 p-4">
              <p className="text-2xl font-bold text-green-600">{stats.know}</p>
              <p className="text-xs text-muted-foreground">Biliyorum</p>
            </div>
            <div className="rounded-xl bg-red-500/10 p-4">
              <p className="text-2xl font-bold text-red-500">{stats.dontKnow}</p>
              <p className="text-xs text-muted-foreground">Bilmiyorum</p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">{pct}% başarı</p>
          <Button onClick={() => setPhase("setup")} className="w-full gap-2">
            <RefreshCw size={15} /> Tekrar
          </Button>
        </div>
      </div>
    );
  }

  const card = deck[index];
  if (!card) return null;

  const isReversed = cardDirections[index] ?? false;
  const shownFront = isReversed ? (card.back ?? card.answer ?? "") : (card.front ?? card.question ?? "");
  const shownBack  = isReversed ? (card.front ?? card.question ?? "") : (card.back ?? card.answer ?? "");
  const frontLabel = isReversed ? "Arka Yüz" : "Ön Yüz";
  const backLabel  = isReversed ? "Ön Yüz" : "Arka Yüz";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{index + 1} / {deck.length}</span>
        <span>{card.topic}{isReversed ? " · ↩" : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(index / deck.length) * 100}%` }} />
      </div>

      <div className="relative min-h-[220px] cursor-pointer" onClick={() => setFlipped((f) => !f)}>
        {/* Ön yüz */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-border bg-card p-6 text-center transition-all duration-300"
          style={{
            opacity: flipped ? 0 : 1,
            transform: flipped ? "scale(0.95) rotateY(90deg)" : "scale(1) rotateY(0deg)",
            pointerEvents: flipped ? "none" : "auto",
          }}
        >
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-3">{frontLabel}</span>
          <p className="text-lg font-semibold leading-relaxed">{shownFront}</p>
          <p className="text-xs text-muted-foreground mt-4">Çevirmek için tıkla</p>
        </div>

        {/* Arka yüz — overflow scroll for long content */}
        <div
          className="absolute inset-0 flex flex-col rounded-2xl border-2 border-primary bg-primary/5 p-6 text-center transition-all duration-300 overflow-y-auto"
          style={{
            opacity: flipped ? 1 : 0,
            transform: flipped ? "scale(1) rotateY(0deg)" : "scale(0.95) rotateY(-90deg)",
            pointerEvents: flipped ? "auto" : "none",
          }}
        >
          <span className="text-xs text-primary font-medium uppercase tracking-widest mb-3 shrink-0">{backLabel}</span>
          <p className="text-sm font-medium leading-relaxed whitespace-pre-line">{shownBack}</p>
        </div>
      </div>

      {!flipped ? (
        <button
          onClick={() => setFlipped(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <RotateCcw size={14} /> Cevabı Gör
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAnswer(false)}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
          >
            <XCircle size={16} /> Bilmiyorum
          </button>
          <button
            onClick={() => handleAnswer(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-green-300 bg-green-50 dark:bg-green-950/30 py-3 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-100 transition-colors"
          >
            <CheckCircle2 size={16} /> Biliyorum
          </button>
        </div>
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

function DirectionChip({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
      }`}
    >
      {icon}{label}
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
        <p className="font-medium">Henüz flashcard yok</p>
        <p className="text-sm text-muted-foreground">Admin panelinden içerik yükle.</p>
      </div>
    </div>
  );
}
