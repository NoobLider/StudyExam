"use client";

import type { ContentMode } from "./db";

const MODE_KEY_PREFIX = "studyexam_content_mode_";

export function getModeKey(username: string): string {
  return `${MODE_KEY_PREFIX}${username}`;
}

export function getContentMode(username: string): ContentMode | null {
  try {
    const raw = localStorage.getItem(getModeKey(username));
    if (raw === "comprehensive" || raw === "exam") return raw;
    return null;
  } catch {
    return null;
  }
}

export function setContentMode(username: string, mode: ContentMode): void {
  try {
    localStorage.setItem(getModeKey(username), mode);
  } catch {
    /* ignore */
  }
}

export const MODE_LABELS: Record<ContentMode, string> = {
  comprehensive: "📖 Kapsamlı",
  exam: "⭐ Sınav Odaklı",
  both: "Tümü",
};

export const MODE_DESCRIPTIONS: Record<ContentMode, string> = {
  comprehensive: "Tüm konuları derinlemesine kapsar. Öğrenme ve tekrar için idealdir.",
  exam: "Sınavda çıkması muhtemel yıldızlı konulara odaklanır. Hızlı hazırlık için idealdir.",
  both: "",
};
