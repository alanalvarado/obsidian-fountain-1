import { isSupportedColor } from "./colors";
import type { Note } from "../../types";

export interface ParsedBeatMarker {
  isMarker: boolean;
  color?: string;       // e.g., "cyan", "red", etc.
  text: string;         // The remaining descriptive text inside the marker
  markerWord: string;   // The text to show on the badge, e.g. "MARKER"
}

/**
 * Formats a marker note tag following the Beat screenplay standard.
 */
export function formatBeatMarkerTag(color?: string, text?: string): string {
  const parts = ["marker"];
  
  if (color) {
    parts.push(color.toLowerCase());
  }
  
  if (text) {
    const trimmedText = text.trim();
    if (trimmedText) {
      parts.push(trimmedText);
    }
  }
  
  return `[[${parts.join(" ")}]]`;
}

/**
 * Parses Beat-compatible marker syntax [[marker <color> <text>]].
 */
export function parseBeatMarker(note: Note, docText: string): ParsedBeatMarker {
  const noteKind = note.noteKind || "";
  if (noteKind.startsWith("@")) {
    return {
      isMarker: false,
      text: "",
      markerWord: "",
    };
  }

  const text = docText.slice(note.textRange.start, note.textRange.end).trim();
  const match = text.match(/^marker(?:\s+(.*))?$/i);
  if (match) {
    const remainder = match[1] ? match[1].trim() : "";
    
    // Check if the first word of the remainder is a supported color
    const parts = remainder.split(/\s+/);
    const firstWord = parts[0];
    if (firstWord && isSupportedColor(firstWord)) {
      const color = firstWord.toLowerCase();
      const descriptiveText = remainder.substring(firstWord.length).trim();
      return {
        isMarker: true,
        color,
        text: descriptiveText,
        markerWord: "MARKER",
      };
    }

    // Not a colored marker, but has descriptive text
    return {
      isMarker: true,
      text: remainder,
      markerWord: "MARKER",
    };
  }

  return {
    isMarker: false,
    text: "",
    markerWord: "",
  };
}

