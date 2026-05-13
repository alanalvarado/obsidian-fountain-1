import type { FountainElement, ScriptMetrics } from "./types";

export function calculateMetrics(
  elements: FountainElement[],
  document: string,
): ScriptMetrics {
  let lines = 0;
  let wordCount = 0;
  let characterCount = 0;
  let dialogueLines = 0;
  let actionLines = 0;

  for (const el of elements) {
    const kind = (el as any).kind;
    switch (kind) {
      case "scene": {
        const heading = (el as any).heading || "";
        lines += 2;
        actionLines += 2;
        wordCount += heading.split(/\s+/).filter(Boolean).length;
        characterCount += heading.length;
        break;
      }

      case "action":
      case "lyrics": {
        const actionLinesList = (el as any).lines || [];
        for (const line of actionLinesList) {
          const text = document.slice(line.range.start, line.range.end);
          if (text.trim().length === 0) {
            lines += 1;
            actionLines += 1;
          } else {
            // Screenplay standard: Action wraps at ~60 chars
            // Centered text usually takes 1 line unless extremely long
            const wrapLimit = (line as any).centered ? 35 : 60;
            const wrapLines = Math.ceil(text.length / wrapLimit) || 1;
            lines += wrapLines;
            actionLines += wrapLines;
            wordCount += text.split(/\s+/).filter(Boolean).length;
            characterCount += text.length;
          }
        }
        break;
      }

      case "dialogue": {
        const charRange = (el as any).characterRange;
        // Character name line
        lines += 1;
        dialogueLines += 1;
        if (charRange) {
          const charName = document.slice(charRange.start, charRange.end);
          wordCount += charName.split(/\s+/).filter(Boolean).length;
          characterCount += charName.length;
        }

        const dialogueContent = (el as any).content || [];
        for (const c of dialogueContent) {
          if (c.kind === "parenthetical") {
            lines += 1;
            dialogueLines += 1;
            const text = document.slice(c.range.start, c.range.end);
            wordCount += text.split(/\s+/).filter(Boolean).length;
            characterCount += text.length;
          } else {
            const text = document.slice(c.line.range.start, c.line.range.end);
            // Screenplay standard: Dialogue wraps at ~35 chars
            const wrapLines = Math.ceil(text.length / 35) || 1;
            lines += wrapLines;
            dialogueLines += wrapLines;
            wordCount += text.split(/\s+/).filter(Boolean).length;
            characterCount += text.length;
          }
        }
        // Blank line after dialogue block
        lines += 1;
        dialogueLines += 1;
        break;
      }

      case "transition":
        lines += 1;
        actionLines += 1;
        const transText = document.slice(el.range.start, el.range.end);
        wordCount += transText.split(/\s+/).filter(Boolean).length;
        characterCount += transText.length;
        break;

      default:
        break;
    }
  }

  // 1 page = 55 lines (Standard Hollywood format)
  const pageCount = lines / 55;
  const totalWeight = dialogueLines + actionLines || 1;

  return {
    pageCount,
    wordCount,
    characterCount,
    durationSeconds: Math.round(pageCount * 60),
    dialoguePercent: Math.round((dialogueLines / totalWeight) * 100),
    actionPercent: Math.round((actionLines / totalWeight) * 100),
  };
}

/**
 * Formats a decimal page count into the standard Hollywood "Eighths" notation.
 * e.g. 1.125 -> "1 1/8", 0.5 -> "4/8"
 */
export function formatEighths(pages: number): string {
  const whole = Math.floor(pages);
  const fraction = pages - whole;
  const eighths = Math.round(fraction * 8);

  if (eighths === 0) return whole > 0 ? `${whole} pg` : "0 pg";
  if (eighths === 8) return `${whole + 1} pg`;
  
  const fractionStr = `${eighths}/8`;
  return whole > 0 ? `${whole} ${fractionStr} pg` : `${fractionStr} pg`;
}

/**
 * Formats duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
