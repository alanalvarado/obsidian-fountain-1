import { App, Notice } from "obsidian";
import { FountainView } from "../views/fountain_view";
import { EditorViewState } from "../views/editor_view_state";
import { BeatAdapter } from "../compatibility/beat_adapter";
import { FountainAdapter } from "../compatibility/fountain_adapter";
import { ICompatibilityAdapter } from "../compatibility/types";
import { Logger } from "../logger";

export function getCompatibilityAdapter(app: App, forceType?: "fountain" | "beat"): ICompatibilityAdapter {
  const plugin = (app as any).plugins.getPlugin("fountain");
  const storage = forceType || plugin?.settings?.snippetStorage || "fountain";

  if (storage === "beat") {
    return new BeatAdapter();
  } else {
    return new FountainAdapter();
  }
}

/**
 * Moves the selection to the snippets library using the active adapter.
 */
export async function moveSelectionToSnippets(
  app: App,
  view: FountainView,
  cut: boolean,
  storagePreference?: "fountain" | "beat",
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

  const adapter = getCompatibilityAdapter(app, storagePreference);

  if (storagePreference === "beat") {
    await consolidateBeatBlocks(view);
  }

  adapter.addSnippet(view, textToStore);

  if (cut && selection) {
    view.replaceText({ start: selection.from, end: selection.to }, "");
  }

  view.focusEditor();
  new Notice(storagePreference === "beat" ? "Moved to Beat Clippings (JSON)" : "Moved to Snippets library");
}

export async function consolidateBeatBlocks(view: FountainView) {
  const script = view.getScript();
  if ("error" in script) return;
  const struct = script.structure();
  const ranges = (struct as any).beatMetadataRanges || [];
  if (ranges.length <= 1) return;

  const primaryRange = ranges[0];
  const primaryContent = script.document.slice(primaryRange.start, primaryRange.end);
  const primaryMatch = primaryContent.match(/({[\s\S]*})/);
  if (!primaryMatch) return;

  try {
    const primaryData = JSON.parse(primaryMatch[1]);
    if (!primaryData.Snippets) primaryData.Snippets = [];

    // Merge and delete subsequent blocks
    for (let i = 1; i < ranges.length; i++) {
      const otherContent = script.document.slice(ranges[i].start, ranges[i].end);
      const otherMatch = otherContent.match(/({[\s\S]*})/);
      if (otherMatch) {
        const otherData = JSON.parse(otherMatch[1]);
        if (otherData.Snippets) {
          primaryData.Snippets.push(...otherData.Snippets);
        }
      }
      view.replaceText(ranges[i], "");
    }

    const newJson = JSON.stringify(primaryData);
    view.replaceText(primaryRange, primaryContent.replace(primaryMatch[1], newJson));
  } catch (e) {
    Logger.error("FormatCommands", "Error consolidating Beat blocks", e);
  }
}

import type { Edit } from "../fountain";
import { BEAT_BOILERPLATE_START, BEAT_BOILERPLATE_END } from "../compatibility/beat_adapter";

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
  const struct = script.structure();

  if (targetStyle === "beat") {
    // Target is Beat Format
    const beatAdapter = new BeatAdapter();

    // 1. Move Standard Snippets to Beat JSON
    const fountainSnippets = struct.snippets.filter(s => s.category !== "Beat JSON");
    if (fountainSnippets.length > 0) {
      let beatData: any = { Snippets: [] };
      let metadataRange = struct.beatMetadata;

      if (metadataRange) {
        const content = script.document.slice(metadataRange.start, metadataRange.end);
        const match = content.match(/({[\s\S]*})/);
        if (match) {
          try {
            beatData = JSON.parse(match[1]);
          } catch (e) {
            Logger.error("FormatCommands", "Error parsing existing beat metadata", e);
          }
        }
      }

      if (!beatData.Snippets) beatData.Snippets = [];

      for (const s of fountainSnippets) {
        const text = s.content.map(el => script.document.slice(el.range.start, el.range.end)).join("");
        beatData.Snippets.push({
          title: s.title || "Converted Snippet",
          text: text,
          color: "none"
        });
        edits.push({ range: s.range, replacement: "" });
      }

      if (metadataRange) {
        const content = script.document.slice(metadataRange.start, metadataRange.end);
        const jsonMatch = content.match(/({[\s\S]*})/);
        if (jsonMatch) {
          edits.push({ range: metadataRange, replacement: content.replace(jsonMatch[1], JSON.stringify(beatData)) });
        }
      } else {
        const blockData = { "Caret Position": 0, "Window Width": 1920, "CharacterGenders": {}, "Changed Indices": {}, ...beatData };
        const newBlock = `\n\n/* ${BEAT_BOILERPLATE_START}${JSON.stringify(blockData)}${BEAT_BOILERPLATE_END} */`;
        edits.push({ range: { start: script.document.length, end: script.document.length }, replacement: newBlock });
      }
    }

    // 2. Scrub tags
    const scrubEdits = beatAdapter.scrubProprietaryTags(script);
    edits.push(...scrubEdits);

    if (edits.length > 0) await view.applyEditsToFile(edits);
    Logger.info("FormatCommands", "Conversion to Beat format complete.");

  } else {
    // Target is Standard Fountain
    const beatAdapter = new BeatAdapter();
    const scrubEdits = beatAdapter.scrubProprietaryTags(script);
    edits.push(...scrubEdits);

    const beatSnippets = struct.snippets.filter(s => s.category === "Beat JSON");
    if (beatSnippets.length > 0) {
      let combinedText = "";
      for (const s of beatSnippets) {
        const cleanTitle = beatAdapter.scrubString(s.title);
        const cleanText = beatAdapter.scrubString(s.text);
        combinedText += `\n\n### ${cleanTitle}\n${cleanText}\n\n===\n`;
      }
      edits.push({ range: { start: script.document.length, end: script.document.length }, replacement: `\n\n# Snippets${combinedText}` });
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

    Logger.info("FormatCommands", "Conversion to standard format complete.");
  }
  window.removeEventListener("blur", blurTrace);
}
