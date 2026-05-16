import { Notice } from "obsidian";
import { FountainView } from "../views/fountain_view";
import { FountainScript } from "../fountain/script";
import type { Edit } from "../fountain";
import { ICompatibilityAdapter } from "./types";

export class FountainAdapter implements ICompatibilityAdapter {
  
  processAST(script: FountainScript): void {
    // Pure Fountain mode does not post-process the AST.
  }

  initializeMetadataBlock(view: FountainView, initialData?: any): void {
    // Fountain doesn't use JSON metadata blocks.
  }

  addSnippet(view: FountainView, textToStore: string, overrideTitle?: string): void {
    const script = view.getScript();
    if ("error" in script) return;

    const currentStruct = script.structure();
    const title = (overrideTitle || textToStore).split("\n")[0].slice(0, 40).trim();
    const snippetText = `### ${title}\n${textToStore}\n\n`;
    
    if (currentStruct.snippetsHeaderRange) {
      // Block exists: Append new snippet to the very end of the file
      view.replaceText({ start: script.document.length, end: script.document.length }, snippetText);
    } else {
      // Block doesn't exist: Create with ONE separator and append to EOF
      const fullBlock = `\n\n===\n\n# Snippets\n\n${snippetText}`;
      view.replaceText({ start: script.document.length, end: script.document.length }, fullBlock);
    }
  }

  deleteSnippet(view: FountainView, snippet: any): void {
    view.replaceText(snippet.range, "");
  }

  renameSnippet(view: FountainView, snippet: any, newTitle: string): void {
    const script = view.getScript();
    if ("error" in script) return;

    const content = script.document.slice(snippet.range.start, snippet.range.end);
    const newContent = content.replace(/^###\s+.*$/m, `### ${newTitle}`);
    view.replaceText(snippet.range, newContent);
  }

  scrubProprietaryTags(script: FountainScript): Edit[] {
    return [];
  }
}
