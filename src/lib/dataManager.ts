"use client";

import { db } from "./db";
import { SEED_DATA } from "@/data/seed";
import { getSession } from "./auth";

const SEED_VERSION = "v6";

function seedKey(): string {
  const username = getSession()?.username ?? "__guest__";
  return `studyexam_seed_${username}`;
}

export interface ExportBundle {
  version: number;
  exportedAt: string;
  userStats: object[];
  sessions: object[];
  progress: object[];
  content: object[];
}

export async function exportData(): Promise<void> {
  const [userStats, sessions, progress, content] = await Promise.all([
    db.userStats.toArray(),
    db.sessions.toArray(),
    db.progress.toArray(),
    db.content.toArray(),
  ]);

  const bundle: ExportBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userStats,
    sessions,
    progress,
    content,
  };

  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `studyexam-backup-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(file: File): Promise<{ imported: boolean; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = e.target?.result as string;
        const bundle: ExportBundle = JSON.parse(raw);

        if (bundle.version !== 1) {
          resolve({ imported: false, message: "Geçersiz yedek formatı." });
          return;
        }

        await db.transaction(
          "rw",
          db.userStats,
          db.sessions,
          db.progress,
          db.content,
          async () => {
            if (bundle.userStats?.length) {
              await db.userStats.clear();
              await db.userStats.bulkPut(bundle.userStats as never[]);
            }
            if (bundle.sessions?.length) {
              await db.sessions.clear();
              await db.sessions.bulkPut(bundle.sessions as never[]);
            }
            if (bundle.progress?.length) {
              await db.progress.clear();
              await db.progress.bulkPut(bundle.progress as never[]);
            }
            if (bundle.content?.length) {
              await db.content.clear();
              await db.content.bulkPut(bundle.content as never[]);
              localStorage.setItem(seedKey(), "imported");
            }
          }
        );

        resolve({
          imported: true,
          message: `✓ İçe aktarıldı: ${bundle.content?.length ?? 0} içerik, ${bundle.sessions?.length ?? 0} oturum`,
        });
      } catch {
        resolve({ imported: false, message: "Dosya okunamadı veya bozuk." });
      }
    };
    reader.readAsText(file);
  });
}

export async function resetUserProgress(): Promise<void> {
  await db.transaction("rw", db.userStats, db.sessions, db.progress, async () => {
    await db.userStats.clear();
    await db.sessions.clear();
    await db.progress.clear();
  });
}

export async function resetAllData(): Promise<void> {
  await db.transaction(
    "rw",
    db.userStats,
    db.sessions,
    db.progress,
    db.content,
    async () => {
      await db.userStats.clear();
      await db.sessions.clear();
      await db.progress.clear();
      await db.content.clear();
    }
  );
  localStorage.removeItem(seedKey());
}

export async function reloadSeedData(): Promise<void> {
  await db.content.bulkPut(SEED_DATA);
  localStorage.setItem(seedKey(), SEED_VERSION);
}
