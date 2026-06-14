"use client";

import { db } from "./db";

export async function pushUserData(): Promise<void> {
  try {
    const [userStatsArr, sessions, progress] = await Promise.all([
      db.userStats.toArray(),
      db.sessions.toArray(),
      db.progress.toArray(),
    ]);
    await fetch("/api/userdata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userStats: userStatsArr[0] ?? null,
        sessions,
        progress,
      }),
    });
  } catch {
    /* network hatası — sessizce geç */
  }
}

export async function pullUserData(): Promise<void> {
  try {
    const res = await fetch("/api/userdata");
    if (!res.ok) return;
    const data = await res.json();

    await db.transaction("rw", db.userStats, db.sessions, db.progress, async () => {
      if (data.userStats) {
        await db.userStats.clear();
        await db.userStats.put(data.userStats);
      }
      if (Array.isArray(data.sessions) && data.sessions.length > 0) {
        await db.sessions.clear();
        await db.sessions.bulkPut(data.sessions);
      }
      if (Array.isArray(data.progress) && data.progress.length > 0) {
        await db.progress.clear();
        await db.progress.bulkPut(data.progress);
      }
    });
  } catch {
    /* network hatası — sessizce geç */
  }
}
