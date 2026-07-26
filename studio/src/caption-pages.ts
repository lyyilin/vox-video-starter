import type { Caption, TikTokPage } from "@remotion/captions";
import { createTikTokStyleCaptions } from "@remotion/captions";

const characterCount = (text: string): number => Array.from(text).length;
const phraseEnding = /[，。；！？!?]/u;

export const createChineseCaptionPages = ({
  captions,
  maxCharsPerPage,
  combineWithinMs,
}: {
  captions: Caption[];
  maxCharsPerPage: number;
  combineWithinMs: number;
}): TikTokPage[] => {
  const groups: Caption[][] = [];
  let current: Caption[] = [];
  let currentChars = 0;
  const preferredBreakAt = Math.max(4, Math.floor(maxCharsPerPage * 0.55));

  for (const caption of captions) {
    current.push(caption);
    currentChars += characterCount(caption.text);

    const shouldBreak =
      currentChars >= maxCharsPerPage ||
      (currentChars >= preferredBreakAt && phraseEnding.test(caption.text));
    if (shouldBreak) {
      groups.push(current);
      current = [];
      currentChars = 0;
    }
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups.flatMap(
    (group) =>
      createTikTokStyleCaptions({
        captions: group,
        combineTokensWithinMilliseconds: combineWithinMs,
      }).pages,
  );
};
