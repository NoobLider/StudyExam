import { db, getOrCreateUserStats, type ProgressItem } from "./db";

export const XP_VALUES = {
  quizCorrect: 10,
  quizIncorrect: 2,
  flashcardKnow: 5,
  flashcardDontKnow: 1,
  dailyGoalBonus: 50,
  streakBonus: 20,
} as const;

export const LEVEL_THRESHOLDS: number[] = Array.from({ length: 50 }, (_, i) =>
  Math.floor(100 * Math.pow(i + 1, 1.5))
);

export function xpForLevel(level: number): number {
  return LEVEL_THRESHOLDS[Math.min(level - 1, 49)];
}

export function levelFromXp(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 2;
  }
  return 1;
}

export function xpProgressPercent(xp: number): number {
  const level = levelFromXp(xp);
  const current = LEVEL_THRESHOLDS[level - 2] ?? 0;
  const next = LEVEL_THRESHOLDS[level - 1] ?? LEVEL_THRESHOLDS[49];
  return Math.round(((xp - current) / (next - current)) * 100);
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const BADGES: BadgeDef[] = [
  { id: "first_quiz", name: "İlk Adım", description: "İlk quizi tamamladın", icon: "🎯" },
  { id: "streak_3", name: "3 Günlük Seri", description: "3 gün üst üste çalıştın", icon: "🔥" },
  { id: "streak_7", name: "Haftalık Seri", description: "7 gün üst üste çalıştın", icon: "⚡" },
  { id: "streak_30", name: "Aylık Efsane", description: "30 gün üst üste çalıştın", icon: "👑" },
  { id: "level_5", name: "Seviye 5", description: "5. seviyeye ulaştın", icon: "⭐" },
  { id: "level_10", name: "Seviye 10", description: "10. seviyeye ulaştın", icon: "🌟" },
  { id: "level_25", name: "Uzman", description: "25. seviyeye ulaştın", icon: "💎" },
  { id: "questions_50", name: "50 Soru", description: "50 soru çözdün", icon: "📚" },
  { id: "questions_200", name: "200 Soru", description: "200 soru çözdün", icon: "🏆" },
  { id: "perfect_session", name: "Mükemmel", description: "Bir oturumda hepsini doğru yaptın", icon: "✨" },
];

export async function awardXp(
  amount: number,
  opts: { perfectSession?: boolean; sessionQuestions?: number } = {}
): Promise<{ newBadges: BadgeDef[]; leveledUp: boolean; newLevel: number }> {
  const stats = await getOrCreateUserStats();
  const oldLevel = stats.level;
  const today = new Date().toISOString().split("T")[0];
  const isToday = stats.lastActiveDate === today;

  const newXp = stats.xp + amount;
  const newLevel = levelFromXp(newXp);
  const newTodayXp = (isToday ? stats.todayXp : 0) + amount;
  const dailyBonusEarned = newTodayXp >= stats.dailyGoal && (isToday ? stats.todayXp < stats.dailyGoal : true);
  const finalXp = newXp + (dailyBonusEarned ? XP_VALUES.dailyGoalBonus : 0);
  const newTotalAnswered = (stats.todayQuestions) + (opts.sessionQuestions ?? 0);
  const isSessionEnd = opts.sessionQuestions !== undefined;
  const newTotalSessions = stats.totalSessions + (isSessionEnd ? 1 : 0);

  const newBadges = checkBadges(
    { ...stats, xp: finalXp, level: newLevel, totalAnswered: newTotalAnswered, totalSessions: newTotalSessions },
    stats.badges,
    opts.perfectSession ?? false,
    isSessionEnd
  );

  await db.userStats.update(stats.id!, {
    xp: finalXp,
    level: newLevel,
    lastActiveDate: today,
    todayXp: newTodayXp,
    todayQuestions: isToday ? stats.todayQuestions : 0,
    totalSessions: newTotalSessions,
    badges: [...stats.badges, ...newBadges.map((b) => b.id)],
  });

  return { newBadges, leveledUp: newLevel > oldLevel, newLevel };
}

const STREAK_MIN_QUESTIONS = 20;

export async function finalizeStreak(sessionQuestions: number): Promise<number> {
  if (sessionQuestions < STREAK_MIN_QUESTIONS) {
    return (await getOrCreateUserStats()).streak;
  }

  const stats = await getOrCreateUserStats();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const lastStreak = stats.lastStreakDate ?? "";

  if (lastStreak === today) {
    return stats.streak;
  }

  let newStreak: number;
  if (lastStreak === yesterday) {
    newStreak = stats.streak + 1;
  } else {
    newStreak = 1;
  }

  const bonusXp = newStreak > 1 ? XP_VALUES.streakBonus : 0;
  await db.userStats.update(stats.id!, {
    streak: newStreak,
    lastStreakDate: today,
    xp: stats.xp + bonusXp,
  });

  return newStreak;
}

function checkBadges(
  stats: { xp: number; level: number; streak: number; todayQuestions: number; totalSessions: number; totalAnswered?: number },
  existing: string[],
  perfectSession = false,
  isSessionEnd = false
): BadgeDef[] {
  const earned: BadgeDef[] = [];
  const check = (id: string, condition: boolean) => {
    if (condition && !existing.includes(id)) {
      const badge = BADGES.find((b) => b.id === id);
      if (badge) earned.push(badge);
    }
  };

  check("first_quiz", isSessionEnd);
  check("streak_3", stats.streak >= 3);
  check("streak_7", stats.streak >= 7);
  check("streak_30", stats.streak >= 30);
  check("level_5", stats.level >= 5);
  check("level_10", stats.level >= 10);
  check("level_25", stats.level >= 25);
  check("questions_50", (stats.totalAnswered ?? 0) >= 50);
  check("questions_200", (stats.totalAnswered ?? 0) >= 200);
  check("perfect_session", perfectSession);
  return earned;
}

export function sm2(
  item: Partial<ProgressItem>,
  quality: 0 | 1 | 2 | 3 | 4 | 5
): Pick<ProgressItem, "easeFactor" | "interval" | "nextReview"> {
  const ef = Math.max(
    1.3,
    (item.easeFactor ?? 2.5) + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );
  let interval: number;
  if (quality < 3) {
    interval = 1;
  } else if (!item.interval || item.interval === 0) {
    interval = 1;
  } else if (item.interval === 1) {
    interval = 6;
  } else {
    interval = Math.round((item.interval ?? 1) * ef);
  }
  const nextReview = new Date(Date.now() + interval * 86400000);
  return { easeFactor: ef, interval, nextReview };
}

export async function recordAnswer(
  contentId: string,
  correct: boolean,
  quality: 0 | 1 | 2 | 3 | 4 | 5
): Promise<void> {
  const existing = await db.progress.where("contentId").equals(contentId).first();
  const sm2Result = sm2(existing ?? {}, quality);

  if (existing) {
    await db.progress.update(existing.id!, {
      correct: existing.correct + (correct ? 1 : 0),
      incorrect: existing.incorrect + (correct ? 0 : 1),
      lastReviewed: new Date(),
      ...sm2Result,
    });
  } else {
    await db.progress.add({
      contentId,
      correct: correct ? 1 : 0,
      incorrect: correct ? 0 : 1,
      lastReviewed: new Date(),
      ...sm2Result,
    });
  }

  const stats = await getOrCreateUserStats();
  const today = new Date().toISOString().split("T")[0];
  const isToday = stats.lastActiveDate === today;
  await db.userStats.update(stats.id!, {
    todayQuestions: (isToday ? stats.todayQuestions : 0) + 1,
  });
}
