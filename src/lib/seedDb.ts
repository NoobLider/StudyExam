"use client";

import { reloadSeedData } from "./dataManager";
import { getSession } from "./auth";

const SEED_VERSION = "v6";

function seedKey(): string {
  const username = getSession()?.username ?? "__guest__";
  return `studyexam_seed_${username}`;
}

const seededUsers = new Set<string>();

export async function seedIfEmpty() {
  const key = seedKey();
  if (seededUsers.has(key)) return;
  seededUsers.add(key);
  const stored = localStorage.getItem(key);
  if (stored === SEED_VERSION) return;
  await reloadSeedData();
}
