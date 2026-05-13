import { ItemView, TFile, type WorkspaceLeaf, debounce } from "obsidian";
import { findFountainViewsForPath } from "../edit_pipeline";
import {
  type FountainScript,
  type Range,
  type Snippet,
  type StructureSection,
  type Synopsis,
  dataRange,
  extractNotes,
} from "../fountain";
import { formatDuration, formatEighths } from "../fountain/metrics";
import { FountainView } from "../views/fountain_view";
import { renderElement } from "../views/reading_view";
import { getScenePreview } from "../views/render_tools";
import { styledTextToHtml } from "../views/styled_text";

export const VIEW_TYPE_SIDEBAR = "fountain-sidebar";

interface SidebarCallbacks {
  scrollToRange: (range: Range) => void;
  getText: (range: Range) => string;
  /** Read text from any fountain file (open or not) at the given range. */
  readFromFile: (path: string, range: Range) => Promise<string | null>;
  insertAfterSnippetsHeader: (text: string) => void;
  toggleSpotlight: (character: string) => void;
  getSpotlightCharacter: () => string | null;
  moveSceneAcross: (args: {
    srcPath: string;
    srcRange: Range;
    dstPath: string;
    dstPos: number;
  }) => void;
  reRender: () => void;
  requestSave: () => void;
}

abstract class SidebarSection {
  protected callbacks: SidebarCallbacks;

  constructor(callbacks: SidebarCallbacks) {
    this.callbacks = callbacks;
  }

  abstract render(
    container: HTMLElement,
    script: FountainScript,
    isEditMode: boolean,
    path: string,
  ): void;
}

class MetricsSection extends SidebarSection {
  render(
    container: HTMLElement,
    script: FountainScript,
    _isEditMode: boolean,
    _path: string,
  ): void {
    const structure = script.structure();
    const m = structure.metrics;

    container.createDiv({ cls: "metrics-section" }, (div) => {
      div.createDiv({ cls: "metrics-header", text: "THE PULSE" });

      div.createDiv({ cls: "metrics-grid" }, (grid) => {
        grid.createDiv({ cls: "metric-item" }, (item) => {
          item.createDiv({ cls: "metric-label", text: "PAGES" });
          item.createDiv({ cls: "metric-value", text: formatEighths(m.pageCount).replace(" pg", "") });
        });
        grid.createDiv({ cls: "metric-item" }, (item) => {
          item.createDiv({ cls: "metric-label", text: "RUNTIME" });
          item.createDiv({ cls: "metric-value", text: formatDuration(m.durationSeconds) });
        });
        grid.createDiv({ cls: "metric-item" }, (item) => {
          item.createDiv({ cls: "metric-label", text: "WORDS" });
          item.createDiv({
            cls: "metric-value small",
            text: m.wordCount.toLocaleString(),
          });
        });
      });

      // Balance bar
      div.createDiv({ cls: "balance-container" }, (balance) => {
        balance.createDiv({
          cls: "balance-bar",
          attr: {
            title: `Dialogue: ${m.dialoguePercent}% | Action: ${m.actionPercent}%`,
          },
        }, (bar) => {
          bar.createDiv({
            cls: "balance-fill dialogue",
            attr: { style: `width: ${m.dialoguePercent}%` },
          });
          bar.createDiv({
            cls: "balance-fill action",
            attr: { style: `width: ${m.actionPercent}%` },
          });
        });
        balance.createDiv({ cls: "balance-labels" }, (labels) => {
          labels.createSpan({ cls: "label-dialogue", text: "Dialogue" });
          labels.createSpan({ cls: "label-action", text: "Action" });
        });
      });
    });
  }
}

class SnippetsSection extends SidebarSection {
  render(
    container: HTMLElement,
    script: FountainScript,
    isEditMode: boolean,
    path: string,
  ): void {
    const structure = script.structure();
    const hasSnippets = structure.snippets && structure.snippets.length > 0;
    if (!hasSnippets && !isEditMode) return;

    container.createDiv(
      { cls: hasSnippets ? "snippets-section" : "snippets-section-empty" },
      (sectionDiv) => {
        sectionDiv.addClass("screenplay-snippets");

        // Add drop handling
        sectionDiv.addEventListener("dragover", (event) => {
          event.preventDefault();
          sectionDiv.addClass("drag-over");
        });

        sectionDiv.addEventListener("dragleave", (event) => {
          sectionDiv.removeClass("drag-over");
        });

        sectionDiv.addEventListener("drop", async (event) => {
          // preventDefault must run synchronously, before any await, so the
          // browser doesn't fall back to its default drop handling.
          event.preventDefault();
          sectionDiv.removeClass("drag-over");

          // Index card drags carry an application/json payload of
          // {path, range}; the source file may differ from the active
          // (destination) file. Snippet-to-snippet drags use text/plain.
          const json = event.dataTransfer?.getData("application/json");
          if (json) {
            try {
              const { path, range } = JSON.parse(json) as {
                path: string;
                range: Range;
              };
              const text = await this.callbacks.readFromFile(path, range);
              if (text) {
                this.callbacks.insertAfterSnippetsHeader(
                  `${text}\n\n===\n\n`,
                );
              }
            } catch {
              // Malformed JSON — fall through to text/plain handling.
            }
            return;
          }

          const droppedText = event.dataTransfer?.getData("text/plain");
          if (droppedText) {
            this.callbacks.insertAfterSnippetsHeader(
              `${droppedText}\n\n===\n\n`,
            );
          }
        });

        if (hasSnippets) {
          sectionDiv.createEl("div", {
            text: "Snippets",
            cls: "snippets-instruction",
          });

          for (let i = 0; i < structure.snippets.length; i++) {
            const snippet = structure.snippets[i];
            this.renderSnippet(sectionDiv, script, snippet, i);
          }
        } else {
          sectionDiv.createEl("div", {
            text: "Drop selection here to create a snippet",
            cls: "snippets-instruction",
          });
        }
      },
    );
  }

  private renderSnippet(
    parent: HTMLElement,
    script: FountainScript,
    snippet: Snippet,
    index: number,
  ): void {
    const snippetRange =
      snippet.content.length > 0
        ? {
            start: snippet.content[0].range.start,
            end: snippet.content[snippet.content.length - 1].range.end,
          }
        : { start: 0, end: 0 };

    parent.createDiv(
      {
        cls: ["snippet"],
        attr: {
          draggable: "true",
          ...dataRange(snippetRange),
        },
      },
      (snippetDiv) => {
        // Add click handler to scroll to snippet location
        if (snippet.content.length > 0) {
          snippetDiv.addEventListener("click", (evt) => {
            // Don't scroll if we started a drag
            if (evt.defaultPrevented) return;
            this.callbacks.scrollToRange(snippetRange);
          });
          snippetDiv.style.cursor = "pointer";
        }

        // Add drag handlers
        snippetDiv.addEventListener("dragstart", (evt: DragEvent) => {
          if (!evt.dataTransfer) return;

          // Get the actual snippet text content
          const snippetText = this.callbacks.getText(snippetRange);
          if (!snippetText) return;

          evt.dataTransfer.clearData();
          evt.dataTransfer.setData("text/plain", snippetText);
        });

        snippetDiv.createDiv({ cls: ["screenplay"] }, (div) => {
          // Render all snippet content - CSS max-height will handle truncation
          for (const element of snippet.content) {
            renderElement(div, element, script, {});
          }
        });
      },
    );
  }
}

class TocSection extends SidebarSection {
  private showTodos = true;
  private showSynopsis = false;

  render(
    container: HTMLElement,
    script: FountainScript,
    _isEditMode: boolean,
    path: string,
  ): void {
    container.createDiv({ cls: "toc-section" }, (sectionDiv) => {
      sectionDiv.createDiv({ cls: "screenplay-toc" }, (div) => {
        div.createDiv({ cls: "toc-controls" }, (tocControls) => {
          tocControls.createEl(
            "input",
            {
              type: "checkbox",
              attr: {
                name: "todos",
                ...(this.showTodos ? { checked: "" } : {}),
              },
            },
            (checkbox) => {
              checkbox.addEventListener("change", (event: Event) => {
                this.showTodos = checkbox.checked;
                for (const el of container.querySelectorAll<HTMLElement>(
                  ".todo",
                )) {
                  el.toggle(this.showTodos);
                }
              });
            },
          );
          tocControls.createEl("label", {
            attr: { for: "todos" },
            text: "todos?",
          });
          tocControls.createEl(
            "input",
            {
              type: "checkbox",
              attr: {
                name: "synopsis",
                ...(this.showSynopsis ? { checked: "" } : {}),
              },
            },
            (checkbox) => {
              checkbox.addEventListener("change", (event: Event) => {
                this.showSynopsis = checkbox.checked;
                for (const el of container.querySelectorAll<HTMLElement>(
                  ".synopsis, .preview",
                )) {
                  el.toggle(this.showSynopsis);
                }
              });
            },
          );
          tocControls.createEl("label", {
            attr: { for: "synopsis" },
            text: "synopsis?",
          });
        });

        for (const section of script.structure().sections) {
          this.renderTocSection(div, script, section, path);
        }

        if (!this.showSynopsis) {
          for (const el of div.querySelectorAll<HTMLElement>(
            ".synopsis, .preview",
          )) {
            el.hide();
          }
        }
      });
    });
  }

  private renderSynopsis(
    s: HTMLElement,
    script: FountainScript,
    synopsis?: Synopsis,
  ) {
    if (synopsis) {
      for (const line of synopsis.lines) {
        const d = s.createDiv({
          cls: "synopsis",
          attr: dataRange(line.range),
        });
        styledTextToHtml(script, d, line.elements, {}, true);
        d.addEventListener("click", (evt: Event) => {
          this.callbacks.scrollToRange(line.range);
        });
      }
    }
  }

  private renderTocSection(
    parent: HTMLElement,
    script: FountainScript,
    section: StructureSection,
    path: string,
  ) {
    parent.createEl("section", {}, (s) => {
      if (section.section) {
        const sect = section.section;
        const d = s.createEl("h1", {
          cls: "section",
          text: sect.text || script.sliceDocument(sect.range),
        });
        if (sect.color) {
          d.addClass(`color-${sect.color}`);
          d.style.setProperty(
            "--item-color",
            sect.color.startsWith("#")
              ? sect.color
              : `var(--fountain-color-${sect.color})`,
          );
        }
        d.addEventListener("click", (evt: Event) => {
          this.callbacks.scrollToRange(sect.range);
        });
      }
      this.renderSynopsis(s, script, section.synopsis);
      for (const el of section.content) {
        if (el.scene) {
          const el_scene = el.scene;
          const d = s.createDiv({
            cls: "scene-heading",
          });
          if (el_scene.color) {
            d.addClass(`color-${el_scene.color}`);
            d.style.setProperty(
              "--item-color",
              el_scene.color.startsWith("#")
                ? el_scene.color
                : `var(--fountain-color-${el_scene.color})`,
            );
          }
          d.createSpan({ text: el_scene.heading });
          d.createSpan({
            cls: "scene-length",
            text: formatEighths(el.metrics.pageCount),
          });
          this.installTocDragAndDropHandlers(path, this.callbacks, d, el.range);
          d.addEventListener("click", (evt: Event) => {
            this.callbacks.scrollToRange(el_scene.range);
          });
        }
        if (el.synopsis) {
          this.renderSynopsis(s, script, el.synopsis);
        } else {
          const preview = getScenePreview(script, el);
          if (preview) {
            const d = s.createDiv({
              cls: "preview",
              text: preview,
            });
            if (!this.showSynopsis) {
              d.hide();
            }
          }
        }
        // Use `.body` not `.content` so the qualifying synopsis (already
        // rendered above) doesn't have its todos surface again here.
        const todos = extractNotes(el.body).filter(
          (n) => n.noteKind === "todo",
        );
        for (const note of todos) {
          s.createDiv({ cls: "todo" }, (div) => {
            styledTextToHtml(script, div, [note], {}, false);
            div.addEventListener("click", () =>
              this.callbacks.scrollToRange(note.range),
            );
            if (!this.showTodos) {
              div.hide();
            }
          });
        }
      }
    });
  }

  private installTocDragAndDropHandlers(
    path: string,
    callbacks: SidebarCallbacks,
    sceneEl: HTMLElement,
    range: Range,
  ) {
    sceneEl.draggable = true;
    sceneEl.addEventListener("dragstart", (evt: DragEvent) => {
      if (!evt.dataTransfer) return;
      evt.dataTransfer.clearData();
      evt.dataTransfer.setData(
        "application/json",
        JSON.stringify({ path: path, range: range }),
      );
      evt.dataTransfer.effectAllowed = "move";
      sceneEl.classList.add("dragging");
    });

    sceneEl.addEventListener("dragend", () => {
      sceneEl.classList.remove("dragging");
      this.clearTocDropIndicators();
    });

    sceneEl.addEventListener("dragover", (evt: DragEvent) => {
      evt.preventDefault();
      if (sceneEl.classList.contains("dragging")) return;

      const rect = sceneEl.getBoundingClientRect();
      const relativeY = evt.clientY - rect.top;
      const isAbove = relativeY < rect.height / 2;

      this.clearTocDropIndicators();
      if (isAbove) {
        sceneEl.classList.add("drop-above");
      } else {
        sceneEl.classList.add("drop-below");
      }
    });

    sceneEl.addEventListener("dragleave", () => {
      sceneEl.classList.remove("drop-above");
      sceneEl.classList.remove("drop-below");
    });

    sceneEl.addEventListener("drop", (evt: DragEvent) => {
      evt.preventDefault();
      const isAbove = sceneEl.classList.contains("drop-above");
      const isBelow = sceneEl.classList.contains("drop-below");
      this.clearTocDropIndicators();
      if (!isAbove && !isBelow) return;

      const json = evt.dataTransfer?.getData("application/json");
      if (!json) return;
      const dragData = JSON.parse(json);

      // No-op if dropping on itself
      if (dragData.path === path && dragData.range.start === range.start) return;

      callbacks.moveSceneAcross({
        srcPath: dragData.path,
        srcRange: dragData.range,
        dstPath: path,
        dstPos: isAbove ? range.start : range.end,
      });
      callbacks.requestSave();
      callbacks.reRender();
    });
  }

  private clearTocDropIndicators() {
    for (const el of document.querySelectorAll(".drop-above, .drop-below")) {
      el.classList.remove("drop-above");
      el.classList.remove("drop-below");
    }
  }
}

class CharactersSection extends SidebarSection {
  render(
    container: HTMLElement,
    script: FountainScript,
    _isEditMode: boolean,
    path: string,
  ): void {
    const structure = script.structure();
    const characters = structure.characters;
    if (characters.length === 0) return;

    container.createDiv({ cls: "characters-section" }, (sectionDiv) => {
      sectionDiv.addClass("screenplay-characters");

      sectionDiv.createEl("div", {
        text: "Characters",
        cls: "characters-instruction",
      });

      const activeChar = this.callbacks.getSpotlightCharacter();

      for (const char of characters) {
        sectionDiv.createDiv(
          {
            cls: ["character-stat", ...(activeChar === char.name ? ["active"] : [])],
          },
          (charDiv) => {
            charDiv.createSpan({ cls: "char-name", text: char.name });
            charDiv.createSpan({
              cls: "char-count",
              text: `${char.dialogueCount}`,
            });

            charDiv.addEventListener("click", () => {
              this.callbacks.toggleSpotlight(char.name);
            });
          },
        );
      }
    });
  }
}

// TODO: In an ideal world, instead of registering an additional view, we
// would take over the normal outline view (so that for markdown views the
// regular outline view does its job but for foutainview's our view does
// what it should...)
export class FountainSideBarView extends ItemView {
  private updateToc: () => void;
  private sections: SidebarSection[];

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.updateToc = debounce(() => this.render(), 500, true);

    const callbacks: SidebarCallbacks = {
      scrollToRange: (range: Range) => this.scrollActiveScriptToHere(range),
      getText: (range: Range) => this.getText(range),
      readFromFile: (path: string, range: Range) =>
        this.readFromFile(path, range),
      insertAfterSnippetsHeader: (text: string) =>
        this.insertAfterSnippetsHeader(text),
      toggleSpotlight: (character: string) => this.toggleSpotlight(character),
      getSpotlightCharacter: () => this.theFountainView()?.spotlightCharacter() ?? null,
      moveSceneAcross: (args) => this.moveSceneAcross(args),
      reRender: () => this.render(),
      requestSave: () => this.app.workspace.requestSaveLayout(),
    };

    this.sections = [
      new MetricsSection(callbacks),
      new TocSection(callbacks),
      new CharactersSection(callbacks),
      new SnippetsSection(callbacks),
    ];
  }

  /** Read a slice of text from `path`, preferring an open FountainView's
   *  cached script (which may carry typed-but-unsaved CM state) and
   *  falling back to a vault read. */
  private async readFromFile(
    path: string,
    range: Range,
  ): Promise<string | null> {
    const views = findFountainViewsForPath(this.app, path);
    if (views.length > 0) return views[0].getText(range);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      const txt = await this.app.vault.read(file);
      return txt.slice(range.start, range.end);
    }
    return null;
  }

  getViewType(): string {
    return VIEW_TYPE_SIDEBAR;
  }

  getDisplayText(): string {
    return "Fountain Outline";
  }

  getIcon(): string {
    return "list-tree";
  }

  private moveSceneAcross(args: {
    srcPath: string;
    srcRange: Range;
    dstPath: string;
    dstPos: number;
  }) {
    const views = findFountainViewsForPath(this.app, args.dstPath);
    if (views.length > 0) {
      views[0].moveSceneAcross(args);
    }
  }

  async onload(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on(
        "active-leaf-change",
        (leaf: WorkspaceLeaf | null) => {
          if (leaf?.view !== this) this.updateToc();
        },
      ),
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.name.endsWith(".fountain")) {
          this.updateToc();
        }
      }),
    );
  }

  private scrollActiveScriptToHere(range: Range) {
    // In the moment of clicking on a toc element, the toc is active
    // so let's see if before that a fountainview was active.
    this.theFountainView()?.scrollToHere(range);
  }

  private theFountainView(): FountainView | null {
    const leaf = this.app.workspace.getMostRecentLeaf(
      this.app.workspace.rootSplit,
    );
    if (leaf && leaf.view instanceof FountainView) {
      const ft = leaf.view;
      return ft;
    }
    return null;
  }

  private getText(range: Range): string {
    const ft = this.theFountainView();
    return ft?.getText(range) ?? "";
  }

  private insertAfterSnippetsHeader(text: string) {
    const ft = this.theFountainView();
    if (!ft) return;

    const script = ft.getScript();
    if ("error" in script) return;

    // Find the "# Snippets" header position
    let snippetsHeaderEnd: number | null = null;
    for (const element of script.script) {
      if (element.kind === "section") {
        const sectionText = script.document.slice(
          element.range.start,
          element.range.end,
        );
        if (sectionText.toLowerCase().includes("snippets")) {
          snippetsHeaderEnd = element.range.end;
          break;
        }
      }
    }

    if (snippetsHeaderEnd !== null) {
      // Insert text right after the snippets header
      ft.replaceText(
        { start: snippetsHeaderEnd, end: snippetsHeaderEnd },
        `\n\n${text}`,
      );
    } else {
      // If no snippets section exists, add it at the end
      const docLength = script.document.length;
      const snippetsSection = `\n\n# Boneyard\n# Snippets\n${text}`;
      ft.replaceText({ start: docLength, end: docLength }, snippetsSection);
    }
  }

  private toggleSpotlight(character: string) {
    const ft = this.theFountainView();
    if (!ft) return;

    if (ft.spotlightCharacter() === character) {
      ft.stopSpotlightMode();
    } else {
      ft.startSpotlightMode(character);
    }
    this.render();
  }

  private render() {
    const ft = this.theFountainView();
    const container = this.contentEl;
    container.empty();

    // Create the main sidebar container
    container.createDiv({ cls: "sidebar-container" }, (sidebarDiv) => {
      if (ft) {
        const script = ft.getScript();
        if (!("error" in script)) {
          const isEditMode = ft.isEditMode();
          const path = ft.file.path;
          for (const section of this.sections) {
            try {
              section.render(sidebarDiv, script, isEditMode, path);
            } catch (e) {
              console.error("Fountain: Error rendering sidebar section", e);
            }
          }
        }
      }
    });
  }

  protected async onOpen(): Promise<void> {
    this.updateToc();
  }

  protected async onClose(): Promise<void> {
    // nothing to clean up
  }
}
