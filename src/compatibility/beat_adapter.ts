import { App, Notice } from "obsidian";
import { FountainScript } from "../fountain/script";
import type { Edit } from "../fountain";
import { ICompatibilityAdapter } from "./types";
import { SceneHeading, Section } from "../fountain/types";
import { Logger } from "../logger";

export const BEAT_BOILERPLATE_START = "If you're seeing this, you can remove the following stuff - BEAT: ";
export const BEAT_BOILERPLATE_END = " END_BEAT";

export class BeatAdapter implements ICompatibilityAdapter {
  
  processAST(script: FountainScript): void {
    // Traverse the AST and extract Beat proprietary tags
    script.script.forEach(el => {
      if (el.kind === "scene") {
        this.extractBeatTags(el as SceneHeading);
      } else if (el.kind === "section") {
        this.extractBeatTags(el as Section);
      }
    });
  }

  private extractBeatTags(element: SceneHeading | Section) {
    const textProp = element.kind === "scene" ? "heading" : "text";
    let text = (element as any)[textProp] || "";

    // Extract [[COLOR <color>]] or [[<color>]] if it's a known color/hex
    const colorMatch = text.match(/\[\[(?:COLOR\s+)?([a-zA-Z]+|#[a-fA-F0-9]{3,6})\]\]/i);
    if (colorMatch) {
      element.color = colorMatch[1].toLowerCase();
      text = text.replace(colorMatch[0], "").trim();
    }

    // Extract [[marker <text>]] or [[sinopsis]]
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

  initializeMetadataBlock(view: FountainView, initialData: any = {}): void {
    const script = view.getScript();
    if ("error" in script) return;

    const blockData = {
      "Caret Position": 0,
      "Window Width": 1920,
      "CharacterGenders": {},
      "Changed Indices": {},
      ...initialData
    };

    const newBlock = `\n\n/* ${BEAT_BOILERPLATE_START}${JSON.stringify(blockData)}${BEAT_BOILERPLATE_END} */`;
    view.replaceText({ start: script.document.length, end: script.document.length }, newBlock);
  }

  addSnippet(view: FountainView, textToStore: string, overrideTitle?: string): void {
    const script = view.getScript();
    if ("error" in script) return;

    const struct = script.structure();
    const metadataRange = struct.beatMetadata;

    const newSnippet = {
      title: (overrideTitle || textToStore).split("\n")[0].slice(0, 40).trim(),
      text: textToStore,
      color: "none"
    };

    if (metadataRange) {
      const content = script.document.slice(metadataRange.start, metadataRange.end);
      const jsonMatch = content.match(/({[\s\S]*})/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          if (!data.Snippets) data.Snippets = [];
          data.Snippets.push(newSnippet);
          
          const newJson = JSON.stringify(data);
          const newComment = content.replace(jsonMatch[1], newJson);
          view.replaceText(metadataRange, newComment);
        } catch (e) {
          Logger.error("BeatAdapter", "Error updating Beat metadata", e);
          new Notice("Error updating Beat metadata. Check console.");
        }
      }
    } else {
      this.initializeMetadataBlock(view, { Snippets: [newSnippet] });
    }
  }

  deleteSnippet(view: FountainView, snippet: any): void {
    const script = view.getScript();
    if ("error" in script) return;

    const struct = script.structure();
    const metadataRange = struct.beatMetadata;
    
    if (metadataRange) {
      const content = script.document.slice(metadataRange.start, metadataRange.end);
      const jsonMatch = content.match(/({[\s\S]*})/);
      
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          if (data.Snippets && snippet.index !== undefined) {
            data.Snippets.splice(snippet.index, 1);
            const newJson = JSON.stringify(data);
            const newComment = content.replace(jsonMatch[1], newJson);
            view.replaceText(metadataRange, newComment);
          }
        } catch (e) {
          Logger.error("BeatAdapter", "Error deleting Beat JSON snippet", e);
        }
      }
    }
  }

  renameSnippet(view: FountainView, snippet: any, newTitle: string): void {
    const script = view.getScript();
    if ("error" in script) return;

    const struct = script.structure();
    const metadataRange = struct.beatMetadata;
    
    if (metadataRange) {
      const content = script.document.slice(metadataRange.start, metadataRange.end);
      const jsonMatch = content.match(/({[\s\S]*})/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          if (data.Snippets && snippet.index !== undefined) {
            data.Snippets[snippet.index].title = newTitle;
            const newJson = JSON.stringify(data);
            const newComment = content.replace(jsonMatch[1], newJson);
            view.replaceText(metadataRange, newComment);
          }
        } catch (e) {
          Logger.error("BeatAdapter", "Error renaming Beat JSON snippet", e);
        }
      }
    }
  }

  scrubProprietaryTags(script: FountainScript): Edit[] {
    Logger.debug("BeatAdapter", "Starting refined proprietary tag scrub...");
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
    // In Beat, these are almost always proprietary when attached to headings.
    const headings = script.script.filter(el => el.kind === "scene" || el.kind === "section") as (SceneHeading | Section)[];
    for (const h of headings) {
      const lineText = doc.slice(h.range.start, h.range.end);
      const tagMatches = Array.from(lineText.matchAll(/\[\[.*?\]\]/g));
      for (const match of tagMatches) {
        if (match.index !== undefined) {
          const start = h.range.start + match.index;
          if (processedIndices.has(start)) continue;

          const end = start + match[0].length;
          edits.push(this.createScrubEdit(doc, start, end));
          processedIndices.add(start);
        }
      }
    }

    // 3. Scrub COLOR, MARKER, or specific Beat color tags anywhere else in the document
    // We use a more specific regex to avoid catching standard Fountain Notes [[ ]]
    // Common Beat colors: cyan, magenta, yellow, red, green, blue, brown, gray, orange, purple, pink
    const proprietaryRegex = /\[\[(?:COLOR\b|marker\b|sinopsis\b|cyan|magenta|yellow|red|green|blue|brown|gray|orange|purple|pink|#[a-fA-F0-9]{3,6})(?:\s+.*?)?\]\]/ig;
    const globalMatches = Array.from(doc.matchAll(proprietaryRegex));
    for (const match of globalMatches) {
      if (match.index !== undefined) {
        const start = match.index;
        if (processedIndices.has(start)) continue;

        const end = start + match[0].length;
        edits.push(this.createScrubEdit(doc, start, end));
        processedIndices.add(start);
      }
    }

    return edits;
  }

  /** Helper to scrub a string directly (useful for snippets) */
  scrubString(text: string): string {
    // 1. Specific proprietary tags
    const proprietaryRegex = /\[\[(?:COLOR\b|marker\b|sinopsis\b|cyan|magenta|yellow|red|green|blue|brown|gray|orange|purple|pink|#[a-fA-F0-9]{3,6})(?:\s+.*?)?\]\]/ig;
    let result = text.replace(proprietaryRegex, "");
    
    // 2. Note: We don't have AST for snippets here, so we have to be careful with generic [[...]].
    // For now, we'll just leave them unless they were explicitly Beat-formatted.
    return result.trim();
  }

  private createScrubEdit(doc: string, start: number, end: number): Edit {
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
}
