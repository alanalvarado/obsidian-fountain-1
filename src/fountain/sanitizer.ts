import { FountainView } from "../views/fountain_view";
import { FountainScript } from "./script";
import { Range, Snippet } from "./types";

/**
 * World-class document sanitizer for Fountain snippets.
 * Consolidates all snippets into a single block at the EOF, 
 * resolving duplicates, interleaving, and stray content.
 */
export function sanitizeSnippets(view: FountainView): void {
  const script = view.getScript();
  if ("error" in script) return;

  const struct = script.structure();
  if (!struct.health.needsSanitization) return;

  const document = script.document;
  let newDocument = document;

  // 1. Collect all valid snippets and their content
  const allSnippets = struct.snippets.filter(s => s.category !== "Beat JSON"); // Only Fountain snippets
  
  // 2. Identify all elements that must be removed (Headers and Snippets)
  // We remove all snippets by their ranges and also the separators BEFORE headers
  const rangesToRemove: Range[] = [
    ...allSnippets.map(s => s.range)
  ];

  // Add headers AND any preceding PageBreak
  const headerIndices = struct.snippetsHeaderRanges; // These are actually indices now or ranges? 
  // Wait, I changed types.ts to use Range[]. 
  // Let me check what I passed in script.ts structure()
  
  for (const range of struct.snippetsHeaderRanges) {
    rangesToRemove.push(range);
    
    // Find the element in the script that matches this range to see its predecessor
    const idx = script.script.findIndex(fe => fe.range.start === range.start);
    if (idx > 0) {
        const prev = script.script[idx - 1];
        if (prev.kind === "page-break") {
            rangesToRemove.push(prev.range);
        }
    }
  }

  // Sort ranges in descending order so we can remove them without shifting indices
  rangesToRemove.sort((a, b) => b.start - a.start);

  for (const range of rangesToRemove) {
    newDocument = newDocument.slice(0, range.start) + newDocument.slice(range.end);
  }

  // 3. Clean up trailing whitespace from the main script
  newDocument = newDocument.trimEnd();

  // 4. Rebuild the clean Snippets block
  let snippetsBlock = "\n\n===\n\n# Snippets\n\n";
  
  // Group snippets by category
  const categories = Array.from(new Set(allSnippets.map(s => s.category).filter(c => c !== undefined)));
  
  // Category-less snippets first
  const noCategory = allSnippets.filter(s => !s.category);
  for (const s of noCategory) {
    snippetsBlock += `### ${s.title}\n${script.sliceDocument(s.range).replace(/^###\s+.*$/m, "").trim()}\n\n`;
  }

  // Categorized snippets
  for (const cat of categories) {
    snippetsBlock += `## ${cat}\n\n`;
    const inCat = allSnippets.filter(s => s.category === cat);
    for (const s of inCat) {
      snippetsBlock += `### ${s.title}\n${script.sliceDocument(s.range).replace(/^###\s+.*$/m, "").trim()}\n\n`;
    }
  }

  // 5. Atomic update
  view.replaceText({ start: 0, end: document.length }, newDocument + snippetsBlock);
}
