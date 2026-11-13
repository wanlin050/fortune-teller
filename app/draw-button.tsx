"use client";

import { useRef, useState } from "react";

const FORTUNES = [
  "上上签：紫气东来",
  "上签：贵人相助，诸事顺遂",
  "中签：稳中求进，勿急勿躁",
  "中平签：守成待变，自有转机",
  "下签：三思后行，切莫强求",
  "下下签：静待时机",
];

export default function DrawButton() {
  const [fortune, setFortune] = useState<string | null>(null);
  const [reading, setReading] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function draw() {
    if (streaming) return;

    const pool = FORTUNES.filter((item) => item !== fortune);
    const next = pool[Math.floor(Math.random() * pool.length)];

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFortune(next);
    setReading("");
    setError(null);
    setStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fortune: next }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const message = (await response.text()).trim();
        throw new Error(message || "解签失败，请稍后再试");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setReading(text);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "解签失败，请稍后再试");
    } finally {
      if (abortRef.current === controller) setStreaming(false);
    }
  }

  return (
    <div className="mt-10 flex w-full max-w-xl flex-col items-center gap-8">
      <button
        type="button"
        className="fortune-button disabled:cursor-wait disabled:opacity-70"
        onClick={draw}
        disabled={streaming}
      >
        {streaming ? "解签中…" : "抽取今日命签"}
      </button>
      {fortune ? <p className="fortune-text">{fortune}</p> : null}
      {fortune ? (
        <p className="reading-text" aria-live="polite">
          {reading || (streaming ? "老者正在抚须沉吟" : "")}
          {streaming ? <span className="reading-caret" /> : null}
        </p>
      ) : null}
      {error ? <p className="reading-error">{error}</p> : null}
    </div>
  );
}
