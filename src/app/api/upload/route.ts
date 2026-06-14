import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";
import type { ContentItem } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    const items: ContentItem[] = [];

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = XLSX.read(buffer, { type: "buffer" });

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        for (const row of rows) {
          const keys = Object.keys(row).map((k) => k.trim().toLowerCase());
          const val = (k: string) => String(row[Object.keys(row).find((x) => x.trim().toLowerCase() === k) ?? ""] ?? "").trim();

          const yazar = val("yazar") || val("ad") || val("isim") || val("name") || val("author");
          const eser = val("eser") || val("yapıt") || val("kitap") || val("eserler") || val("work") || val("title");

          if (yazar && eser) {
            const eserleri = eser.split(/[,;\/\n]+/).map((e) => e.trim()).filter(Boolean);
            for (const tek of eserleri) {
              items.push({
                id: randomUUID(),
                subject: "Edebiyat",
                topic: sheetName !== "Sheet1" ? sheetName : "Yazarlar ve Eserleri",
                type: "flashcard",
                front: yazar,
                back: tek,
                difficulty: 2,
                source: file.name,
                tags: ["yazar", "eser"],
              });
            }
            items.push({
              id: randomUUID(),
              subject: "Edebiyat",
              topic: sheetName !== "Sheet1" ? sheetName : "Yazarlar ve Eserleri",
              type: "quiz",
              question: `${yazar}'ın eserleri arasında hangisi yer alır?`,
              options: shuffleWithCorrect(eser.split(/[,;\/\n]+/).map((e) => e.trim()).filter(Boolean)[0], []),
              answer: eser.split(/[,;\/\n]+/).map((e) => e.trim()).filter(Boolean)[0],
              difficulty: 2,
              source: file.name,
              tags: ["yazar", "quiz"],
            });
          } else {
            const question = val("soru") || val("question") || val("ön yüz") || val("front") || keys[0] ? row[Object.keys(row)[0]] : "";
            const answer = val("cevap") || val("answer") || val("arka yüz") || val("back") || keys[1] ? row[Object.keys(row)[1]] : "";
            const topic = val("konu") || val("topic") || val("ders") || sheetName;
            const optionsRaw = val("seçenekler") || val("options") || val("şıklar");

            if (question && answer) {
              items.push({
                id: randomUUID(),
                subject: "Edebiyat",
                topic,
                type: optionsRaw ? "quiz" : "flashcard",
                question: optionsRaw ? String(question) : undefined,
                options: optionsRaw ? optionsRaw.split(/[|;,]/).map((o) => o.trim()) : undefined,
                answer: String(answer),
                front: !optionsRaw ? String(question) : undefined,
                back: !optionsRaw ? String(answer) : undefined,
                difficulty: 2,
                source: file.name,
                tags: [topic],
              });
            }
          }
        }
      }
    } else if (name.endsWith(".pdf")) {
      const text = await extractPdfText(buffer);
      const parsed = parsePdfContent(text, file.name);
      items.push(...parsed);
    } else {
      return NextResponse.json({ error: "Desteklenmeyen dosya formatı" }, { status: 400 });
    }

    return NextResponse.json({ items, count: items.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return data.text;
  } catch {
    return buffer.toString("utf-8").replace(/[^\x20-\x7E\u00C0-\u024F\u0100-\u017F]/g, " ");
  }
}

function parsePdfContent(text: string, filename: string): ContentItem[] {
  const items: ContentItem[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  let currentTopic = "Genel";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.length < 80 && /^[A-ZÇĞİÖŞÜ][a-zA-ZçğıöşüÇĞİÖŞÜ\s]+$/.test(line) && line.length > 4) {
      currentTopic = line;
      i++;
      continue;
    }

    const qMatch = line.match(/^(\d+[\.\)]\s+|S:\s*|Soru:\s*)(.+)/);
    if (qMatch) {
      const question = qMatch[2].trim();
      const options: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^[A-E][\.\)]\s+/.test(lines[j])) {
        options.push(lines[j].replace(/^[A-E][\.\)]\s+/, "").trim());
        j++;
      }

      if (options.length >= 2) {
        items.push({
          id: randomUUID(),
          subject: "Edebiyat",
          topic: currentTopic,
          type: "quiz",
          question,
          options,
          answer: options[0],
          difficulty: 2,
          source: filename,
          tags: [currentTopic, "pdf"],
        });
        i = j;
        continue;
      }
    }

    if (line.length > 30 && line.length < 300) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 5 && colonIdx < line.length - 5) {
        const front = line.slice(0, colonIdx).trim();
        const back = line.slice(colonIdx + 1).trim();
        if (front && back) {
          items.push({
            id: randomUUID(),
            subject: "Edebiyat",
            topic: currentTopic,
            type: "flashcard",
            front,
            back,
            difficulty: 2,
            source: filename,
            tags: [currentTopic, "pdf"],
          });
          i++;
          continue;
        }
      }
    }

    i++;
  }

  return items;
}

function shuffleWithCorrect(correct: string, _others: string[]): string[] {
  const pool = ["Safahat", "Kuyucaklı Yusuf", "Çalıkuşu", "Hükümsüz", "Yaban", "İnce Memed", "Araba Sevdası", "Mai ve Siyah"];
  const distractors = pool.filter((p) => p !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
  return [...distractors, correct].sort(() => Math.random() - 0.5);
}
