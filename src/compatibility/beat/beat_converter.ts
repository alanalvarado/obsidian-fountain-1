import { FountainScript } from "../fountain/script";
import type { Edit } from "../fountain";
import { scrubBeatProprietaryTags, scrubBeatString } from "./beat_tag_scrubber";

export const BEAT_BOILERPLATE_START = "If you're seeing this, you can remove the following stuff - BEAT: ";
export const BEAT_BOILERPLATE_END = " END_BEAT";

/**
 * Converts a standard Fountain document (including its native `# Snippets` EOF block) 
 * into Beat compatibility format (with JSON metadata comment blocks at EOF).
 */
export function convertToBeatFormat(script: FountainScript): Edit[] {
  const edits: Edit[] = [];
  const struct = script.structure();
  const doc = script.document;

  // 1. Gather all standard, native snippets
  const standardSnippets = struct.snippets.filter(s => s.category !== "Beat JSON");
  const beatSnippets = standardSnippets.map((s, index) => {
    // Extract the raw text from the snippet's content or range
    let rawText = "";
    if (s.content && s.content.length > 0) {
      const contentRange = { 
        start: s.content[0].range.start, 
        end: s.content[s.content.length - 1].range.end 
      };
      rawText = doc.slice(contentRange.start, contentRange.end);
    } else {
      rawText = doc.slice(s.bodyRange.start, s.bodyRange.end);
    }

    return {
      title: s.title || `Snippet ${index + 1}`,
      text: rawText.trim(),
      color: "none"
    };
  });

  // 2. Scrub (delete) the standard native # Snippets block and its preceding divider
  if (struct.snippetsHeaderRange) {
    let startOfSnippetsBlock = struct.snippetsHeaderRange.start;
    let ptr = startOfSnippetsBlock - 1;
    
    // Eat trailing whitespace to search for pre-header page break
    while (ptr >= 0 && (doc[ptr] === ' ' || doc[ptr] === '\t' || doc[ptr] === '\n' || doc[ptr] === '\r')) {
      ptr--;
    }
    
    // If preceded by a Fountain page break "===", eat it too
    if (ptr >= 2 && doc[ptr] === '=' && doc[ptr - 1] === '=' && doc[ptr - 2] === '=') {
      ptr -= 3;
      while (ptr >= 0 && (doc[ptr] === ' ' || doc[ptr] === '\t' || doc[ptr] === '\n' || doc[ptr] === '\r')) {
        ptr--;
      }
    }
    startOfSnippetsBlock = ptr + 1;
    
    edits.push({ 
      range: { start: startOfSnippetsBlock, end: doc.length }, 
      replacement: "" 
    });
  }

  // 3. Assemble or update the Beat JSON block
  const existingMetadataRange = struct.beatMetadata;
  if (existingMetadataRange) {
    // If it already exists, parse and merge
    const content = doc.slice(existingMetadataRange.start, existingMetadataRange.end);
    const jsonMatch = content.match(/({[\s\S]*})/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        data.Snippets = [...(data.Snippets || []), ...beatSnippets];
        const newJson = JSON.stringify(data);
        const newComment = content.replace(jsonMatch[1], newJson);
        edits.push({ range: existingMetadataRange, replacement: newComment });
      } catch (e) {
        // Fallback: overwrite
        const blockData = { 
          "Caret Position": 0, 
          "Window Width": 1920, 
          "CharacterGenders": {}, 
          "Changed Indices": {},
          "Snippets": beatSnippets 
        };
        const newBlock = `\n\n/* ${BEAT_BOILERPLATE_START}${JSON.stringify(blockData)}${BEAT_BOILERPLATE_END} */`;
        edits.push({ range: existingMetadataRange, replacement: newBlock });
      }
    }
  } else {
    // Overwrite/Create a fresh block at EOF
    const blockData = { 
      "Caret Position": 0, 
      "Window Width": 1920, 
      "CharacterGenders": {}, 
      "Changed Indices": {},
      "Snippets": beatSnippets 
    };
    const newBlock = `\n\n/* ${BEAT_BOILERPLATE_START}${JSON.stringify(blockData)}${BEAT_BOILERPLATE_END} */`;
    edits.push({ 
      range: { start: doc.length, end: doc.length }, 
      replacement: newBlock 
    });
  }

  return edits;
}

/**
 * Converts a Beat document (scrubbing proprietary tags and comment blocks)
 * back into a standard Fountain document (extracting JSON snippets into a standard EOF `# Snippets` block).
 */
export function convertToStandardFormat(script: FountainScript): Edit[] {
  const edits: Edit[] = [];
  const struct = script.structure();
  const doc = script.document;

  // 1. Scrub all proprietary tags and comment metadata blocks
  const scrubEdits = scrubBeatProprietaryTags(script);
  edits.push(...scrubEdits);

  // 2. Extract any Beat JSON snippets
  const beatSnippets = struct.snippets.filter(s => s.category === "Beat JSON");
  if (beatSnippets.length > 0) {
    let combinedText = "";
    for (const s of beatSnippets) {
      const cleanTitle = scrubBeatString(s.title);
      const cleanText = scrubBeatString(s.text);
      // Format to follow new spec: individual snippets are separated purely by depth-3 headers
      combinedText += `\n\n### ${cleanTitle}\n${cleanText}`;
    }
    
    // A single pre-header divider === precedes the # Snippets header
    edits.push({ 
      range: { start: doc.length, end: doc.length }, 
      replacement: `\n\n===\n\n# Snippets${combinedText}\n` 
    });
  }

  return edits;
}
