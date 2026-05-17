import { FountainScript } from "../fountain/script";
import { SceneHeading, Section } from "../fountain/types";

export function processBeatAST(script: FountainScript): void {
  script.script.forEach(el => {
    if (el.kind === "scene") {
      extractBeatTags(el as SceneHeading);
    } else if (el.kind === "section") {
      extractBeatTags(el as Section);
    }
  });
}

function extractBeatTags(element: SceneHeading | Section) {
  const textProp = element.kind === "scene" ? "heading" : "text";
  let text = (element as any)[textProp] || "";

  // Extract [[COLOR <color>]] or [[<color>]] if it's a known color/hex
  const colorMatch = text.match(/\[\[(?:COLOR\s+)?([a-zA-Z]+|#[a-fA-F0-9]{3,6})\]\]/i);
  if (colorMatch) {
    element.color = colorMatch[1].toLowerCase();
    text = text.replace(colorMatch[0], "").trim();
  }

  // Extract [[marker <text>]]
  const markerMatch = text.match(/\[\[marker\s+(.*?)\]\]/i);
  if (markerMatch) {
    (element as any).marker = markerMatch[1].trim();
    text = text.replace(markerMatch[0], "").trim();
  }

  // Extract any remaining [[ <text> ]] as synopsis
  const sinopsisMatch = text.match(/\[\[(.*?)\]\]/);
  if (sinopsisMatch) {
    (element as any).sinopsis = sinopsisMatch[1].trim();
    text = text.replace(sinopsisMatch[0], "").trim();
  }

  (element as any)[textProp] = text;
}
