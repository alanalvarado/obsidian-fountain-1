/* 
 * BEAT SNIPPETS IMPLEMENTATION (UNRELEASED)
 * As of the current version of Beat and today's date, this functionality is unreleased.
 * This file contains the JSON snippet handling logic designed for future Beat compatibility.
 * It is preserved here for future development.
 */

import { Notice } from "obsidian";
import { FountainView } from "../../views/fountain_view";
import { Logger } from "../../utils/logger";
import { BEAT_BOILERPLATE_START, BEAT_BOILERPLATE_END } from "./beat_adapter";

export function initializeMetadataBlock(view: FountainView, initialData: any = {}): void {
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

export function addSnippet(view: FountainView, textToStore: string, overrideTitle?: string): void {
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
    initializeMetadataBlock(view, { Snippets: [newSnippet] });
  }
}

export function deleteSnippet(view: FountainView, snippet: any): void {
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

export function renameSnippet(view: FountainView, snippet: any, newTitle: string): void {
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
