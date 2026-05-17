import { App } from "obsidian";
import { FountainView } from "../views/fountain_view";
import { FountainScript } from "../fountain/script";
import type { Edit, Range, Snippet } from "../fountain";

export interface ICompatibilityAdapter {
  /**
   * Post-processes the standard Fountain AST to apply proprietary logic
   * (e.g., extracting Beat colors, markers).
   */
  processAST(script: FountainScript): void;

  /**
   * Initializes the appropriate metadata block if it doesn't exist.
   */
  initializeMetadataBlock(view: FountainView, initialData?: any): void;

  /**
   * Appends a new snippet.
   */
  addSnippet(view: FountainView, textToStore: string, overrideTitle?: string): void;

  /**
   * Deletes a snippet.
   */
  deleteSnippet(view: FountainView, snippet: any): void;

  /**
   * Renames a snippet.
   */
  renameSnippet(view: FountainView, snippet: any, newTitle: string): void;

  /**
   * Permanently scrubs proprietary tags from the document when converting to another format.
   * Returns an array of Edits to be applied.
   */
  scrubProprietaryTags(script: FountainScript): Edit[];

  /**
   * Identifies whether a given block content should be excluded from the general boneyard list.
   */
  shouldExcludeFromBoneyard(content: string): boolean;

  /**
   * Scans the script for compatibility metadata comments to separate them.
   */
  getCompatibilityMetadataRanges(script: FountainScript): Range[];

  /**
   * Parses snippets defined inside custom compatibility formats (like Beat's JSON block).
   */
  parseCompatibilitySnippets(script: FountainScript, metadataRanges: Range[]): Snippet[];
}
