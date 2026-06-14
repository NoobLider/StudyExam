"use client";

import { BookOpen, Star } from "lucide-react";
import { useContentMode } from "./ContentModeProvider";
import type { ContentMode } from "@/lib/db";

const OPTIONS: { mode: ContentMode; icon: React.ReactNode; title: string; desc: string; color: string }[] = [
  {
    mode: "comprehensive",
    icon: <BookOpen size={32} />,
    title: "Kapsamlı",
    desc: "Tüm konuları derinlemesine kapsar. Öğrenme ve uzun vadeli tekrar için idealdir.",
    color: "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    mode: "exam",
    icon: <Star size={32} />,
    title: "Sınav Odaklı",
    desc: "Sınavda çıkması muhtemel yıldızlı konulara odaklanır. Hızlı hazırlık için idealdir.",
    color: "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
];

export default function ContentModeModal() {
  const { needsSelection, setMode } = useContentMode();

  if (!needsSelection) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">İçerik Setini Seç</h2>
          <p className="text-sm text-muted-foreground">
            Cumhuriyet Dönemi Edebiyatı için hangi veri setini kullanmak istersin?
            Bu tercihi daha sonra ayarlardan değiştirebilirsin.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {OPTIONS.map(({ mode, icon, title, desc, color }) => (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              className={`flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${color}`}
            >
              <span className="shrink-0 mt-0.5">{icon}</span>
              <div>
                <p className="font-bold text-base">{title}</p>
                <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Yazar &amp; Eserler içeriği her iki seçenekte de dahildir.
        </p>
      </div>
    </div>
  );
}
