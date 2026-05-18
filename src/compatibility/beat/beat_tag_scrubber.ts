import { FountainScript, Edit, SceneHeading, Section } from "../../fountain";
import { Logger } from "../../utils/logger";

export function scrubBeatProprietaryTags(script: FountainScript): Edit[] {
  Logger.debug("BeatTagScrubber", "Starting proprietary tag scrub...");
  const doc = script.document;
  const edits: Edit[] = [];
  const processedIndices = new Set<number>();

  // 1. Scrub the BEAT JSON metadata blocks entirely if they exist
  const struct = script.structure();
  if ((struct as any).beatMetadataRanges) {
    const ranges = (struct as any).beatMetadataRanges as { start: number; end: number }[];
    for (const r of ranges) {
      edits.push({ range: r, replacement: "" });
      for (let i = r.start; i < r.end; i++) processedIndices.add(i);
    }
  }

  // 2. Scrub [[...]] tags specifically on Scene Headings and Sections (Beat Synopses/Markers)
  const headings = script.script.filter(el => el.kind === "scene" || el.kind === "section") as (SceneHeading | Section)[];
  for (const h of headings) {
    const lineText = doc.slice(h.range.start, h.range.end);
    const tagMatches = Array.from(lineText.matchAll(/\[\[.*?\]\]/g));
    for (const match of tagMatches) {
      if (match.index !== undefined) {
        const start = h.range.start + match.index;
        if (processedIndices.has(start)) continue;

        const end = start + match[0].length;
        edits.push(createScrubEdit(doc, start, end));
        processedIndices.add(start);
      }
    }
  }

  // 3. Scrub COLOR, MARKER, or specific Beat color tags anywhere else in the document
  const proprietaryRegex = /\[\[(?:COLOR\b|marker\b|sinopsis\b|cyan|magenta|yellow|red|green|blue|brown|gray|orange|purple|pink|#[a-fA-F0-9]{3,6})(?:\s+.*?)?\]\]/ig;
  const globalMatches = Array.from(doc.matchAll(proprietaryRegex));
  for (const match of globalMatches) {
    if (match.index !== undefined) {
      const start = match.index;
      if (processedIndices.has(start)) continue;

      const end = start + match[0].length;
      edits.push(createScrubEdit(doc, start, end));
      processedIndices.add(start);
    }
  }

  return edits;
}

export function scrubBeatString(text: string): string {
  const proprietaryRegex = /\[\[(?:COLOR\b|marker\b|sinopsis\b|cyan|magenta|yellow|red|green|blue|brown|gray|orange|purple|pink|#[a-fA-F0-9]{3,6})(?:\s+.*?)?\]\]/ig;
  return text.replace(proprietaryRegex, "").trim();
}

function createScrubEdit(doc: string, start: number, end: number): Edit {
  let finalStart = start;
  let finalEnd = end;

  // Eat preceding spaces
  while (finalStart > 0 && doc[finalStart - 1] === ' ' && doc[finalStart - 1] !== '#' && doc[finalStart - 1] !== '\n') {
    finalStart--;
  }
  
  // If we're at the start of a line (or only spaces preceded us), check for a trailing newline
  const isStartOfLine = finalStart === 0 || doc[finalStart - 1] === '\n';
  
  // Eat trailing spaces
  while (finalEnd < doc.length && doc[finalEnd] === ' ' && doc[finalEnd] !== '\n') {
    finalEnd++;
  }

  const isEndOfLine = finalEnd === doc.length || doc[finalEnd] === '\n';

  // If the tag was the ONLY thing on the line, eat one newline too to avoid leaving an empty line
  if (isStartOfLine && isEndOfLine) {
    if (finalEnd < doc.length && doc[finalEnd] === '\n') {
      finalEnd++; // Eat the trailing newline
    } else if (finalStart > 0 && doc[finalStart - 1] === '\n') {
      finalStart--; // Eat the preceding newline if no trailing one
    }
  }

  return { range: { start: finalStart, end: finalEnd }, replacement: "" };
}
