import type {
  Action,
  Dialogue,
  FountainElement,
  FountainScript,
  Line,
  Lyrics,
  Range,
  ShowHideSettings,
  Synopsis,
} from "../fountain";
import { NBSP, dataRange, extractTransitionText } from "../fountain";
import { renderBlankLine } from "./render_tools";
import { styledTextToHtml } from "./styled_text";
export {
  renderFountain,
  getDataRange,
  rangeOfFirstVisibleLine,
  renderElement,
  renderContent,
};

function renderAction(
  parent: HTMLElement,
  action: Action,
  script: FountainScript,
  settings: ShowHideSettings,
  spotlightCharacter?: string,
): void {
  const classes = ["action", ...(spotlightCharacter ? ["dimmed"] : [])];
  if (renderLines(parent, script, classes, action.lines, true, settings)) {
    // Only add a manual blank line if the element didn't already end with one.
    // This prevents double-spacing when the source already contains blank lines.
    const lastLine = action.lines[action.lines.length - 1];
    if (lastLine && lastLine.elements.length > 0) {
      renderBlankLine(parent, action.range);
    }
  }
}

function renderLyrics(
  parent: HTMLElement,
  lyrics: Lyrics,
  script: FountainScript,
  settings: ShowHideSettings,
  spotlightCharacter?: string,
): void {
  const classes = ["lyrics", ...(spotlightCharacter ? ["dimmed"] : [])];
  if (renderLines(parent, script, classes, lyrics.lines, true, settings)) {
    const lastLine = lyrics.lines[lyrics.lines.length - 1];
    if (lastLine && lastLine.elements.length > 0) {
      renderBlankLine(parent, lyrics.range);
    }
  }
}

function renderDialogueInner(
  parent: HTMLElement,
  dialogue: Dialogue,
  script: FountainScript,
  settings: ShowHideSettings,
  blackoutCharacter?: string,
  spotlightCharacter?: string,
): void {
  // Character line (including extensions)
  const isSpotlighted = spotlightCharacter && script.charactersOf(dialogue).includes(spotlightCharacter);
  const characterClasses = ["dialogue-character", ...(spotlightCharacter && !isSpotlighted ? ["dimmed"] : []), ...(isSpotlighted ? ["spotlight"] : [])];

  parent.createDiv(
    {
      attr: dataRange(dialogue.characterRange),
    },
    (div) => {
      div.createEl("h4", {
        cls: characterClasses,
        text: script.sliceDocument({
          start: dialogue.characterRange.start,
          end: dialogue.characterExtensionsRange.end,
        }),
      });
    },
  );
  const classes = ["dialogue-words"];
  if (blackoutCharacter && script.charactersOf(dialogue).includes(blackoutCharacter)) {
    classes.push("blackout");
  }
  if (spotlightCharacter && !isSpotlighted) {
    classes.push("dimmed");
  }

  for (const item of dialogue.content) {
    if (item.kind === "parenthetical") {
      parent.createDiv(
        {
          attr: dataRange(item.range),
        },
        (div) => {
          div.createDiv({
            cls: ["dialogue-parenthetical", ...(spotlightCharacter && !isSpotlighted ? ["dimmed"] : [])],
            text: script.sliceDocument(item.range),
          });
        },
      );
    } else {
      renderLines(parent, script, classes, [item.line], false, settings);
    }
  }
}

function renderDialogue(
  parent: HTMLElement,
  dialogue: Dialogue,
  script: FountainScript,
  settings: ShowHideSettings,
  blackoutCharacter?: string,
  spotlightCharacter?: string,
): void {
  renderDialogueInner(parent, dialogue, script, settings, blackoutCharacter, spotlightCharacter);
  renderBlankLine(parent, dialogue.range);
}

function renderDualDialogue(
  parent: HTMLElement,
  left: Dialogue,
  right: Dialogue,
  script: FountainScript,
  settings: ShowHideSettings,
  blackoutCharacter?: string,
  spotlightCharacter?: string,
): void {
  parent.createDiv(
    {
      cls: "dialogue-dual",
      attr: dataRange({ start: left.range.start, end: right.range.end }),
    },
    (container) => {
      container.createDiv(
        {
          cls: "dialogue dialogue-dual-left",
          attr: dataRange(left.range),
        },
        (col) => {
          renderDialogueInner(col, left, script, settings, blackoutCharacter, spotlightCharacter);
        },
      );
      container.createDiv(
        {
          cls: "dialogue dialogue-dual-right",
          attr: dataRange(right.range),
        },
        (col) => {
          renderDialogueInner(col, right, script, settings, blackoutCharacter, spotlightCharacter);
        },
      );
    },
  );
  renderBlankLine(parent, right.range);
}

function getDataRange(target: HTMLElement, name = "range"): Range | null {
  const rawRange = target.getAttribute(`data-${name}`);
  if (rawRange === null) return null;
  const r = rawRange.split(",");
  if (r.length !== 2) return null;
  try {
    const start = Number.parseInt(r[0]);
    const end = Number.parseInt(r[1]);
    return { start: start, end: end };
  } catch (error) {
    return null;
  }
}

/** @returns false if lines contained ONLY elements that were hidden because of settings. */
function renderLines(
  parent: HTMLElement,
  script: FountainScript,
  lineClasses: string[], // Changed from lineClass: string
  lines: Line[],
  escapeLeadingSpaces: boolean,
  settings: ShowHideSettings,
): boolean {
  let everythingHidden = true;
  for (const line of lines) {
    const centered = line.centered ? "centered" : "";
    // Merge the lineClasses array with centered if present
    const allClasses = centered ? [centered, ...lineClasses] : lineClasses;
    parent.createDiv({ cls: "fountain-line", attr: dataRange(line.range) }, (div) => {
      const innerDiv = div.createDiv({ cls: allClasses });
      if (line.elements.length === 0) {
        // Need a nbsp so that the div is not empty and gets regular text height
        innerDiv.appendText(NBSP);
      } else {
        const thisLineWasCompletelyHidden = !styledTextToHtml(
          script,
          innerDiv,
          line.elements,
          settings,
          escapeLeadingSpaces,
        );
        everythingHidden = everythingHidden && thisLineWasCompletelyHidden;
      }
    });
  }
  return !everythingHidden || lines.length > 0;
}

function renderSynopsis(
  parent: HTMLElement,
  script: FountainScript,
  synopsis: Synopsis,
  settings: ShowHideSettings,
  spotlightCharacter?: string,
): void {
  const classes = ["synopsis", ...(spotlightCharacter ? ["dimmed"] : [])];
  if (renderLines(parent, script, classes, synopsis.lines, true, settings)) {
    const lastLine = synopsis.lines[synopsis.lines.length - 1];
    if (lastLine && lastLine.elements.length > 0) {
      renderBlankLine(parent, synopsis.range);
    }
  }
}

/**
 * Renders a single fountain element to HTML.
 */
function renderElement(
  parent: HTMLElement,
  el: FountainElement,
  script: FountainScript,
  settings: ShowHideSettings,
  blackoutCharacter?: string,
  spotlightCharacter?: string,
): void {
  switch (el.kind) {
    case "action":
      renderAction(parent, el, script, settings, spotlightCharacter);
      break;
    case "scene":
      {
        const sceneClasses = [
          "scene-heading-container",
          ...(spotlightCharacter ? ["dimmed"] : []),
        ];
        const sceneDiv = parent.createDiv({
          cls: sceneClasses,
          attr: dataRange(el.range),
        });

        if (el.number) {
          // Extract scene number text (remove the # characters)
          const numberText = script.document.substring(
            el.number.start + 1,
            el.number.end - 1,
          );

          // Left scene number
          sceneDiv.createSpan({
            cls: "scene-number-left",
            text: `${numberText}.`,
          });

          // Scene heading
          sceneDiv.createEl("h3", {
            cls: "scene-heading",
            text: el.heading,
          });

          // Right scene number
          sceneDiv.createSpan({
            cls: "scene-number-right",
            text: numberText,
          });
        } else {
          // No scene number, just the heading
          sceneDiv.createEl("h3", {
            cls: "scene-heading",
            text: el.heading,
          });
        }

        renderBlankLine(parent, el.range);
      }
      break;

    case "synopsis":
      renderSynopsis(parent, script, el, settings, spotlightCharacter);
      break;

    case "section":
      {
        const title = script.sliceDocument(el.range);
        if (
          title
            .toLowerCase()
            .replace(/^ *#+ */, "")
            .trimEnd() === "boneyard"
        ) {
          parent.createEl("hr");
        }
        const tag = `h${el.depth ?? 1}` as keyof HTMLElementTagNameMap;
        const sectionClasses = ["section", ...(spotlightCharacter ? ["dimmed"] : [])];
        parent.createEl(tag, {
          cls: sectionClasses,
          attr: dataRange(el.range),
          text: title,
        });
      }
      break;
    case "dialogue":
      renderDialogue(
        parent,
        el,
        script,
        settings,
        blackoutCharacter,
        spotlightCharacter,
      );
      break;
    case "transition":
      {
        const transitionText = extractTransitionText(el, script);
        const transitionClasses = [
          "transition",
          ...(spotlightCharacter ? ["dimmed"] : []),
        ];
        parent.createDiv({
          cls: transitionClasses,
          attr: dataRange(el.range),
          text: transitionText,
        });
        renderBlankLine(parent, el.range);
      }
      break;
    case "page-break":
      parent.createEl("hr", {
        attr: dataRange(el.range),
      });
      break;
    case "lyrics":
      renderLyrics(parent, el, script, settings, spotlightCharacter);
      break;
  }
}

/**
 * Render the content of the script (everything but the title page).
 */
function renderContent(
  parent: HTMLElement,
  script: FountainScript,
  settings: ShowHideSettings,
  blackoutCharacter?: string,
  spotlightCharacter?: string,
): void {
  const elements = script.script;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.kind === "dialogue" && el.dual) {
      const next = elements[i + 1];
      if (next && next.kind === "dialogue" && next.dual) {
        renderDualDialogue(
          parent,
          el,
          next,
          script,
          settings,
          blackoutCharacter,
          spotlightCharacter,
        );
        i++;
        continue;
      }
    }
    renderElement(parent, el, script, settings, blackoutCharacter, spotlightCharacter);
  }
}

const INDENT = NBSP.repeat(3);

function renderTitlePage(parent: HTMLElement, script: FountainScript): void {
  const titlePage = script.titlePage;
  if (titlePage === null) return;

  for (const kv of titlePage.keyValues) {
    if (kv.values.length === 1) {
      parent.createDiv({}, (div) => {
        div.appendText(`${kv.key}: `);
        styledTextToHtml(script, div, kv.values[0], {}, true);
      });
    } else {
      parent.createDiv({ text: `${kv.key}: ` });
      for (const v of kv.values) {
        parent.createDiv({}, (div) => {
          div.appendText(INDENT);
          styledTextToHtml(script, div, v, {}, true);
        });
      }
    }
  }
  renderBlankLine(parent);
  parent.createEl("hr");
  renderBlankLine(parent);
}

/**
 * Render the readonly view of a fountain document.
 * @param parent this elements content will be replaced
 * @param script the document to render
 * @param settings
 * @param blackoutCharacter if given this characters dialogue is blacked out.
 * @param spotlightCharacter if given other characters are dimmed.
 */
function renderFountain(
  parent: HTMLElement,
  script: FountainScript,
  settings: ShowHideSettings,
  blackoutCharacter?: string,
  spotlightCharacter?: string,
): void {
  // Use filtered script to ensure consistent behavior and eliminate unwanted newlines
  const filteredScript = script.withHiddenElementsRemoved({
    hideBoneyard: settings.hideBoneyard,
    hideNotes: settings.hideNotes,
    hideSynopsis: settings.hideSynopsis,
  });

  renderTitlePage(parent, script); // Title page uses original script
  renderContent(parent, filteredScript, settings, blackoutCharacter, spotlightCharacter);
}

/// Return the range of the first visible line on the screen. Or something close.
function rangeOfFirstVisibleLine(screenplayElement: HTMLElement): Range | null {
  // screenplay is the element that is the complete document
  // it's parent is the one that scrolls the screenplay.
  // getBoundingClientRect gives us the coordinates of the elements on the viewport (aka screen)
  // so the first child whose top >= parent of screenplay top, is the one actually scrolled into view
  // Well actually that would be the first one fully in view. But as we sometimes have longer paragraphs
  // we want to get those too. So we find the first whose bottom is visible
  const top = (
    screenplayElement.parentNode as HTMLElement
  ).getBoundingClientRect().top;
  for (const c of screenplayElement.children) {
    const child = c as HTMLElement;
    if (child.getBoundingClientRect().bottom >= top) {
      const r = getDataRange(child);
      if (r === null) continue;
      return r;
    }
  }
  return null;
}
