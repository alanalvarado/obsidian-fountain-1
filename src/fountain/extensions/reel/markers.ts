import type { Note } from "../../types";

export interface ParsedReelMarker {
  isMarker: boolean;
  color?: string;
  text: string;
  markerWord: string;   // The custom margin word, e.g. "MARKER" or custom word from @word
}

/**
 * Parses native Reel legacy margin notes starting with `@` (e.g. `[[@marker text]]`).
 */
export function parseReelMarker(note: Note, docText: string): ParsedReelMarker {
  const noteKind = note.noteKind || "";
  
  if (noteKind.startsWith("@")) {
    const word = noteKind.substring(1).trim() || "marker";
    const text = docText.slice(note.textRange.start, note.textRange.end).trim();
    return {
      isMarker: true,
      text,
      markerWord: word.toUpperCase(),
    };
  }

  return {
    isMarker: false,
    text: "",
    markerWord: "",
  };
}

/**
 * Formats a native Reel margin annotation note tag.
 */
export function formatReelMarkerTag(word: string, text?: string): string {
  const noteKind = word.startsWith("@") ? word : `@${word}`;
  return `[[${noteKind}${text ? ` ${text.trim()}` : "" }]]`;
}
