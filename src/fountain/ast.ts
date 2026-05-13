import type {
  Action,
  BasicTextElement,
  Boneyard,
  Dialogue,
  DialogueContent,
  DialogueContentLine,
  DialogueContentParenthetical,
  KeyValue,
  Line,
  Lyrics,
  Note,
  PageBreak,
  Range,
  SceneHeading,
  Section,
  StyledText,
  StyledTextElement,
  Synopsis,
  TextElementWithNotesAndBoneyard,
  TitlePage,
  Transition,
} from "./types";

export function mkRange(loc: {
  start: { offset: number };
  end: { offset: number };
}): Range {
  return { start: loc.start.offset, end: loc.end.offset };
}

/**
 * Extracts a color tag from text in BEAT-compatible format.
 * Supports: [[blue]], [[COLOR CYAN]], [[#ff0000]]
 * Returns the color and the cleaned text (with tag removed).
 */
export function extractColor(text: string): { color?: string; cleanText: string } {
  const match = text.match(/\[\[(?:COLOR\s+)?([a-zA-Z]+|#[a-fA-F0-9]{3,6})\]\]/i);
  if (match) {
    return {
      color: match[1].toLowerCase(),
      cleanText: text.replace(match[0], "").trim(),
    };
  }
  return { cleanText: text };
}

export function mkText(range: Range): BasicTextElement {
  return { kind: "text", range };
}

export function mkBold(
  range: Range,
  elements: StyledText,
): StyledTextElement {
  return { kind: "bold", range, elements };
}

export function mkItalics(
  range: Range,
  elements: StyledText,
): StyledTextElement {
  return { kind: "italics", range, elements };
}

export function mkUnderline(
  range: Range,
  elements: StyledText,
): StyledTextElement {
  return { kind: "underline", range, elements };
}

export function mkLine(
  range: Range,
  elements: TextElementWithNotesAndBoneyard[],
): Line {
  return { range, centered: false, elements };
}

export function mkCenteredLine(
  range: Range,
  elements: TextElementWithNotesAndBoneyard[],
): Line {
  return { range, centered: true, elements };
}

export function shiftLineStart(line: Line, delta: number): Line {
  return {
    ...line,
    range: { start: line.range.start + delta, end: line.range.end },
  };
}

export function mkParenthetical(range: Range): DialogueContentParenthetical {
  return { kind: "parenthetical", range };
}

export function mkDialogueLine(line: Line): DialogueContentLine {
  return { kind: "line", line };
}

export function mkNote(
  range: Range,
  noteKind: string | null | undefined,
  textRange: Range,
): Note {
  return {
    kind: "note",
    range,
    noteKind: (noteKind ?? "").toLowerCase(),
    textRange,
  };
}

export function mkBoneyard(range: Range): Boneyard {
  return { kind: "boneyard", range };
}

export function mkPageBreak(range: Range): PageBreak {
  return { kind: "page-break", range };
}

export function mkSynopsis(range: Range, lines: Line[]): Synopsis {
  return { kind: "synopsis", range, lines };
}

export function mkAction(range: Range, lines: Line[]): Action {
  return { kind: "action", range, lines };
}

export function mkScene(
  range: Range,
  heading: string,
  forced: boolean,
  number: Range | null,
): SceneHeading {
  const { color, cleanText } = extractColor(heading);
  return { kind: "scene", range, heading: cleanText, forced, number, color };
}

export function mkTransition(range: Range, forced: boolean): Transition {
  return { kind: "transition", range, forced };
}

export function mkDialogue(
  range: Range,
  characterRange: Range,
  characterExtensionsRange: Range,
  content: DialogueContent[],
  caretRange: Range | null,
): Dialogue {
  return {
    kind: "dialogue",
    range,
    characterRange,
    characterExtensionsRange,
    content,
    caretRange,
    dual: false,
  };
}

export function mkSection(
  range: Range,
  depth: number,
  text?: string,
): Section {
  const { color, cleanText } = text ? extractColor(text) : { color: undefined, cleanText: undefined };
  return { kind: "section", range, depth, color, text: cleanText };
}

export function mkLyrics(range: Range, lines: Line[]): Lyrics {
  return { kind: "lyrics", range, lines };
}

export function mkKeyValue(
  range: Range,
  key: string,
  values: StyledText[],
): KeyValue {
  return { range, key, values };
}

export function mkTitlePage(
  range: Range,
  keyValues: KeyValue[],
): TitlePage {
  return { range, keyValues };
}
