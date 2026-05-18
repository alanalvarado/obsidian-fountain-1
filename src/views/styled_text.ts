/**
 * DOM rendering for Fountain styled text (the inline text-level AST
 * used inside action lines, dialogue, title-page values, etc.).
 *
 * These helpers were factored out of `FountainScript` so the core/data
 * layer stays free of DOM dependencies.
 */

import {
  type FountainScript,
  type ShowHideSettings,
  type StyledTextElement,
  type StyledTextWithNotesAndBoneyard,
  type TextElementWithNotesAndBoneyard,
  dataRange,
  extractMarginMarker,
  isLinkNote,
  maybeEscapeLeadingSpaces,
  parseLinkContent,
} from "../fountain";
import { parseMarker } from "../utils/markers";

/**
 * Render styled text into `parent`.
 * @returns false if every element was hidden by `settings`; true if
 *          anything was rendered (or if the input list was empty but
 *          non-null, matching the previous behaviour).
 */
export function styledTextToHtml(
  script: FountainScript,
  parent: HTMLElement,
  st: StyledTextWithNotesAndBoneyard,
  settings: ShowHideSettings,
  escapeLeadingSpaces: boolean,
): boolean {
  let someVisible = false;
  for (const el of st) {
    if (renderTextElement(script, parent, el, settings, escapeLeadingSpaces)) {
      someVisible = true;
    }
  }
  return someVisible || st.length > 0;
}

function renderStyledTextElement(
  script: FountainScript,
  parent: HTMLElement,
  el: StyledTextElement,
  settings: ShowHideSettings,
): void {
  parent.createEl("span", { cls: el.kind }, (span) => {
    for (const e of el.elements) {
      renderTextElement(script, span, e, settings, false);
    }
  });
}

function renderTextElement(
  script: FountainScript,
  parent: HTMLElement,
  el: TextElementWithNotesAndBoneyard,
  settings: ShowHideSettings,
  escapeLeadingSpaces: boolean,
): boolean {
  switch (el.kind) {
    case "text":
      parent.appendText(
        maybeEscapeLeadingSpaces(escapeLeadingSpaces, script.sliceDocument(el.range)),
      );
      return true;
    case "bold":
    case "italics":
    case "underline":
      renderStyledTextElement(script, parent, el, settings);
      return true;

    case "note": {
      const isLink = isLinkNote(el);
      const marker = isLink ? { isMarker: false, color: undefined } : parseMarker(el, script.document);

      if (settings.hideNotes && !isLink && !marker.isMarker) return false;
      if (settings.hideLinks && isLink) return false;
      if (settings.hideMarkers && marker.isMarker) return false;

      if (isLink) {
        const { target, displayText } = parseLinkContent(
          script.sliceDocument(el.textRange),
        );
        const label = displayText !== null ? displayText : target;
        parent.createEl(
          "a",
          {
            cls: "fountain-link",
            attr: { ...dataRange(el.range), "data-link-target": target },
            href: "#",
            text: label,
          },
        );
        return true;
      }

      if (marker.isMarker) {
        parent.createEl(
          "span",
          { cls: "fountain-marker-badge", attr: dataRange(el.range) },
          (span) => {
            span.appendText(".");
            if (marker.color) {
              span.classList.add("has-color");
              span.classList.add(`color-${marker.color}`);
              span.style.setProperty("--item-color", `var(--fountain-color-${marker.color})`);
            }
          },
        );

        parent.classList.add("fountain-marker-line");
        if (marker.color) {
          parent.classList.add("has-color");
          parent.classList.add(`color-${marker.color}`);
          parent.style.setProperty("--item-color", `var(--fountain-color-${marker.color})`);
        }
        
        if (marker.text) {
          parent.appendText(maybeEscapeLeadingSpaces(true, marker.text));
        } else {
          // Zero-width space ensures the line-box is generated, preventing stacked badges
          parent.createEl("span", { text: "\u200B", attr: { "aria-hidden": "true" } });
        }
        
        return true;
      }

      const noteKindClasses: Record<string, string> = {
        "+": "note-symbol-plus",
        "-": "note-symbol-minus",
        todo: "note-todo",
      };
      const noteKindClass = noteKindClasses[el.noteKind] ?? "note";
      parent.createEl(
        "span",
        { cls: noteKindClass, attr: dataRange(el.range) },
        (span) => {
          if (el.noteKind === "todo") {
            span.createEl("b", { text: "TODO: " });
          }
          span.appendText(
            maybeEscapeLeadingSpaces(true, script.sliceDocument(el.textRange)),
          );
        },
      );
      return true;
    }

    case "boneyard":
      // TODO: support
      return false;
  }
}
