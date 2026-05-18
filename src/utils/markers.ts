import { isSupportedColor } from "./colors";
import type { Note } from "../fountain/types";

export interface ParsedMarker {
  isMarker: boolean;
  color?: string;       // e.g., "cyan", "red", etc.
  text: string;         // The remaining descriptive text inside the marker
  markerWord: string;   // The text to show on the badge, e.g. "MARKER" or the custom word from @word
}

/**
 * Formats a marker note tag following the Beat screenplay standard.
 * Adheres strictly to the four variations described in docs/design/markers.md:
 * - [[marker]]
 * - [[marker <text>]]
 * - [[marker <color>]]
 * - [[marker <color> <text>]]
 *
 * @param color Optional supported CSS color (e.g., 'cyan', 'red')
 * @param text Optional descriptive marker text
 * @returns The formatted marker string
 */
export function formatMarkerTag(color?: string, text?: string): string {
  const parts = ["marker"];
  
  if (color) {
    parts.push(color.toLowerCase());
  }
  
  if (text) {
    // Trim descriptive text
    const trimmedText = text.trim();
    if (trimmedText) {
      parts.push(trimmedText);
    }
  }
  
  return `[[${parts.join(" ")}]]`;
}

/**
 * Parses any note tag (Beat standard or legacy @marker) to extract marker properties.
 * 
 * @param note The Note element from the AST
 * @param docText The complete screenplay source document
 * @returns The parsed marker details
 */
export function parseMarker(note: Note, docText: string): ParsedMarker {
  const noteKind = note.noteKind || "";
  
  // 1. Legacy/margin @marker syntax
  if (noteKind.startsWith("@")) {
    const word = noteKind.substring(1).trim() || "marker";
    const text = docText.slice(note.textRange.start, note.textRange.end).trim();
    return {
      isMarker: true,
      text,
      markerWord: word.toUpperCase(),
    };
  }

  // 2. New Beat-compatible marker syntax
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

