import { App, Notice } from "obsidian";
import { FountainView } from "../views/fountain_view";
import { EditorViewState } from "../views/editor_view_state";
import { BeatAdapter } from "../compatibility/beat/beat_adapter";
import { FountainAdapter } from "../compatibility/fountain/fountain_adapter";
import { ICompatibilityAdapter } from "../compatibility/types";
import { Logger } from "../utils/logger";

export function getCompatibilityAdapter(): ICompatibilityAdapter {
  return new FountainAdapter();
}

/**
 * Moves the selection to the snippets library using the active adapter.
 */
export async function moveSelectionToSnippets(
  view: FountainView,
  cut: boolean,
  overrideText?: string
) {
  if (!(view.state instanceof EditorViewState)) {
    new Notice("Snippet commands only work in Edit mode.");
    return;
  }

  const selection = view.state.getSelection();
  const textToStore = overrideText !== undefined ? overrideText : selection?.text;

  if (!textToStore) {
    new Notice("No text selected.");
    return;
  }

  const adapter = new FountainAdapter();

  adapter.addSnippet(view, textToStore);

  if (cut && selection) {
    view.replaceText({ start: selection.from, end: selection.to }, "");
  }

  view.focusEditor();
  new Notice("Moved to Snippets library");
}



import type { Edit } from "../fountain";

export async function convertDocumentFormat(view: FountainView, targetStyle: "fountain" | "beat") {
  Logger.info("FormatCommands", `Starting conversion to ${targetStyle} format...`);

  const blurTrace = () => {
    Logger.debug("FormatCommands", "Window BLUR detected!");
    Logger.debug("FormatCommands", `Active element at blur: ${document.activeElement?.tagName} (${(document.activeElement as any)?.className})`);
  };
  window.addEventListener("blur", blurTrace, { once: true });

  const script = view.getScript();
  if ("error" in script) {
    Logger.error("FormatCommands", "Cannot convert, script parsing error", script.error);
    return;
  }

  const edits: Edit[] = [];
  const beatAdapter = new BeatAdapter();

  if (targetStyle === "beat") {
    const beatEdits = beatAdapter.convertToBeatFormat(script);
    edits.push(...beatEdits);
  } else {
    const standardEdits = beatAdapter.convertToStandardFormat(script);
    edits.push(...standardEdits);
  }

    // Defer past the Command Palette close. The palette closes synchronously
    // before this async body resumes. On Windows/Electron, that close event
    // causes a brief OS-level window blur before the editor can reclaim focus.
    // Awaiting one animation frame yields to the browser event loop so
    // Obsidian's natural palette-close focus restoration runs first — the
    // editor already holds OS focus by the time we dispatch CM changes.
    Logger.debug("FormatCommands", "Awaiting rAF to let palette-close focus restoration complete...");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    Logger.debug("FormatCommands", `rAF resume. document.hasFocus()=${document.hasFocus()}, activeElement=${document.activeElement?.tagName} (${(document.activeElement as any)?.className})`);

    const startTime = performance.now();
    if (edits.length > 0) {
      Logger.debug("FormatCommands", `Applying ${edits.length} edits...`);
      await view.applyEditsToFile(edits);
    }

    // Immediate rAF re-focus right after edits are dispatched to CM,
    // before the existing 500ms safety-net timeout fires.
    requestAnimationFrame(() => {
      Logger.debug("FormatCommands", `Post-edit rAF focus. hasFocus=${document.hasFocus()}`);
      view.focusEditor();
    });

    if (view.state instanceof EditorViewState) {
      view.state.trackFocusTime(startTime);
    }

    setTimeout(() => {
      Logger.debug("FormatCommands", `Final focus check. Active View: ${view.app.workspace.getActiveViewOfType(FountainView)?.file?.path === view.file?.path}`);
      requestAnimationFrame(() => {
        view.focusEditor();
        Logger.debug("FormatCommands", "Final focus attempt complete (via rAF).");
      });
    }, 500);

    Logger.info("FormatCommands", `Conversion to ${targetStyle} format complete.`);
    window.removeEventListener("blur", blurTrace);
}
