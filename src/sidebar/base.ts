import { App } from "obsidian";
import type { FountainScript, Range } from "../fountain";
import type { FountainView } from "../views/fountain_view";
import type { HoverPreviewManager } from "./hover_preview";

export interface SidebarCallbacks {
  scrollToRange: (range: Range) => void;
  getText: (range: Range) => string;
  readFromFile: (path: string, range: Range) => Promise<string | null>;
  insertAfterSnippetsHeader: (text: string) => void;
  toggleSpotlight: (character: string) => void;
  getSpotlightCharacter: () => string | null;
  moveSceneAcross: (args: {
    srcPath: string;
    srcRange: Range;
    dstPath: string;
    dstPos: number;
  }) => void;
  reRender: () => void;
  requestSave: () => void;
  replaceText: (range: Range, replacement: string) => void;
  insertTextAtCursor: (text: string) => void;
  getScript: () => FountainScript;
  app: App;
  focusEditor: () => void;
  getView: () => FountainView | null;
  hoverPreview: HoverPreviewManager;
  /** Open a character profile note. */
  openCharacterNote: (name: string, event: MouseEvent) => void;
  /** Check if a character has an associated profile note. */
  hasCharacterNote: (name: string) => boolean;
  /** Trigger global character rename. */
  renameCharacter: (name: string) => void;
}

export abstract class SidebarSection {
  protected callbacks: SidebarCallbacks;

  constructor(callbacks: SidebarCallbacks) {
    this.callbacks = callbacks;
  }

  abstract render(
    container: HTMLElement,
    script: FountainScript,
    isEditMode: boolean,
    path: string,
  ): void;
}
