import { App, Menu } from "obsidian";
import { FountainView } from "./fountain_view";
import { EditorViewState } from "./editor_view_state";
import { toggleBoneyardComment } from "../commands/boneyard_commands";
import { moveSelectionToSnippets } from "../commands/format_commands";

export function addFountainMenuItems(
  app: App,
  menu: any,
  view: FountainView,
  settings: { compatibilityMode: "fountain" | "beat" }
) {
  if (!view.isEditMode()) return;
  if (!(view.state instanceof EditorViewState)) return;

  const selection = view.state.getSelection();

  // Context Awareness: Prioritize Dual Dialogue if on a Character line
  if (isCharacterLine(view)) {
    const line = getCurrentLine(view);
    const hasCaret = line?.text.endsWith("^") || false;
    menu.addItem((item: any) => {
      item.setTitle("Dual Dialogue ^")
        .setIcon("columns")
        .setChecked(hasCaret)
        .onClick(() => toggleDualDialogue(view));
    });
    menu.addSeparator();
  }

  // 1. Edit Group
  menu.addItem((item: any) => {
    item.setTitle("Cut")
      .setIcon("scissors")
      .setDisabled(!selection)
      .onClick(() => {
        if (selection) {
          navigator.clipboard.writeText(selection.text);
          view.replaceText({ start: selection.from, end: selection.to }, "");
        }
      });
  });

  menu.addItem((item: any) => {
    item.setTitle("Copy")
      .setIcon("copy")
      .setDisabled(!selection)
      .onClick(() => {
        if (selection) {
          navigator.clipboard.writeText(selection.text);
        }
      });
  });

  menu.addItem((item: any) => {
    item.setTitle("Paste")
      .setIcon("clipboard")
      .onClick(() => {
        navigator.clipboard.readText().then((text) => {
          if (text) {
            view.insertTextAtCursor(text);
          }
        });
      });
  });

  menu.addSeparator();

  // 2. Formatting Group
  menu.addItem((item: any) => {
    item.setTitle("Bold")
      .setIcon("bold")
      .onClick(() => wrapSelection(view, "**", "**"));
  });

  menu.addItem((item: any) => {
    item.setTitle("Italic")
      .setIcon("italic")
      .onClick(() => wrapSelection(view, "*", "*"));
  });

  menu.addItem((item: any) => {
    item.setTitle("Underline")
      .setIcon("underline")
      .onClick(() => wrapSelection(view, "_", "_"));
  });

  menu.addItem((item: any) => {
    item.setTitle("Center")
      .setIcon("align-center")
      .onClick(() => wrapSelection(view, "> ", " <"));
  });

  menu.addSeparator();

  // 3. Force Element Submenu
  menu.addItem((item: any) => {
    item.setTitle("Force Element..")
      .setIcon("chevrons-right");
    
    const subMenu = item.setSubmenu();

    subMenu.addItem((subItem: any) => {
      subItem.setTitle("Force Character @")
        .setIcon("user")
        .onClick(() => forceLinePrefix(view, "@"));
    });

    subMenu.addItem((subItem: any) => {
      subItem.setTitle("Force Lyrics ~")
        .setIcon("music")
        .onClick(() => forceLinePrefix(view, "~"));
    });

    subMenu.addItem((subItem: any) => {
      subItem.setTitle("Force Action !")
        .setIcon("activity")
        .onClick(() => forceLinePrefix(view, "!"));
    });

    subMenu.addItem((subItem: any) => {
      subItem.setTitle("Force Scene Heading .")
        .setIcon("film")
        .onClick(() => forceLinePrefix(view, "."));
    });

    subMenu.addItem((subItem: any) => {
      subItem.setTitle("Force Transition >")
        .setIcon("chevrons-right")
        .onClick(() => forceLinePrefix(view, ">"));
    });

    subMenu.addItem((subItem: any) => {
      const line = getCurrentLine(view);
      const hasCaret = line?.text.endsWith("^") || false;
      subItem.setTitle("Dual Dialogue ^")
        .setIcon("columns")
        .setChecked(hasCaret)
        .onClick(() => toggleDualDialogue(view));
    });
  });

  // 4. Structure Group
  menu.addItem((item: any) => {
    item.setTitle("Add Section #")
      .setIcon("hash")
      .onClick(() => toggleLinePrefix(view, "# "));
  });

  menu.addItem((item: any) => {
    item.setTitle("Add Synopsis =")
      .setIcon("equal")
      .onClick(() => toggleLinePrefix(view, "= "));
  });

  menu.addItem((item: any) => {
    item.setTitle("Add Shot !!")
      .setIcon("video")
      .onClick(() => toggleLinePrefix(view, "!! "));
  });

  menu.addSeparator();

  // 5. Utilities Group
  let isBoneyard = false;
  if (view.state instanceof EditorViewState) {
    if (selection && selection.text) {
      const text = selection.text.trim();
      if (text.startsWith("/*") && text.endsWith("*/")) {
        isBoneyard = true;
      }
    }
  }

  menu.addItem((item: any) => {
    item
      .setTitle(isBoneyard ? "Restore from Boneyard" : "Send to Boneyard")
      .setIcon(isBoneyard ? "corner-up-left" : "archive")
      .onClick(() => toggleBoneyardComment(view));
  });

  menu.addItem((item: any) => {
    item.setTitle("Note [[ ]]")
      .setIcon("book-open")
      .onClick(() => wrapSelection(view, "[[", "]]", 2));
  });

  menu.addItem((item: any) => {
    item.setTitle("Add Page Break ===")
      .setIcon("separator-horizontal")
      .onClick(() => insertPageBreak(view));
  });

  menu.addItem((item: any) => {
    item.setTitle("Highlight +")
      .setIcon("highlighter")
      .onClick(() => wrapSelection(view, "+", "+"));
  });

  menu.addItem((item: any) => {
    item
      .setTitle("Convert to Snippet")
      .setIcon("scissors")
      .onClick(() => moveSelectionToSnippets(app, view, false, settings.compatibilityMode));
  });

  menu.addSeparator();

  // 6. Conversions Submenu
  menu.addItem((item: any) => {
    item.setTitle("Convert to..")
      .setIcon("case-sensitive")
      .setDisabled(!selection);

    if (selection) {
      const subMenu = item.setSubmenu();
      
      subMenu.addItem((subItem: any) => {
        subItem.setTitle("UPPERCASE")
          .onClick(() => convertSelectionCase(view, "upper"));
      });

      subMenu.addItem((subItem: any) => {
        subItem.setTitle("lowercase")
          .onClick(() => convertSelectionCase(view, "lower"));
      });

      subMenu.addItem((subItem: any) => {
        subItem.setTitle("Title Case")
          .onClick(() => convertSelectionCase(view, "title"));
      });
    }
  });

  // 7. Research
  menu.addItem((item: any) => {
    item.setTitle("Link to Research Note")
      .setIcon("link")
      .onClick(() => wrapSelection(view, "[[>", "]]", 3));
  });
}

// ============================================================================
// Context Menu & Formatting Helper Functions
// ============================================================================

function getCurrentLine(view: FountainView): { text: string; start: number; end: number } | null {
  const docText = view.getViewData();
  const range = view.state.getInsertionRange();
  if (!range) return null;
  const pos = range.start;
  
  let lineStart = pos;
  while (lineStart > 0 && docText[lineStart - 1] !== "\n") {
    lineStart--;
  }
  
  let lineEnd = pos;
  while (lineEnd < docText.length && docText[lineEnd] !== "\n") {
    lineEnd++;
  }
  
  return {
    text: docText.slice(lineStart, lineEnd),
    start: lineStart,
    end: lineEnd,
  };
}

function isCharacterLine(view: FountainView): boolean {
  const line = getCurrentLine(view);
  if (!line) return false;
  
  const text = line.text.trim();
  if (!text) return false;
  
  // 1. Forced Character prefix
  if (text.startsWith("@")) return true;
  
  // 2. AST dialogue check
  const script = view.getScript();
  if (script && !("error" in script)) {
    for (const el of script.script) {
      if (el.kind === "dialogue") {
        if (line.start >= el.characterRange.start && line.end <= el.characterRange.end + 2) {
          return true;
        }
      }
    }
  }
  
  // 3. Fallback: all uppercase syntax
  if (text === text.toUpperCase() && !text.startsWith(".") && !text.startsWith("INT.") && !text.startsWith("EXT.")) {
    if (/[A-Z]/.test(text) && !/[a-z]/.test(text)) {
      return true;
    }
  }
  
  return false;
}

function forceLinePrefix(view: FountainView, prefix: string) {
  const line = getCurrentLine(view);
  if (!line) return;
  
  if (!(view.state instanceof EditorViewState)) return;
  const originalCursor = view.state.cursorOffset();
  
  let cleanText = line.text;
  const prefixes = ["@", "~", "!", ".", ">"];
  let existingPrefix = "";
  
  for (const p of prefixes) {
    if (cleanText.startsWith(p)) {
      existingPrefix = p;
      cleanText = cleanText.slice(p.length);
      break;
    }
  }
  
  let newText = "";
  let cursorShift = 0;
  
  if (existingPrefix === prefix) {
    newText = cleanText;
    cursorShift = -prefix.length;
  } else {
    newText = prefix + cleanText;
    cursorShift = prefix.length - existingPrefix.length;
  }
  
  view.replaceText({ start: line.start, end: line.end }, newText);
  
  const newPos = Math.max(line.start, originalCursor + cursorShift);
  view.state.setCursor(newPos);
}

function toggleDualDialogue(view: FountainView) {
  const line = getCurrentLine(view);
  if (!line) return;
  
  const text = line.text;
  if (text.endsWith("^")) {
    const newText = text.slice(0, -1).trimEnd();
    view.replaceText({ start: line.start, end: line.end }, newText);
  } else {
    const newText = text.trimEnd() + " ^";
    view.replaceText({ start: line.start, end: line.end }, newText);
  }
}

function wrapSelection(view: FountainView, prefix: string, suffix: string, cursorOffsetInside?: number) {
  if (!(view.state instanceof EditorViewState)) return;
  const selection = view.state.getSelection();
  if (selection) {
    const wrapped = prefix + selection.text + suffix;
    view.replaceText({ start: selection.from, end: selection.to }, wrapped);
  } else {
    const range = view.state.getInsertionRange();
    if (range) {
      const inserted = prefix + suffix;
      view.replaceText(range, inserted);
      
      if (cursorOffsetInside !== undefined) {
        view.state.setCursor(range.start + cursorOffsetInside);
      }
    }
  }
}

function toTitleCase(str: string): string {
  const minorWords = ["a", "an", "the", "and", "but", "for", "at", "by", "from", "in", "into", "of", "on", "to", "with"];
  return str.replace(/\w\S*/g, (txt, index) => {
    const word = txt.toLowerCase();
    if (index > 0 && minorWords.includes(word)) {
      return word;
    }
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function convertSelectionCase(view: FountainView, mode: "upper" | "lower" | "title") {
  if (!(view.state instanceof EditorViewState)) return;
  const selection = view.state.getSelection();
  if (!selection) return;
  
  let newText = selection.text;
  if (mode === "upper") {
    newText = selection.text.toUpperCase();
  } else if (mode === "lower") {
    newText = selection.text.toLowerCase();
  } else if (mode === "title") {
    newText = toTitleCase(selection.text);
  }
  
  view.replaceText({ start: selection.from, end: selection.to }, newText);
  view.focusEditor();
}

function toggleLinePrefix(view: FountainView, prefix: string) {
  const line = getCurrentLine(view);
  if (!line) return;
  
  if (!(view.state instanceof EditorViewState)) return;
  const originalCursor = view.state.cursorOffset();
  
  const text = line.text;
  if (text.startsWith(prefix)) {
    const newText = text.slice(prefix.length);
    view.replaceText({ start: line.start, end: line.end }, newText);
    
    const newPos = Math.max(line.start, originalCursor - prefix.length);
    view.state.setCursor(newPos);
  } else {
    const newText = prefix + text;
    view.replaceText({ start: line.start, end: line.end }, newText);
    
    const newPos = originalCursor + prefix.length;
    view.state.setCursor(newPos);
  }
}

function insertPageBreak(view: FountainView) {
  const range = view.state.getInsertionRange();
  if (!range) return;
  
  const docText = view.getViewData();
  const pos = range.start;
  
  const prefix = pos > 0 && docText[pos - 1] !== "\n" ? "\n===\n" : "===\n";
  view.replaceText(range, prefix);
}
