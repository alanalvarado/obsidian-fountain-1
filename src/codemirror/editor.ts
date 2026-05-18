import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  type PluginSpec,
  type PluginValue,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import {
  type FountainScript,
  type Line,
  type StyledTextElement,
  intersect,
} from "../fountain";
import { fountainScriptField } from "./state";
import { parseMarker } from "../utils/markers";
export { createFountainEditorPlugin };

class MarkerBadgeWidget extends WidgetType {
  constructor(private markerWord: string, private color?: string) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "fountain-marker-badge";
    span.textContent = ".";
    if (this.color) {
      span.classList.add("has-color");
      span.classList.add(`color-${this.color.toLowerCase()}`);
      span.style.setProperty("--item-color", `var(--fountain-color-${this.color.toLowerCase()})`);
    }
    return span;
  }

  eq(other: MarkerBadgeWidget) {
    return this.markerWord === other.markerWord && this.color === other.color;
  }
}

/// This extends CodeMirror 6 to syntax highlight fountain.
/// Note that we are using a custom Code Mirror instance,
/// so we do not have any of the obsidian customizations.
/// That is both bad and good.
class FountainEditorPlugin implements PluginValue {
  public decorations: DecorationSet;
  private bold: Decoration;
  private italics: Decoration;
  private underline: Decoration;
  private boneyard: Decoration;
  private noteSymbolPlus: Decoration;
  private noteSymbolMinus: Decoration;
  private noteTodo: Decoration;
  private note: Decoration;
  private noteMargin: Decoration;
  private noteLink: Decoration;
  private markerTag: Decoration;
  private centered: Decoration;
  private dualMarkerValid: Decoration;
  private dualMarkerInvalid: Decoration;
  private wordsLine: Decoration;
  private hasCharacterNote?: (name: string) => boolean;

  constructor(view: EditorView, hasCharacterNote?: (name: string) => boolean) {
    this.hasCharacterNote = hasCharacterNote;
    this.bold = Decoration.mark({ class: "bold" });
    this.italics = Decoration.mark({ class: "italics" });
    this.underline = Decoration.mark({ class: "underline" });
    this.boneyard = Decoration.mark({ class: "boneyard" });
    this.noteSymbolPlus = Decoration.mark({ class: "note-symbol-plus" });
    this.noteSymbolMinus = Decoration.mark({ class: "note-symbol-minus" });
    this.noteTodo = Decoration.mark({ class: "note-todo" });
    this.note = Decoration.mark({ class: "note" });
    this.noteMargin = Decoration.mark({ class: "note-margin-editor" });
    this.noteLink = Decoration.mark({ class: "fountain-link-editor" });
    this.markerTag = Decoration.mark({ class: "fountain-marker-tag" });
    this.centered = Decoration.mark({ class: "centered" });
    this.dualMarkerValid = Decoration.mark({
      class: "dialogue-dual-marker-valid",
    });
    this.dualMarkerInvalid = Decoration.mark({
      class: "dialogue-dual-marker-invalid",
    });
    // Line-level decoration for dialogue words: applied to the .cm-line
    // element so that block CSS (max-width) can constrain text wrapping,
    // which inline mark spans cannot do.
    this.wordsLine = Decoration.line({ class: "dialogue-words-line" });
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  destroy() {}

  private applyTextDecoration(
    builder: RangeSetBuilder<Decoration>,
    st: StyledTextElement,
  ) {
    const deco = {
      bold: this.bold,
      italics: this.italics,
      underline: this.underline,
    };

    builder.add(st.range.start, st.range.end, deco[st.kind]);
    for (const cel of st.elements) {
      if (cel.kind !== "text") {
        this.applyTextDecoration(builder, cel);
      }
    }
  }

  private decorateLines(builder: RangeSetBuilder<Decoration>, lines: Line[], fscript: FountainScript) {
    for (const line of lines) {
      // Apply centered decoration to the entire line if it's centered
      if (line.centered) {
        builder.add(line.range.start, line.range.end, this.centered);
      }

      // Check if this line contains a marker
      let markerInfo: { markerWord: string; color?: string } | null = null;
      for (const tel of line.elements) {
        if (tel.kind === "note") {
          const parsed = parseMarker(tel, fscript.document);
          if (parsed.isMarker) {
            markerInfo = parsed;
            break; // Currently support one marker per line
          }
        }
      }

      if (markerInfo) {
        // 1. Add line background decoration
        const lineClass = markerInfo.color 
          ? `fountain-marker-line has-color color-${markerInfo.color}` 
          : "fountain-marker-line";
        const styleAttr = markerInfo.color
          ? { style: `--item-color: var(--fountain-color-${markerInfo.color})` }
          : undefined;
          
        builder.add(
          line.range.start,
          line.range.start,
          Decoration.line({ 
            class: lineClass,
            attributes: styleAttr,
          }),
        );
        
        // 2. Add widget decoration for the premium swallowtail badge
        builder.add(
          line.range.start,
          line.range.start,
          Decoration.widget({
            widget: new MarkerBadgeWidget(markerInfo.markerWord, markerInfo.color),
            side: -1,
          }),
        );
      }

      for (const tel of line.elements) {
        switch (tel.kind) {
          case "text":
            break;
          case "bold":
          case "italics":
          case "underline":
            this.applyTextDecoration(builder, tel);
            break;

          case "boneyard":
            builder.add(tel.range.start, tel.range.end, this.boneyard);
            break;
          case "note": {
            let noteDeco: Decoration = this.note;
            if (tel.noteKind === "+") {
              noteDeco = this.noteSymbolPlus;
            } else if (tel.noteKind === "-") {
              noteDeco = this.noteSymbolMinus;
            } else if (tel.noteKind === ">") {
              noteDeco = this.noteLink;
            } else if (tel.noteKind === "todo") {
              noteDeco = this.noteTodo;
            } else {
              const parsed = parseMarker(tel, fscript.document);
              if (parsed.isMarker) {
                if (parsed.color) {
                  const style = `--item-color: var(--fountain-color-${parsed.color})`;
                  noteDeco = Decoration.mark({
                    class: `fountain-marker-tag has-color color-${parsed.color}`,
                    attributes: { style },
                  });
                } else {
                  noteDeco = this.markerTag;
                }
              } else if (tel.noteKind.startsWith("@")) {
                noteDeco = this.noteMargin;
              }
            }
            builder.add(tel.range.start, tel.range.end, noteDeco);
            break;
          }
        }
      }
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const fscript = view.state.field(fountainScriptField);
    const scene = Decoration.mark({ class: "scene-heading" });
    const section = Decoration.mark({ class: "section" });
    const synopsis = Decoration.mark({ class: "synopsis" });
    const parenthetical = Decoration.mark({ class: "dialogue-parenthetical" });
    const characterName = Decoration.mark({ class: "dialogue-character-name" });
    const characterNameWithNote = Decoration.mark({ 
      class: "dialogue-character-name has-character-note" 
    });
    const characterExtension = Decoration.mark({ class: "dialogue-character-extension" });
    const words = Decoration.mark({ class: "dialogue-words" });
    const action = Decoration.mark({ class: "action" });
    const pageBreak = Decoration.mark({ class: "page-break" });
    const transition = Decoration.mark({ class: "transition" });
    const lyrics = Decoration.mark({ class: "lyrics" });

    if (fscript.titlePage !== null) {
      for (const kv of fscript.titlePage.keyValues) {
        for (const styledText of kv.values) {
          for (const st of styledText) {
            if (st.kind !== "text") {
              this.applyTextDecoration(builder, st);
            }
          }
        }
      }
    }

    const viewPortRange = { start: view.viewport.from, end: view.viewport.to };

    try {
      for (const el of fscript.script) {
        if (!intersect(el.range, viewPortRange)) {
          // Don't decorate things that are not in the viewport at all
          continue;
        }
        switch (el.kind) {
          case "scene": {
            let sceneDeco = scene;
            let tagRange: { start: number; end: number } | null = null;

            if (el.color) {
              const style = `--item-color: ${
                el.color.startsWith("#")
                  ? el.color
                  : `var(--fountain-color-${el.color})`
              }`;
              sceneDeco = Decoration.mark({
                class: `scene-heading color-${el.color}`,
                attributes: { style },
              });

              const rawText = view.state.doc.sliceString(
                el.range.start,
                el.range.end,
              );
              const tagMatch = rawText.match(
                /\[\[(?:COLOR\s+)?([a-zA-Z]+|#[a-fA-F0-9]{3,6})\]\]/i,
              );
              if (tagMatch) {
                tagRange = {
                  start: el.range.start + tagMatch.index!,
                  end: el.range.start + tagMatch.index! + tagMatch[0].length,
                };
              }
            }

            builder.add(el.range.start, el.range.end, sceneDeco);
            if (tagRange) {
              builder.add(
                tagRange.start,
                tagRange.end,
                Decoration.mark({ class: "color-tag" }),
              );
            }
            break;
          }

          case "section": {
            let sectionDeco = section;
            let tagRange: { start: number; end: number } | null = null;

            if (el.color) {
              const style = `--item-color: ${
                el.color.startsWith("#")
                  ? el.color
                  : `var(--fountain-color-${el.color})`
              }`;
              sectionDeco = Decoration.mark({
                class: `section color-${el.color}`,
                attributes: { style },
              });

              const rawText = view.state.doc.sliceString(
                el.range.start,
                el.range.end,
              );
              const tagMatch = rawText.match(
                /\[\[(?:COLOR\s+)?([a-zA-Z]+|#[a-fA-F0-9]{3,6})\]\]/i,
              );
              if (tagMatch) {
                tagRange = {
                  start: el.range.start + tagMatch.index!,
                  end: el.range.start + tagMatch.index! + tagMatch[0].length,
                };
              }
            }

            builder.add(el.range.start, el.range.end, sectionDeco);
            if (tagRange) {
              builder.add(
                tagRange.start,
                tagRange.end,
                Decoration.mark({ class: "color-tag" }),
              );
            }
            break;
          }

          case "synopsis":
            builder.add(el.range.start, el.range.end, synopsis);
            this.decorateLines(builder, el.lines, fscript);
            break;

          case "page-break":
            builder.add(el.range.start, el.range.end, pageBreak);
            break;

          case "dialogue": {
            const charName = view.state.doc.sliceString(el.characterRange.start, el.characterRange.end).trim();
            const hasNote = this.hasCharacterNote?.(charName);
            
            builder.add(
              el.characterRange.start,
              el.characterRange.end,
              hasNote ? characterNameWithNote : characterName,
            );
            if (el.characterExtensionsRange.start !== el.characterExtensionsRange.end) {
              builder.add(
                el.characterExtensionsRange.start,
                el.characterExtensionsRange.end,
                characterExtension,
              );
            }
            if (el.caretRange) {
              builder.add(
                el.caretRange.start,
                el.caretRange.end,
                el.dual ? this.dualMarkerValid : this.dualMarkerInvalid,
              );
            }
            for (const item of el.content) {
              if (item.kind === "parenthetical") {
                builder.add(
                  item.range.start,
                  item.range.end,
                  parenthetical,
                );
              } else {
                // Emit line-level decoration first (from === to, at line
                // start) so the .cm-line gets the dialogue-words-line class
                // which allows max-width CSS to constrain wrapping.
                const lineStart = view.state.doc.lineAt(
                  item.line.range.start,
                ).from;
                builder.add(lineStart, lineStart, this.wordsLine);
                builder.add(
                  item.line.range.start,
                  item.line.range.end,
                  words,
                );
                this.decorateLines(builder, [item.line], fscript);
              }
            }
            break;
          }

          case "action":
            builder.add(el.range.start, el.range.end, action);
            this.decorateLines(builder, el.lines, fscript);
            break;

          case "transition":
            builder.add(el.range.start, el.range.end, transition);
            break;

          case "lyrics":
            builder.add(el.range.start, el.range.end, lyrics);
            break;

          default:
            break;
        }
      }
    } catch (error) {
      // I've never seen this fail in testing, if it did let me know.
      console.error("decoration failed", error);
    }
    return builder.finish();
  }
}

const pluginSpec: PluginSpec<FountainEditorPlugin> = {
  decorations: (value: FountainEditorPlugin) => value.decorations,
};

function createFountainEditorPlugin(
  hasCharacterNote?: (name: string) => boolean,
): ViewPlugin<FountainEditorPlugin> {
  return ViewPlugin.define((view) => {
    return new FountainEditorPlugin(view, hasCharacterNote);
  }, pluginSpec);
}
