import { Notice } from "obsidian";
import { FountainScript } from "../fountain/script";
import type { Edit } from "../fountain";
import { ICompatibilityAdapter } from "./types";

export class FountainAdapter implements ICompatibilityAdapter {
  
  processAST(script: FountainScript): void {
    // Pure Fountain mode does not post-process the AST to extract proprietary tags.
    // Standard fountain tags (like regular # sections or == highlights if enabled)
    // are natively supported by the core parser, so nothing is done here.
  }

  initializeMetadataBlock(view: FountainView, initialData?: any): void {
    // Fountain doesn't use JSON metadata blocks
  }

  addSnippet(view: FountainView, textToStore: string, overrideTitle?: string): void {
    const script = view.getScript();
    if ("error" in script) return;

    const currentStruct = script.structure();
    const title = (overrideTitle || textToStore).split("\n")[0].slice(0, 40).trim();
    const snippetText = `### ${title}\n${textToStore}\n\n===\n`;
    
    // Find snippets section
    const snippetsSection = currentStruct.sections.find(s => 
      s.section && script.document.slice(s.section.range.start, s.section.range.end).toLowerCase().includes("snippets")
    );

    if (snippetsSection) {
      view.replaceText({ start: snippetsSection.range.end, end: snippetsSection.range.end }, `\n${snippetText}`);
    } else {
      view.replaceText(
        { start: script.document.length, end: script.document.length }, 
        `\n\n# Snippets\n\n${snippetText}`
      );
    }
  }

  deleteSnippet(view: FountainView, snippet: any): void {
    view.replaceText(snippet.range, "");
  }

  renameSnippet(view: FountainView, snippet: any, newTitle: string): void {
    // Basic Markdown section rename (assumes the snippet starts with `### title`)
    const script = view.getScript();
    if ("error" in script) return;

    const content = script.document.slice(snippet.range.start, snippet.range.end);
    const newContent = content.replace(/^###\s+.*$/m, `### ${newTitle}`);
    view.replaceText(snippet.range, newContent);
  }

  scrubProprietaryTags(script: FountainScript): Edit[] {
    // Pure fountain doesn't have proprietary tags to scrub
    return [];
  }
}
