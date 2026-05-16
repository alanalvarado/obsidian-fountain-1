import { App, Notice } from "obsidian";
import { FountainView } from "../views/fountain_view";
import { EditorViewState } from "../views/editor_view_state";
import { computeRange, type Range } from "../fountain/types";


/**
 * Toggles in-line boneyard markers (/* *\/) for the current selection.
 * This is an in-place action and never moves text.
 */
export async function toggleBoneyardComment(view: FountainView) {
  if (!(view.state instanceof EditorViewState)) {
    new Notice("Boneyard commands only work in Edit mode.");
    return;
  }

  const selection = view.state.getSelection();
  if (!selection) {
    new Notice("No text selected.");
    return;
  }

  const rawText = selection.text;
  const match = rawText.match(/^(\s*)(.*?)(\s*)$/s);
  const leading = match ? match[1] : "";
  const text = match ? match[2] : rawText;
  const trailing = match ? match[3] : "";

  let newText = "";
  if (text.startsWith("/*") && text.endsWith("*/")) {
    newText = leading + text.slice(2, -2).trim() + trailing;
  } else {
    newText = leading + `/* ${text} */` + trailing;
  }

  view.replaceText({ start: selection.from, end: selection.to }, newText);
  view.focusEditor();
  new Notice(text.startsWith("/*") ? "Removed from Boneyard" : "Sent to Boneyard (In-line)");
}


