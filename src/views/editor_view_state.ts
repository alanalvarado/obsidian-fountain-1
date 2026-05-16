import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { foldGutter, foldKeymap } from "@codemirror/language";
import {
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
} from "@codemirror/search";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  EditorView,
  type ViewUpdate,
  drawSelection,
  keymap,
} from "@codemirror/view";
import { createCharacterCompletion } from "../codemirror/character_completion";
import { createFountainEditorPlugin } from "../codemirror/editor";
import { createFountainFoldService } from "../codemirror/folding";
import type { LinkCompletionCandidate } from "../codemirror/link_completion";
import { fountainScriptField } from "../codemirror/state";
import type { Edit, FountainScript, Range } from "../fountain";
import { findSceneAtOffset } from "../fountain";
import { Logger } from "../logger";
import type { ViewState } from "./view_state";

export type EditorCallbacks = {
  onScriptChanged: (script: FountainScript) => void;
  requestSave: () => void;
  /** Optional source of link completion candidates triggered on `[[>`. */
  getLinkCandidates?: () => LinkCompletionCandidate[];
};

/// Returns the first scrollable element starting at the current element up to the DOM tree.
function firstScrollableElement(node: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = node;
  while (current !== null) {
    if (current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentNode as HTMLElement;
  }
  return (document.scrollingElement as HTMLElement) || document.documentElement;
}

/** Wraps a CodeMirror editor for editing fountain script source text. */
export class EditorViewState implements ViewState {
  readonly isEditMode = true;
  private cmEditor: EditorView;
  private path: string;
  /** True while a sync-driven dispatch is in flight, so the update listener
   *  knows to skip `onScriptChanged` / `requestSave` and avoid re-propagating
   *  an edit that has already been distributed by the parent FountainView. */
  private syncing = false;
  private cachedScript?: FountainScript;
  private instanceId = Math.random().toString(36).substring(7);

  constructor(
    contentEl: HTMLElement,
    path: string,
    text: string,
    private callbacks: EditorCallbacks,
    spellCheckEnabled: boolean,
  ) {
    Logger.debug("EditorViewState", `[${this.instanceId}] Initializing for ${path}...`);
    contentEl.empty();
    const editorContainer = contentEl.createDiv("custom-editor-component");
    editorContainer.tabIndex = -1;

    // our screenplay sets some of the styling information
    // before the code mirror overrides them. And instead of
    // messing with !important in the css, we force the theme
    // to take the values from higher up.
    const theme = EditorView.theme({
      "&": {
        fontSize: "12pt",
        height: "100%",
      },
      ".cm-content": {
        fontFamily: "inherit",
        lineHeight: "inherit",
      },
      ".cm-scroller": {
        fontFamily: "inherit",
        lineHeight: "inherit",
        minHeight: "100%",
      },
    });
    const state = EditorState.create({
      doc: text,
      extensions: [
        theme,
        fountainScriptField,
        history(),
        drawSelection(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, ...searchKeymap]),
        search(),
        highlightSelectionMatches(),
        EditorView.editorAttributes.of({ class: "screenplay" }),
        EditorView.lineWrapping,
        foldGutter(),
        createFountainFoldService(),
        createFountainEditorPlugin(),
        createCharacterCompletion(
          () => this.cmEditor.state.field(fountainScriptField),
          callbacks.getLinkCandidates,
        ),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged && !this.syncing) {
            callbacks.onScriptChanged(
              update.state.field(fountainScriptField),
            );
            callbacks.requestSave();
          }
        }),
      ],
    });
    this.path = path;
    this.cmEditor = new EditorView({
      state: state,
      parent: editorContainer,
    });

    // Ensure that clicking anywhere in the container focuses the editor.
    // This handles cases where the editor might not fill the entire area
    // (e.g. empty documents) and prevents the cursor from disappearing.
    editorContainer.addEventListener("click", (evt) => {
      if (evt.target === editorContainer) {
        this.cmEditor.focus();
      }
    });

    this.cmEditor.contentDOM.spellcheck = spellCheckEnabled;

    // Auto-focus on creation to prevent "phantom" cursor issues
    this.cmEditor.focus();
    Logger.debug("EditorViewState", `[${this.instanceId}] initialized and focused.`);
    // console.trace("Fountain: EditorViewState constructor stack trace");
  }

  receiveEdits(edits: Edit[], _newScript: FountainScript): void {
    if (edits.length === 0) return;
    const changes = [...edits]
      .sort((a, b) => a.range.start - b.range.start)
      .map((e) => ({
        from: e.range.start,
        to: e.range.end,
        insert: e.replacement,
      }));

    const wasFocused = this.cmEditor.hasFocus;
    this.syncing = true;
    try {
      Logger.debug("EditorViewState", `[${this.instanceId}] Dispatching ${changes.length} CM changes to editor... (Focused: ${wasFocused}, Selection: ${this.cmEditor.state.selection.main.head})`);
      this.cmEditor.dispatch({ changes });
      Logger.debug("EditorViewState", `[${this.instanceId}] CM changes dispatched successfully. Selection now: ${this.cmEditor.state.selection.main.head}`);
      if (wasFocused) {
        this.cmEditor.focus();
      }
    } catch (e) {
      Logger.error("EditorViewState", `[${this.instanceId}] CRASH during CM dispatch`, e);
    } finally {
      this.syncing = false;
    }

    // Belt-and-suspenders: if a residual palette-close blur slipped through
    // despite the rAF deferral in format_commands.ts, reclaim focus in the
    // very next animation frame (~16ms) before the polling loop kicks in.
    if (wasFocused) {
      requestAnimationFrame(() => {
        if (!this.cmEditor.hasFocus) {
          Logger.debug("EditorViewState", `[${this.instanceId}] receiveEdits: rAF focus recovery triggered.`);
          this.cmEditor.focus();
        }
      });
    }
  }

  receiveScript(newScript: FountainScript): void {
    Logger.debug("EditorViewState", `[${this.instanceId}] receiveScript (full-doc replace). Focused: ${this.cmEditor.hasFocus}`);
    this.cachedScript = newScript;
    this.syncing = true;
    try {
      this.cmEditor.dispatch({
        changes: {
          from: 0,
          to: this.cmEditor.state.doc.length,
          insert: newScript.document,
        },
      });
      Logger.debug("EditorViewState", `[${this.instanceId}] receiveScript dispatch success.`);
      // Always try to keep focus if we are in this state
      this.cmEditor.focus();
    } catch (e) {
      Logger.error("EditorViewState", `[${this.instanceId}] CRASH during receiveScript dispatch`, e);
    } finally {
      this.syncing = false;
    }
  }

  setPath(path: string): void {
    this.path = path;
  }

  getViewData(): string {
    return this.cmEditor.state.doc.toString();
  }

  clear(): void { }

  destroy(): void {
    this.cmEditor.destroy();
  }

  hasSelection(): boolean {
    const selection = this.cmEditor.state.selection.main;
    return !selection.empty;
  }

  getSelection(): { from: number; to: number; text: string } | null {
    const selection = this.cmEditor.state.selection.main;
    if (selection.empty) return null;
    return {
      from: selection.from,
      to: selection.to,
      text: this.cmEditor.state.doc.sliceString(selection.from, selection.to),
    };
  }

  dispatchChanges(changes: { from: number; to: number; insert: string }): void {
    this.cmEditor.dispatch({ changes });
  }

  getDocText(): string {
    return this.cmEditor.state.doc.toString();
  }

  scrollToHere(r: Range): void {
    this.cmEditor.dispatch({
      // scroll the view
      effects: EditorView.scrollIntoView(r.start, {
        y: "start",
        yMargin: 50,
      }),
      // select the text range
      selection: EditorSelection.range(r.start, r.end),
    });
    this.cmEditor.focus();
  }

  /** Align `r.start` to the top of the viewport without margin or selection
   *  changes. Used by the edit↔readonly toggle to restore scroll position:
   *  `scrollToHere`'s 50px ergonomic margin would push the target down on
   *  every readonly→editor leg, drifting the view upward across toggles. */
  scrollLineToTop(r: Range): void {
    this.cmEditor.dispatch({
      effects: EditorView.scrollIntoView(r.start, { y: "start", yMargin: 0 }),
    });
  }

  focus(silent = false): void {
    const el = this.cmEditor.contentDOM;
    if (!silent) Logger.debug("EditorViewState", `[${this.instanceId}] focus() called. Window hasFocus: ${document.hasFocus()}, DOM attached: ${this.cmEditor.dom.isConnected}, visible: ${this.cmEditor.dom.offsetParent !== null}, activeElement: ${document.activeElement?.tagName} (id: ${document.activeElement?.id}, class: ${document.activeElement?.className})`);

    if (!document.hasFocus()) {
      if (!silent) Logger.debug("EditorViewState", `[${this.instanceId}] Window lost focus! Attempting window.focus()...`);
      window.focus();
    }

    this.cmEditor.focus();
    if (!this.cmEditor.hasFocus) {
      if (!silent) {
        Logger.debug("EditorViewState", `[${this.instanceId}] CM focus() failed. ActiveElement: ${document.activeElement?.tagName} (${(document.activeElement as any)?.className}). Window focused: ${document.hasFocus()}`);
        Logger.debug("EditorViewState", `[${this.instanceId}] trying contentDOM.focus() and manual FocusEvent...`);
      }
      el.focus();
      el.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    }

    if (!silent) Logger.debug("EditorViewState", `[${this.instanceId}] focus() finished. hasFocus now: ${this.cmEditor.hasFocus}, activeElement now: ${document.activeElement?.tagName} (id: ${document.activeElement?.id}, class: ${document.activeElement?.className})`);
  }

  setSpellCheck(enabled: boolean): void {
    this.cmEditor.contentDOM.spellcheck = enabled;
  }

  openSearch(): void {
    openSearchPanel(this.cmEditor);
  }

  blackoutCharacter(): string | null {
    return null;
  }

  spotlightCharacter(): string | null {
    return null;
  }
  trackFocusTime(startTime: number): void {
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (this.cmEditor.hasFocus) {
        const duration = performance.now() - startTime;
        Logger.debug("EditorViewState", `[${this.instanceId}] FOCUS REGAINED after ${duration.toFixed(2)}ms (${attempts} checks)`);
        clearInterval(check);
      } else {
        // Every 2 checks (100ms), try to force focus again (SILENTLY)
        if (attempts % 2 === 0) {
          this.focus(true);
        }
        if (attempts % 20 === 0) {
          Logger.debug("EditorViewState", `[${this.instanceId}] Still waiting for focus... (Attempt ${attempts})`);
        }
      }
    }, 50);
    setTimeout(() => clearInterval(check), 60000);
  }

  render(): void {
    Logger.debug("EditorViewState", `[${this.instanceId}] render called (focusing)`);
    this.cmEditor.focus();
  }

  rangeOfFirstVisibleLine(): Range | null {
    const view = this.cmEditor;
    const viewport = view.viewport;
    const scroller = firstScrollableElement(view.scrollDOM) ?? view.scrollDOM;

    const scrollerRect = scroller.getBoundingClientRect();
    const topThreshold = scrollerRect.top;


    for (let i = viewport.from; i < viewport.to;) {
      const line = view.lineBlockAt(i);
      const lineRect = view.coordsAtPos(line.from);
      // If the line's bottom is at or below the top of the scroller, it's the first visible line.
      if (lineRect && lineRect.bottom >= topThreshold) {
        return { start: line.from, end: line.to + 1 };
      }
      i = line.to + 1;
    }
    return null;
  }


  cursorOffset(): number {
    return this.cmEditor.state.selection.main.head;
  }

  selectCurrentScene(): void {
    const offset = this.cmEditor.state.selection.main.head;
    const script = this.cmEditor.state.field(fountainScriptField);
    const scene = findSceneAtOffset(script, offset);
    if (!scene) return;
    this.cmEditor.dispatch({
      selection: EditorSelection.range(scene.range.start, scene.range.end),
      effects: EditorView.scrollIntoView(scene.range.start, {
        y: "start",
        yMargin: 50,
      }),
    });
    this.cmEditor.focus();
  }
}
