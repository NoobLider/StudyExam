"use client";

import Dexie, { type EntityTable } from "dexie";
import { getSession } from "@/lib/auth";

export type ContentType = "quiz" | "flashcard" | "summary";
export type Difficulty = 1 | 2 | 3;

export type ContentMode = "comprehensive" | "exam" | "both";

export interface ContentItem {
  id: string;
  subject: string;
  topic: string;
  subtopic?: string;
  type: ContentType;
  question?: string;
  options?: string[];
  answer?: string;
  front?: string;
  back?: string;
  difficulty: Difficulty;
  source: string;
  tags: string[];
  mode?: ContentMode;
}

export interface ProgressItem {
  id?: number;
  contentId: string;
  correct: number;
  incorrect: number;
  lastReviewed: Date;
  nextReview: Date;
  easeFactor: number;
  interval: number;
}

export interface UserStats {
  id?: number;
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: string;
  lastStreakDate?: string;
  badges: string[];
  dailyGoal: number;
  todayXp: number;
  todayQuestions: number;
  totalSessions: number;
}

export interface StudySession {
  id?: number;
  date: string;
  xpEarned: number;
  questionsAnswered: number;
  correctAnswers: number;
  durationSeconds: number;
  topics: string[];
}

class StudyExamDB extends Dexie {
  content!: EntityTable<ContentItem, "id">;
  progress!: EntityTable<ProgressItem, "id">;
  userStats!: EntityTable<UserStats, "id">;
  sessions!: EntityTable<StudySession, "id">;

  constructor(dbName: string) {
    super(dbName);
    this.version(2).stores({
      content: "id, subject, topic, subtopic, type, difficulty, source, *tags",
      progress: "++id, contentId, nextReview, lastReviewed",
      userStats: "++id",
      sessions: "++id, date",
    });
  }
}

const dbCache: Record<string, StudyExamDB> = {};

export function getDb(username?: string): StudyExamDB {
  const key = username ?? getSession()?.username ?? "__guest__";
  if (!dbCache[key]) {
    dbCache[key] = new StudyExamDB(`studyexam_${key}`);
  }
  return dbCache[key];
}

// Convenience proxy — always uses the currently logged-in user's DB
export const db: StudyExamDB = new Proxy({} as StudyExamDB, {
  get(_target, prop) {
    return getDb()[prop as keyof StudyExamDB];
  },
});

export async function getOrCreateUserStats(): Promise<UserStats> {
  const existing = await db.userStats.toArray();
  if (existing.length > 0) return existing[0];
  const today = new Date().toISOString().split("T")[0];
  const id = await db.userStats.add({
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDate: today,
    badges: [],
    dailyGoal: 20,
    todayXp: 0,
    todayQuestions: 0,
    totalSessions: 0,
  });
  return (await db.userStats.get(id))!;
}

export async function getDueItems(limit = 20): Promise<ContentItem[]> {
  const now = new Date();
  const dueProgress = await db.progress
    .where("nextReview")
    .belowOrEqual(now)
    .toArray();

  if (dueProgress.length === 0) {
    return db.content.limit(limit).toArray();
  }

  const ids = dueProgress.map((p) => p.contentId);
  const items = await db.content.bulkGet(ids);
  return items.filter(Boolean) as ContentItem[];
}
