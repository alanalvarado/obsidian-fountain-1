/**
 * Generates PDF instructions from a FountainScript AST.
 * This module converts screenplay elements into abstract rendering instructions
 * that can be executed by the PDF renderer.
 */

import {
  type Action,
  type Dialogue,
  type FountainScript,
  type Lyrics,
  type SceneHeading,
  type StyledText,
  type Synopsis,
  type Transition,
  extractTransitionText,
} from "../fountain";
import type { PDFOptions } from "./options_dialog";
import {
  addElementSpacing,
  advanceLine,
  emitNewPage,
  hasSpaceForLines,
  needLines,
} from "./page_state";
import {
  dialogueRequiredLines,
  extractStyledSegments,
  prepareDialogueData,
  splitDialogue,
  wrapPlainText,
  wrapStyledText,
} from "./text_wrapping";
import {
  type Color,
  type Instruction,
  type PageState,
  type PreparedDialogue,
  type PreparedDialogueContentLine,
  type WrappedLine,
  ACTION_INDENT,
  CHARACTER_INDENT,
  DEFAULT_CHARACTERS_PER_LINE,
  DIALOGUE_INDENT,
  DUAL_COLUMN_PARENTHETICAL_WIDTH_CHARS,
  DUAL_COLUMN_WIDTH_CHARS,
  DUAL_LEFT_CHARACTER_INDENT,
  DUAL_LEFT_DIALOGUE_INDENT,
  DUAL_LEFT_PARENTHETICAL_INDENT,
  DUAL_RIGHT_CHARACTER_INDENT,
  DUAL_RIGHT_DIALOGUE_INDENT,
  DUAL_RIGHT_PARENTHETICAL_INDENT,
  FONT_SIZE,
  LINE_HEIGHT,
  MARGIN_LEFT,
  PAPER_SIZES,
  PARENTHETICAL_INDENT,
  SCENE_HEADING_INDENT,
  calculateRightMargin,
  calculateVerticalMargins,
  getCharacterWidth,
  getTitlePageCenterStart,
  getTitlePageCenterX,
  TRANSITION_INDENT,
} from "./types";

/**
 * Where to position each part of a dialogue block. Single-column dialogue
 * uses one of these; dual dialogue uses two (one per column).
 */
type DialogueLayout = {
  characterX: number;
  dialogueX: number;
  parentheticalX: number;
};

const SINGLE_LAYOUT: DialogueLayout = {
  characterX: CHARACTER_INDENT,
  dialogueX: DIALOGUE_INDENT,
  parentheticalX: PARENTHETICAL_INDENT,
};

const DUAL_LEFT_LAYOUT: DialogueLayout = {
  characterX: DUAL_LEFT_CHARACTER_INDENT,
  dialogueX: DUAL_LEFT_DIALOGUE_INDENT,
  parentheticalX: DUAL_LEFT_PARENTHETICAL_INDENT,
};

const DUAL_RIGHT_LAYOUT: DialogueLayout = {
  characterX: DUAL_RIGHT_CHARACTER_INDENT,
  dialogueX: DUAL_RIGHT_DIALOGUE_INDENT,
  parentheticalX: DUAL_RIGHT_PARENTHETICAL_INDENT,
};

/**
 * Emits margin marks in the left margin at the current Y position.
 * Marks are right-aligned to sit near the text area.
 * Multiple margin marks are separated by spaces.
 */
function emitMarginMarks(
  instructions: Instruction[],
  pageState: PageState,
  marginMarks: string[],
): void {
  if (marginMarks.length === 0) return;

  // Combine all margin marks with a space separator, uppercase to match reading view
  const marginText = marginMarks.join(" ").toUpperCase();

  // Calculate text width for right-alignment in left margin
  const charWidth = getCharacterWidth(pageState.fontSize);
  const textWidth = marginText.length * charWidth;

  // Right-align in left margin (end 10pt before text area starts)
  const marginX = pageState.margins.left - textWidth - 10;

  emitText(instructions, pageState, {
    data: marginText,
    x: marginX,
    bold: false,
    italic: false,
    underline: false,
    color: "gray",
    strikethrough: false,
    backgroundColor: undefined,
  });
}

/**
 * Helper function to emit a text instruction and return the new x position
 */
function emitText(
  instructions: Instruction[],
  pageState: PageState,
  options: {
    data: string;
    x: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    color?: Color;
    strikethrough?: boolean;
    backgroundColor?: Color;
  },
): number {
  instructions.push({
    type: "text",
    data: options.data,
    x: options.x,
    y: pageState.currentY,
    bold: options.bold,
    italic: options.italic,
    underline: options.underline,
    color: options.color || "black",
    strikethrough: options.strikethrough || false,
    backgroundColor: options.backgroundColor,
  });

  return (
    options.x + options.data.length * getCharacterWidth(pageState.fontSize)
  );
}

/**
 * Generates all instructions for the entire fountain script
 */
export function generateInstructions(
  fountainScript: FountainScript,
  options: PDFOptions = {
    sceneHeadingBold: false,
    paperSize: "letter",
    hideNotes: true,
    hideSynopsis: false,
    hideMarginMarks: false,
    layoutPreset: "standard",
    linesPerPage: 55,
  },
): Instruction[] {
  const instructions: Instruction[] = [];
  const paperSize = PAPER_SIZES[options.paperSize];

  // Calculate dynamic margins based on paper size and industry standards
  const linesPerPage = options.linesPerPage || 55;
  const verticalMargins = calculateVerticalMargins(
    paperSize.height,
    linesPerPage,
  );
  const rightMargin = calculateRightMargin(
    paperSize.width,
    DEFAULT_CHARACTERS_PER_LINE.action,
    FONT_SIZE,
  );

  // Initialize page state (using PDF coordinates - bottom-left origin)
  let currentState: PageState = {
    currentY: paperSize.height - verticalMargins.top, // Start at calculated top margin
    remainingHeight:
      paperSize.height - verticalMargins.top - verticalMargins.bottom,
    pageNumber: 0,
    pageWidth: paperSize.width,
    pageHeight: paperSize.height,
    isTitlePage: true,
    documentHasTitlePage: fountainScript.titlePage !== null,
    margins: {
      top: verticalMargins.top,
      bottom: verticalMargins.bottom,
      left: MARGIN_LEFT, // Fixed 1.5" for binding
      right: rightMargin, // Calculated based on character limits
    },
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    charactersPerLine: DEFAULT_CHARACTERS_PER_LINE,
    lastElementType: null,
  };

  // Add first page
  currentState = emitNewPage(instructions, currentState);

  // Generate title page instructions if it exists
  if (fountainScript.titlePage !== null) {
    currentState = generateTitlePageInstructions(
      instructions,
      currentState,
      fountainScript,
      options,
    );
  } else {
    currentState = {
      ...currentState,
      isTitlePage: false,
      pageNumber: 1,
      documentHasTitlePage: false,
    };
  }

  // Filter out hidden elements for consistent behavior
  // Note: hideNotes is always false here - note visibility (including margin marks)
  // is handled in extractStyledSegments to allow independent control of margin marks
  const filteredScript = fountainScript.withHiddenElementsRemoved({
    hideBoneyard: true,
    hideNotes: false,
    hideSynopsis: options.hideSynopsis,
    hideSnippets: true, // Always hide snippets in PDF
  });

  // Generate script instructions
  generateScriptInstructions(
    instructions,
    currentState,
    filteredScript,
    options,
  );

  return instructions;
}

/**
 * Generates instructions for the entire script by iterating through all elements
 */
function generateScriptInstructions(
  instructions: Instruction[],
  pageState: PageState,
  fountainScript: FountainScript,
  options: PDFOptions,
): PageState {
  let currentState = pageState;
  const elements = fountainScript.script;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    switch (element.kind) {
      case "scene":
        currentState = generateSceneInstructions(
          instructions,
          currentState,
          element,
          fountainScript,
          options,
        );
        break;
      case "action":
        currentState = generateActionInstructions(
          instructions,
          currentState,
          element,
          fountainScript,
          options,
        );
        break;
      case "dialogue": {
        const next = elements[i + 1];
        if (
          element.dual &&
          next &&
          next.kind === "dialogue" &&
          next.dual
        ) {
          currentState = generateDualDialogueInstructions(
            instructions,
            currentState,
            element,
            next,
            fountainScript,
            options,
          );
          i++;
        } else {
          currentState = generateDialogueInstructions(
            instructions,
            currentState,
            element,
            fountainScript,
            options,
          );
        }
        break;
      }
      case "transition":
        currentState = generateTransitionInstructions(
          instructions,
          currentState,
          element,
          fountainScript,
        );
        break;
      case "synopsis":
        if (!options.hideSynopsis) {
          currentState = generateSynopsisInstructions(
            instructions,
            currentState,
            element,
            fountainScript,
            options,
          );
        }
        break;
      case "page-break":
        currentState = emitNewPage(instructions, currentState);
        break;
      case "section":
        // TODO
        break;
      case "lyrics":
        currentState = generateLyricsInstructions(
          instructions,
          currentState,
          element,
          fountainScript,
          options,
        );
        break;
    }
  }

  return currentState;
}

/**
 * Generates instructions for title page metadata
 */
function generateTitlePageInstructions(
  instructions: Instruction[],
  pageState: PageState,
  fountainScript: FountainScript,
  options: PDFOptions,
): PageState {
  let currentState = { ...pageState };

  // Separate title page elements by positioning
  const centeredKeys = new Set([
    "title",
    "credit",
    "author",
    "authors",
    "source",
  ]);
  const lowerLeftKeys = new Set(["contact", "draft date"]);
  const lowerRightKeys = new Set([]);

  const centeredElements: { key: string; values: StyledText[] }[] = [];
  const lowerLeftElements: { key: string; values: StyledText[] }[] = [];
  const lowerRightElements: { key: string; values: StyledText[] }[] = [];

  // Categorize title page elements
  for (const element of fountainScript.titlePage?.keyValues ?? []) {
    const keyLower = element.key.toLowerCase();
    if (centeredKeys.has(keyLower)) {
      centeredElements.push(element);
    } else if (lowerLeftKeys.has(keyLower)) {
      lowerLeftElements.push(element);
    } else if (lowerRightKeys.has(keyLower)) {
      lowerRightElements.push(element);
    }
  }

  // Generate centered elements
  if (centeredElements.length > 0) {
    currentState = generateCenteredTitleElementInstructions(
      instructions,
      currentState,
      centeredElements,
      fountainScript,
      options,
    );
  }

  // Generate lower-left elements
  if (lowerLeftElements.length > 0) {
    currentState = generateLowerLeftTitleElementInstructions(
      instructions,
      currentState,
      lowerLeftElements,
      fountainScript,
      options,
    );
  }

  // Generate lower-right elements
  if (lowerRightElements.length > 0) {
    currentState = generateLowerRightTitleElementInstructions(
      instructions,
      currentState,
      lowerRightElements,
      fountainScript,
      options,
    );
  }

  // Mark that we're no longer on title page and create new page for script
  currentState.isTitlePage = false;

  // Add new page for the actual script content
  currentState = emitNewPage(instructions, currentState);
  currentState.remainingHeight =
    pageState.pageHeight - pageState.margins.top - pageState.margins.bottom;

  return currentState;
}

/**
 * Generates instructions for centered title page elements
 */
function generateCenteredTitleElementInstructions(
  instructions: Instruction[],
  pageState: PageState,
  elements: { key: string; values: StyledText[] }[],
  fountainScript: FountainScript,
  options: PDFOptions,
): PageState {
  let currentY = getTitlePageCenterStart(pageState.pageHeight);

  for (const element of elements) {
    // Generate instructions for the values (no keys on title page)
    for (const styledText of element.values) {
      const segments = extractStyledSegments(
        styledText,
        fountainScript.document,
        options,
      );
      const wrappedLines = wrapStyledText(
        segments,
        pageState.charactersPerLine.titlePageCenter,
        false,
      );

      for (const line of wrappedLines) {
        // Calculate line width for centering
        let lineWidth = 0;
        for (const segment of line.segments) {
          // Estimate width using average character width for Courier
          lineWidth +=
            segment.text.length * getCharacterWidth(pageState.fontSize);
        }

        let x = getTitlePageCenterX(pageState.pageWidth) - lineWidth / 2;

        // Generate instruction for each segment with appropriate styling
        for (const segment of line.segments) {
          if (segment.text.length > 0) {
            x = emitText(
              instructions,
              { ...pageState, currentY },
              {
                data: segment.text,
                x,
                bold: segment.bold || false,
                italic: segment.italic || false,
                underline: segment.underline || false,
                color: segment.color || "black",
                strikethrough: segment.strikethrough || false,
                backgroundColor: segment.backgroundColor,
              },
            );
          }
        }

        currentY -= pageState.lineHeight; // Move down for next line
      }
    }

    // Add spacing between different keys
    currentY -= pageState.lineHeight; // Move down for spacing
  }

  return { ...pageState, currentY };
}

/**
 * Generates instructions for lower-left title page elements
 */
function generateLowerLeftTitleElementInstructions(
  instructions: Instruction[],
  pageState: PageState,
  elements: { key: string; values: StyledText[] }[],
  fountainScript: FountainScript,
  options: PDFOptions,
): PageState {
  // Start from bottom left area
  let currentY = pageState.margins.bottom;

  for (const element of elements) {
    // Show the key for lower-left elements (Draft date, etc.)
    let x = pageState.margins.left;
    x = emitText(instructions, { ...pageState, currentY }, {
      data: `${element.key}: `,
      x,
      bold: false,
      italic: false,
      underline: false,
    });

    for (const styledText of element.values) {
      const segments = extractStyledSegments(
        styledText,
        fountainScript.document,
        options,
      );
      const wrappedLines = wrapStyledText(
        segments,
        pageState.charactersPerLine.titlePageSides,
        false,
      );

      for (const line of wrappedLines) {
        let valX = x; // Start values after the key for the first line

        for (const segment of line.segments) {
          if (segment.text.length > 0) {
            valX = emitText(
              instructions,
              { ...pageState, currentY },
              {
                data: segment.text,
                x: valX,
                bold: segment.bold || false,
                italic: segment.italic || false,
                underline: segment.underline || false,
                color: segment.color || "black",
                strikethrough: segment.strikethrough || false,
                backgroundColor: segment.backgroundColor,
              },
            );
          }
        }

        currentY += pageState.lineHeight; // Move up from bottom
        x = pageState.margins.left; // Subsequent lines of same value start at margin
      }
    }

    currentY += pageState.lineHeight; // Add spacing between elements
  }

  return { ...pageState, currentY };
}

/**
 * Generates instructions for lower-right title page elements
 */
function generateLowerRightTitleElementInstructions(
  instructions: Instruction[],
  pageState: PageState,
  elements: { key: string; values: StyledText[] }[],
  fountainScript: FountainScript,
  options: PDFOptions,
): PageState {
  // Start from bottom right area
  let currentY = pageState.margins.bottom;

  for (const element of elements) {
    for (const styledText of element.values) {
      const segments = extractStyledSegments(
        styledText,
        fountainScript.document,
        options,
      );
      const wrappedLines = wrapStyledText(
        segments,
        pageState.charactersPerLine.titlePageSides,
        false,
      );

      for (const line of wrappedLines) {
        // Calculate line width for right alignment
        let lineWidth = 0;
        for (const segment of line.segments) {
          lineWidth +=
            segment.text.length * getCharacterWidth(pageState.fontSize);
        }

        let x =
          pageState.pageWidth - pageState.margins.right - lineWidth;

        for (const segment of line.segments) {
          if (segment.text.length > 0) {
            x = emitText(
              instructions,
              { ...pageState, currentY },
              {
                data: segment.text,
                x,
                bold: segment.bold || false,
                italic: segment.italic || false,
                underline: segment.underline || false,
                color: segment.color || "black",
                strikethrough: segment.strikethrough || false,
                backgroundColor: segment.backgroundColor,
              },
            );
          }
        }

        currentY += pageState.lineHeight; // Move up from bottom
      }
    }

    currentY += pageState.lineHeight; // Add spacing between elements
  }

  return { ...pageState, currentY };
}

/**
 * Generates instructions for a scene heading
 */
function generateSceneInstructions(
  instructions: Instruction[],
  pageState: PageState,
  scene: SceneHeading,
  fountainScript: FountainScript,
  options: PDFOptions,
): PageState {
  // Use the heading property directly
  const sceneText = scene.heading.toUpperCase(); // Scene headings are typically uppercase

  // Add spacing before scene heading and ensure we have space
  let currentState = addElementSpacing(pageState);
  currentState = needLines(instructions, currentState, 1);

  if (scene.number) {
    // Extract scene number text (remove the # characters)
    const numberText = fountainScript.document.substring(
      scene.number.start + 1,
      scene.number.end - 1,
    );

    // Calculate positions to avoid overlap
    const leftNumberWidth =
      `${numberText}.`.length * getCharacterWidth(pageState.fontSize);
    const headingStartX =
      pageState.margins.left +
      leftNumberWidth +
      getCharacterWidth(pageState.fontSize); // Add one space

    // Adjust scene heading indent to avoid overlap with left number
    const adjustedHeadingX = Math.max(SCENE_HEADING_INDENT, headingStartX);

    // Left scene number
    emitText(instructions, currentState, {
      data: `${numberText}.`,
      x: pageState.margins.left,
      bold: true,
      italic: false,
      underline: false,
      color: "black",
      strikethrough: false,
      backgroundColor: undefined,
    });

    // Scene heading (adjusted position to avoid overlap)
    emitText(instructions, currentState, {
      data: sceneText,
      x: adjustedHeadingX,
      bold: options.sceneHeadingBold,
      italic: false,
      underline: false,
      color: "black",
      strikethrough: false,
      backgroundColor: undefined,
    });

    // Right scene number
    const rightNumberX =
      pageState.pageWidth -
      pageState.margins.right -
      numberText.length * getCharacterWidth(pageState.fontSize);
    emitText(instructions, currentState, {
      data: numberText,
      x: rightNumberX,
      bold: true,
      italic: false,
      underline: false,
      color: "black",
      strikethrough: false,
      backgroundColor: undefined,
    });
  } else {
    // No scene number, just the heading
    emitText(instructions, currentState, {
      data: sceneText,
      x: SCENE_HEADING_INDENT,
      bold: options.sceneHeadingBold,
      italic: false,
      underline: false,
      color: "black",
      strikethrough: false,
      backgroundColor: undefined,
    });
  }

  // Update page state
  return {
    ...advanceLine(currentState),
    lastElementType: "scene",
  };
}

/**
 * Generates instructions for a synopsis. Synopsis text renders italic +
 * gray; inline `**bold**` etc. layer on top of the italic+gray base, so
 * a `**bold**` segment becomes bold-italic-gray. Notes (including
 * `[[>...]]` link notes) follow the same `hideNotes` rules as elsewhere.
 */
function generateSynopsisInstructions(
  instructions: Instruction[],
  pageState: PageState,
  synopsis: Synopsis,
  fountainScript: FountainScript,
  options: PDFOptions,
): PageState {
  let currentState = addElementSpacing(pageState);

  for (const line of synopsis.lines) {
    if (line.elements.length === 0) {
      currentState = needLines(instructions, currentState, 1);
      currentState = advanceLine(currentState);
      continue;
    }

    const styledSegments = extractStyledSegments(
      line.elements,
      fountainScript.document,
      options,
    );

    const wrappedLines = wrapStyledText(
      styledSegments,
      pageState.charactersPerLine.action,
      false,
    );

    for (const wrappedLine of wrappedLines) {
      currentState = needLines(instructions, currentState, 1);

      for (const segment of wrappedLine.segments) {
        if (segment.text.length === 0) continue;
        emitText(instructions, currentState, {
          data: segment.text,
          x: ACTION_INDENT,
          bold: segment.bold ?? false,
          italic: true,
          underline: segment.underline ?? false,
          color: segment.color ?? "gray",
          strikethrough: segment.strikethrough ?? false,
          backgroundColor: segment.backgroundColor,
        });
      }

      if (wrappedLine.marginMarks.length > 0) {
        emitMarginMarks(instructions, currentState, wrappedLine.marginMarks);
      }

      currentState = advanceLine(currentState);
    }
  }

  return {
    ...currentState,
    lastElementType: "synopsis",
  };
}
