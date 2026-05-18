import type { Note } from "../types";
import { parseBeatMarker, formatBeatMarkerTag } from "./beat/markers";
import { parseReelMarker, formatReelMarkerTag } from "./reel/markers";

export interface ParsedMarker {
  isMarker: boolean;
  color?: string;
  text: string;
  markerWord: string;
}

/**
 * Parses any note tag to extract marker properties, delegating to the appropriate spec provider (Reel or Beat).
 */
export function parseMarker(note: Note, docText: string): ParsedMarker {
  const noteKind = note.noteKind || "";
  
  // 1. Reel native margin markers syntax (starts with @)
  if (noteKind.startsWith("@")) {
    return parseReelMarker(note, docText);
  }

  // 2. Beat compatible syntax (e.g. [[marker ...]])
  return parseBeatMarker(note, docText);
}

/**
 * Formats a marker note tag following either the Beat screenplay standard or Reel standard.
 */
export function formatMarkerTag(color?: string, text?: string): string {
  if (color) {
    const isBeatColor = [
      "cyan", "magenta", "yellow", "red", "green", "blue", "brown", 
      "gray", "orange", "purple", "pink"
    ].includes(color.toLowerCase());
    
    if (color.startsWith("@") || !isBeatColor) {
      return formatReelMarkerTag(color, text);
    }
  }
  return formatBeatMarkerTag(color, text);
}
