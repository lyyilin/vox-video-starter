import type { Caption } from "@remotion/captions";

type TimedChar = {
  char: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
};

const normalizeChar = (char: string): string =>
  /[\p{L}\p{N}]/u.test(char) ? char.toLocaleLowerCase() : "";

export const lcsPairs = (a: string[], b: string[]): [number, number][] => {
  const table = Array.from({ length: a.length + 1 }, () =>
    new Uint16Array(b.length + 1),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      table[i][j] =
        a[i - 1] === b[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  const pairs: [number, number][] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return pairs.reverse();
};

const whisperChars = (captions: Caption[]): TimedChar[] =>
  captions.flatMap((caption) => {
    const chars = [...caption.text].filter((char) => normalizeChar(char));
    const duration = Math.max(1, caption.endMs - caption.startMs);
    return chars.map((char, index) => ({
      char,
      startMs: caption.startMs + (duration * index) / chars.length,
      endMs: caption.startMs + (duration * (index + 1)) / chars.length,
      confidence: caption.confidence,
    }));
  });

export const countWhisperCharacters = (captions: Caption[]): number =>
  whisperChars(captions).length;

export const countScriptCharacters = (script: string): number =>
  [...script].filter((char) => normalizeChar(char)).length;

export const alignToScript = (
  script: string,
  rawCaptions: Caption[],
  durationMs: number,
): { captions: Caption[]; unmatchedRatio: number } => {
  const originalSignificant = [...script]
    .map((char, rawIndex) => ({ char, rawIndex, normalized: normalizeChar(char) }))
    .filter((entry) => entry.normalized);
  const recognized = whisperChars(rawCaptions);
  const pairs = lcsPairs(
    originalSignificant.map((entry) => entry.normalized),
    recognized.map((entry) => normalizeChar(entry.char)),
  );
  const timeByRawIndex = new Map<number, TimedChar>();
  for (const [originalIndex, recognizedIndex] of pairs) {
    timeByRawIndex.set(
      originalSignificant[originalIndex].rawIndex,
      recognized[recognizedIndex],
    );
  }

  const rawChars = [...script];
  const points = rawChars.map((_, rawIndex) => {
    const exact = timeByRawIndex.get(rawIndex);
    if (exact) {
      return exact.startMs;
    }

    let previous: { index: number; time: number } | null = null;
    let next: { index: number; time: number } | null = null;
    for (let i = rawIndex - 1; i >= 0; i--) {
      const match = timeByRawIndex.get(i);
      if (match) {
        previous = { index: i, time: match.endMs };
        break;
      }
    }
    for (let i = rawIndex + 1; i < rawChars.length; i++) {
      const match = timeByRawIndex.get(i);
      if (match) {
        next = { index: i, time: match.startMs };
        break;
      }
    }
    if (previous && next) {
      const progress =
        (rawIndex - previous.index) / (next.index - previous.index);
      return previous.time + (next.time - previous.time) * progress;
    }
    if (previous) {
      return Math.min(
        durationMs - 80,
        previous.time + (rawIndex - previous.index) * 90,
      );
    }
    if (next) {
      return Math.max(0, next.time - (next.index - rawIndex) * 90);
    }
    return (durationMs * rawIndex) / Math.max(1, rawChars.length);
  });

  for (let index = 1; index < points.length; index++) {
    points[index] = Math.max(points[index], points[index - 1] + 12);
  }

  const captions: Caption[] = rawChars.map((char, index) => {
    const startMs = Math.max(0, Math.round(points[index]));
    const nextPoint = points[index + 1] ?? Math.min(durationMs, startMs + 140);
    const endMs = Math.max(startMs + 12, Math.round(nextPoint));
    const exact = timeByRawIndex.get(index);
    return {
      text: char,
      startMs,
      endMs,
      timestampMs: startMs,
      confidence: exact?.confidence ?? null,
    };
  });

  return {
    captions,
    unmatchedRatio:
      originalSignificant.length === 0
        ? 0
        : 1 - pairs.length / originalSignificant.length,
  };
};

