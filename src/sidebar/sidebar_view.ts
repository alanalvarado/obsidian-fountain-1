import { App, ItemView, Menu, Modal, Setting, TFile, type WorkspaceLeaf, debounce, setIcon } from "obsidian";
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
import { moveSelectionToSnippets } from "../commands/format_commands";
import { BeatAdapter } from "../compatibility/beat_adapter";
import { FountainAdapter } from "../compatibility/fountain_adapter";
import { getActiveAdapter } from "../compatibility/registry";

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
  replaceText: (range: Range, replacement: string) => void;
  insertTextAtCursor: (text: string) => void;
  getScript: () => FountainScript;
  app: App;
  focusEditor: () => void;
  getView: () => FountainView | null;
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

class ModeSection extends SidebarSection {
  render(
    container: HTMLElement,
    script: FountainScript,
    _isEditMode: boolean,
    _path: string,
  ): void {
    const isBeat = getActiveAdapter(script) instanceof BeatAdapter;
    const modeName = isBeat ? "BEAT APP" : "FOUNTAIN NATIVE";

    container.createDiv({ cls: ["metrics-section", "mode-section"] }, (div) => {
      div.createDiv({ cls: "metrics-header", text: "COMPATIBILITY" });
      div.createDiv({ 
        cls: "metric-value", 
        text: modeName,
        attr: { style: "font-size: 14px; text-align: center; margin-top: 4px;" } 
      });
    });
  }
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

class RenameModal extends Modal {
  private result: string;
  constructor(app: App, private initialValue: string, private onSubmit: (value: string) => void) {
    super(app);
    this.result = initialValue;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h1", { text: "Rename Snippet" });

    new Setting(contentEl)
      .setName("New title")
      .addText((text) =>
        text
          .setValue(this.initialValue)
          .onChange((value) => {
            this.result = value;
          })
          .inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              this.close();
              this.onSubmit(this.result);
            }
          })
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Rename")
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(this.result);
        })
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class BoneyardSection extends SidebarSection {
  private collapsed = false;

  render(
    container: HTMLElement,
    script: FountainScript,
    _isEditMode: boolean,
    _path: string,
  ): void {
    const structure = script.structure();
    const boneyard = structure.boneyard || [];

    container.createDiv({ cls: ["metrics-section", "boneyard-container", this.collapsed ? "is-collapsed" : ""] }, (sectionDiv) => {
      sectionDiv.createDiv({ cls: "metrics-header", text: "BONEYARD" }).addEventListener("click", () => {
        this.collapsed = !this.collapsed;
        this.callbacks.reRender();
      });

      if (boneyard.length === 0) {
        sectionDiv.createEl("div", {
          text: "No in-line boneyard found",
          cls: "snippets-instruction",
        });
        return;
      }

      if (!this.collapsed) {
        boneyard.forEach((block, i) => {
          sectionDiv.createDiv({ cls: "boneyard-item" }, (item) => {
            item.createSpan({ text: block.title || `Omission ${i + 1}`, cls: "boneyard-title" });
            
            item.addEventListener("click", () => {
              this.callbacks.scrollToRange(block.range);
            });

            item.addEventListener("contextmenu", (evt) => {
              evt.preventDefault();
              const menu = new Menu();
              
              menu.addItem((mitem) => {
                mitem
                  .setTitle("Jump to Script")
                  .setIcon("arrow-up-right")
                  .onClick(() => this.callbacks.scrollToRange(block.range));
              });

              menu.addSeparator();

              menu.addItem((mitem) => {
                mitem
                  .setTitle("Restore to Script")
                  .setIcon("corner-up-left")
                  .onClick(() => {
                    const fullText = script.sliceDocument(block.range);
                    let newText = fullText;
                    if (fullText.startsWith("/*") && fullText.endsWith("*/")) {
                      newText = fullText.slice(2, -2).trim();
                    }
                    this.callbacks.replaceText(block.range, newText);
                    this.callbacks.requestSave();
                    this.callbacks.reRender();
                    this.callbacks.focusEditor();
                  });
              });

              menu.addItem((mitem) => {
                mitem
                  .setTitle("Delete Omission")
                  .setIcon("trash")
                  .onClick(() => {
                    if (confirm("Are you sure you want to delete this boneyard omission?")) {
                      this.callbacks.replaceText(block.range, "");
                      this.callbacks.requestSave();
                      this.callbacks.reRender();
                    }
                  });
              });

              menu.showAtMouseEvent(evt);
            });

            const previewText = script.sliceDocument(block.range).replace(/\/\*|\*\//g, "").trim().slice(0, 80);
            item.createDiv({ cls: "boneyard-preview", text: previewText + (previewText.length >= 80 ? "..." : "") });
          });
        });
      }
    });
  }
}

class SnippetsSection extends SidebarSection {
  private searchQuery = "";
  private collapsedCategories = new Set<string>();

  render(
    container: HTMLElement,
    script: FountainScript,
    isEditMode: boolean,
    path: string,
  ): void {
    const structure = script.structure();
    const hasSnippets = structure.snippets && structure.snippets.length > 0;
    
    container.createDiv(
      { cls: ["metrics-section", "snippets-container"] },
      (sectionDiv) => {
        sectionDiv.addClass("screenplay-snippets");
        
        sectionDiv.createDiv({ cls: "metrics-header", text: "SNIPPETS" });

        // Add search bar
        if (hasSnippets) {
          sectionDiv.createDiv({ cls: "snippet-search-container" }, (searchDiv) => {
            const input = searchDiv.createEl("input", {
              attr: { type: "text", placeholder: "Search snippets...", value: this.searchQuery },
              cls: "snippet-search-input",
            });
            input.addEventListener("input", (e) => {
              this.searchQuery = (e.target as HTMLInputElement).value;
              this.callbacks.reRender();
            });
          });
        }

        // Add drop handling
        sectionDiv.addEventListener("dragover", (event) => {
          event.preventDefault();
          sectionDiv.addClass("drag-over");
        });

        sectionDiv.addEventListener("dragleave", (event) => {
          sectionDiv.removeClass("drag-over");
        });

        sectionDiv.addEventListener("drop", async (event) => {
          event.preventDefault();
          sectionDiv.removeClass("drag-over");

          const json = event.dataTransfer?.getData("application/json");
          if (json) {
            try {
              const { path, range } = JSON.parse(json) as {
                path: string;
                range: Range;
              };
              const text = await this.callbacks.readFromFile(path, range);
              if (text) {
                this.callbacks.insertAfterSnippetsHeader(text);
              }
            } catch {
            }
            return;
          }

          const droppedText = event.dataTransfer?.getData("text/plain");
          if (droppedText) {
            this.callbacks.insertAfterSnippetsHeader(droppedText);
          }
        });

        if (hasSnippets) {
          const filteredSnippets = structure.snippets.filter(s => {
            if (!this.searchQuery) return true;
            const q = this.searchQuery.toLowerCase();
            const content = s.content.map(el => script.sliceDocument(el.range)).join(" ").toLowerCase();
            return (s.title?.toLowerCase().includes(q) || 
                    s.category?.toLowerCase().includes(q) || 
                    content.includes(q));
          });

          if (filteredSnippets.length === 0) {
             sectionDiv.createEl("div", {
              text: "No matches found",
              cls: "snippets-instruction",
            });
            return;
          }

          // Render all snippets directly as a list (no categories)
          for (let i = 0; i < filteredSnippets.length; i++) {
            this.renderSnippet(sectionDiv, script, filteredSnippets[i], i);
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
    parent.createDiv({ cls: "snippet-item" }, (snippetDiv) => {
      snippetDiv.createDiv({ cls: "snippet-header" }, (header) => {
        header.createSpan({ text: snippet.title || `Snippet ${index + 1}`, cls: "snippet-title" });
        
        header.addEventListener("click", () => {
          if (snippet.category === "Beat JSON" && snippet.text) {
            this.callbacks.insertTextAtCursor(snippet.text);
          } else {
            this.callbacks.scrollToRange(snippet.range);
          }
        });

        snippetDiv.addEventListener("contextmenu", (evt) => {
          evt.preventDefault();
          const menu = new Menu();

          menu.addItem((mitem) => {
            mitem
              .setTitle(snippet.category === "Beat JSON" ? "Insert Snippet" : "Jump to Script")
              .setIcon(snippet.category === "Beat JSON" ? "plus-circle" : "arrow-up-right")
              .onClick(() => {
                if (snippet.category === "Beat JSON" && snippet.text) {
                  this.callbacks.insertTextAtCursor(snippet.text);
                } else {
                  this.callbacks.scrollToRange(snippet.range);
                }
              });
          });

          menu.addItem((mitem) => {
            mitem
              .setTitle("Rename Snippet")
              .setIcon("pencil")
              .onClick(() => this.renameSnippet(snippet));
          });

          menu.addSeparator();

          menu.addItem((mitem) => {
            mitem
              .setTitle("Delete Snippet")
              .setIcon("trash")
              .onClick(() => this.deleteSnippet(snippet));
          });

          menu.showAtMouseEvent(evt);
        });
      });

      snippetDiv.createDiv({ cls: "snippet-preview" }, (preview) => {
        // Just show first line of content
        if (snippet.content.length > 0) {
          const firstLine = script.sliceDocument(snippet.content[0].range).trim().slice(0, 100);
          preview.setText(firstLine + (firstLine.length >= 100 ? "..." : ""));
        }
      });
    });
  }

  private renameSnippet(snippet: Snippet) {
    new RenameModal(this.callbacks.app, snippet.title || "", (newTitle) => {
      const view = this.callbacks.getView();
      if (!view) return;
      const adapter = snippet.category === "Beat JSON" ? new BeatAdapter() : new FountainAdapter();
      adapter.renameSnippet(view, snippet, newTitle);
      
      this.callbacks.requestSave();
      this.callbacks.reRender();
    }).open();
  }

  private deleteSnippet(snippet: Snippet) {
    if (!confirm("Are you sure you want to delete this snippet?")) return;
    
    const view = this.callbacks.getView();
    if (!view) return;
    const adapter = snippet.category === "Beat JSON" ? new BeatAdapter() : new FountainAdapter();
    adapter.deleteSnippet(view, snippet);
    
    this.callbacks.requestSave();
    this.callbacks.reRender();
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
    container.createDiv({ cls: ["metrics-section", "toc-container"] }, (sectionDiv) => {
      sectionDiv.createDiv({ cls: "metrics-header", text: "TABLE OF CONTENT" });
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
      const ft = this.theFountainView();
      if (ft && ft.file && ft.file.path === dragData.path && dragData.range.start === range.start) return;

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

  private theFountainView(): FountainView | null {
    const leaf = this.callbacks.app.workspace.getMostRecentLeaf(
      this.callbacks.app.workspace.rootSplit,
    );
    if (leaf && leaf.view instanceof FountainView) {
      return leaf.view;
    }
    return null;
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

    container.createDiv({ cls: ["metrics-section", "characters-container"] }, (sectionDiv) => {
      sectionDiv.addClass("screenplay-characters");

      sectionDiv.createDiv({ cls: "metrics-header", text: "CHARACTERS" });

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

    this.sections = [
      new ModeSection(this.callbacks()),
      new MetricsSection(this.callbacks()),
      new TocSection(this.callbacks()),
      new CharactersSection(this.callbacks()),
      new BoneyardSection(this.callbacks()),
      new SnippetsSection(this.callbacks()),
    ];
  }

  private callbacks(): SidebarCallbacks {
    return {
      scrollToRange: (range: Range) => this.scrollActiveScriptToHere(range),
      getText: (range: Range) => this.getText(range),
      getScript: () =>
        this.theFountainView()?.getScript() ??
        ({ error: "No script" } as any),
      readFromFile: (path: string, range: Range) =>
        this.readFromFile(path, range),
      insertAfterSnippetsHeader: (text: string) =>
        this.insertAfterSnippetsHeader(text),
      toggleSpotlight: (character: string) => this.toggleSpotlight(character),
      getSpotlightCharacter: () =>
        this.theFountainView()?.spotlightCharacter() ?? null,
      moveSceneAcross: (args) => this.moveSceneAcross(args),
      reRender: () => this.render(),
      requestSave: () => this.app.workspace.requestSaveLayout(),
      replaceText: (range: Range, replacement: string) =>
        this.theFountainView()?.replaceText(range, replacement),
      insertTextAtCursor: (text: string) =>
        this.theFountainView()?.insertTextAtCursor(text),
      app: this.app,
      focusEditor: () => this.theFountainView()?.focusEditor(),
      getView: () => this.theFountainView() || null,
    };
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

  /**
   * Appends text to the snippets library, respecting the current storage mode.
   */
  private async insertAfterSnippetsHeader(text: string) {
    const ft = this.theFountainView();
    if (!ft) return;

    const script = ft.getScript();
    if ("error" in script) return;

    const isBeat = getActiveAdapter(script) instanceof BeatAdapter;
    const storage = isBeat ? "beat" : "fountain";

    await moveSelectionToSnippets(this.app, ft, false, storage, text);
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
          const path = ft.file?.path ?? "";
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
