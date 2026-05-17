import { App, ItemView, Menu, Modal, Setting, TFile, type WorkspaceLeaf, debounce, setIcon, Notice } from "obsidian";
import { findFountainViewsForPath } from "../edit_pipeline";
import { FountainConfirmModal } from "../modals/confirm_modal";
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
import { sanitizeSnippets } from "../fountain/sanitizer";

export const VIEW_TYPE_SIDEBAR = "fountain-sidebar";

/** Manages floating snapshots of screenplay content when hovering over sidebar items. */
class HoverPreviewManager {
  private tooltipEl: HTMLElement | null = null;
  private timeout: number | null = null;

  setup(target: HTMLElement, contentProvider: (container: HTMLElement) => void) {
    target.addEventListener("mouseenter", () => {
      if (this.timeout) window.clearTimeout(this.timeout);
      this.timeout = window.setTimeout(() => {
        this.show(target, contentProvider);
      }, 500);
    });

    target.addEventListener("mouseleave", () => this.hide());
    target.addEventListener("mousedown", () => this.hide());
  }

  private show(target: HTMLElement, contentProvider: (container: HTMLElement) => void) {
    this.hide();

    this.tooltipEl = document.body.createDiv({ cls: "fountain-hover-preview" });
    contentProvider(this.tooltipEl);

    const rect = target.getBoundingClientRect();
    
    // Position to the left of the target (sidebar is on the right)
    this.tooltipEl.style.top = `${Math.max(10, rect.top)}px`;
    this.tooltipEl.style.right = `${window.innerWidth - rect.left + 15}px`;
    
    // Initial state for animation
    this.tooltipEl.style.opacity = "0";
    requestAnimationFrame(() => {
        if (this.tooltipEl) this.tooltipEl.style.opacity = "1";
    });
  }

  private hide() {
    if (this.timeout) {
      window.clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  }
}

interface SidebarCallbacks {
  scrollToRange: (range: Range) => void;
  getText: (range: Range) => string;
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
  hoverPreview: HoverPreviewManager;
  /** Open a character profile note. */
  openCharacterNote: (name: string, event: MouseEvent) => void;
  /** Check if a character has an associated profile note. */
  hasCharacterNote: (name: string) => boolean;
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

    container.createDiv({ cls: ["sidebar-section", "mode-section"] }, (div) => {
      div.createDiv({ cls: "section-title-bar", text: "COMPATIBILITY" });
      div.createDiv({ cls: "section-content" }, (content) => {
        content.createDiv({ cls: "mode-value", text: modeName });
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

    container.createDiv({ cls: "sidebar-section" }, (div) => {
      div.createDiv({ cls: "section-title-bar", text: "THE PULSE" });
      div.createDiv({ cls: "section-content" }, (content) => {
        content.createDiv({ cls: "metrics-grid" }, (grid) => {
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
        content.createDiv({ cls: "balance-container" }, (balance) => {
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

    container.createDiv({ cls: ["sidebar-section", "boneyard-container", this.collapsed ? "is-collapsed" : ""] }, (sectionDiv) => {
      sectionDiv.createDiv({ cls: "section-title-bar", text: "BONEYARD" }).addEventListener("click", () => {
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
        const contentArea = sectionDiv.createDiv({ cls: "sidebar-content-area" });
        boneyard.forEach((block, i) => {
          contentArea.createDiv({ cls: ["boneyard-item", "sidebar-card"] }, (item) => {
            // Header row: title + hover-revealed quick action
            item.createDiv({ cls: "boneyard-header" }, (header) => {
              header.createSpan({ text: block.title || `Omission ${i + 1}`, cls: "boneyard-title" });
              header.createDiv({ cls: "boneyard-actions" }, (actions) => {
                actions.createEl("button", {
                  cls: "snippet-action-btn",
                  attr: { title: "Restore to Script" }
                }, (btn) => {
                  setIcon(btn, "corner-up-left");
                  btn.addEventListener("click", (e) => {
                    e.stopPropagation();
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
              });
            });

            item.addEventListener("click", () => {
              this.callbacks.scrollToRange(block.range);
            });

            item.addEventListener("contextmenu", (evt) => {
              evt.preventDefault();
              const menu = new Menu();

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

              menu.addSeparator();

              menu.addItem((mitem) => {
                mitem
                  .setTitle("Delete Omission")
                  .setIcon("trash")
                  .onClick(() => {
                    new FountainConfirmModal(
                      this.callbacks.app,
                      "Delete Boneyard Omission",
                      "Are you sure you want to delete this boneyard omission?",
                      () => {
                        this.callbacks.replaceText(block.range, "");
                        this.callbacks.requestSave();
                        this.callbacks.reRender();
                      },
                    ).open();
                  });
              });

              menu.showAtMouseEvent(evt);
            });

            // Hover Preview
            this.callbacks.hoverPreview.setup(item, (container) => {
              const fullText = script.sliceDocument(block.range).replace(/\/\*|\*\//g, "").trim();
              container.setText(fullText);
            });

            // Preview row
            const previewText = script.sliceDocument(block.range).replace(/\/\*|\*\//g, "").trim().slice(0, 80);
            item.createDiv({ cls: "boneyard-preview", text: previewText + (previewText.length >= 80 ? "..." : "") });
          });
        });
        // Boneyard status bar
        const omissionCount = boneyard.length;
        sectionDiv.createDiv({ cls: "sidebar-footer" }, (footer) => {
          footer.createSpan({
            cls: "sidebar-status-text",
            text: `${omissionCount} omission${omissionCount !== 1 ? "s" : ""} in boneyard`,
          });
        });
      }
    });
  }
}

class SnippetsSection extends SidebarSection {
  private searchQuery = "";
  private listContainerEl: HTMLElement | null = null;

  render(
    container: HTMLElement,
    script: FountainScript,
    _isEditMode: boolean,
    _path: string,
  ): void {
    const structure = script.structure();
    const hasSnippets = structure.snippets && structure.snippets.length > 0;
    
    container.createDiv(
      { cls: ["sidebar-section", "snippets-container", !hasSnippets ? "is-empty" : ""] },
      (sectionDiv) => {
        sectionDiv.addClass("screenplay-snippets");

        
        sectionDiv.createDiv({ cls: "section-title-bar", text: "SNIPPETS" });

        // Search Bar (Fixed at top)
        if (hasSnippets) {
          sectionDiv.createDiv({ cls: "snippet-search-container" }, (searchDiv) => {
            const input = searchDiv.createEl("input", {
              attr: { type: "text", placeholder: "Search snippets...", value: this.searchQuery },
              cls: "snippet-search-input",
            });
            input.addEventListener("input", (e) => {
              this.searchQuery = (e.target as HTMLInputElement).value;
              if (this.listContainerEl) {
                this.renderFilteredList(this.listContainerEl, script);
              }
            });
          });
        }

        // Content Area (Scrollable)
        this.listContainerEl = sectionDiv.createDiv({ cls: "sidebar-content-area" });
        this.renderFilteredList(this.listContainerEl, script);

        // Footer / Status Bar (Pinned to bottom)
        sectionDiv.createDiv({ cls: "sidebar-footer" }, (footer) => {
          if (structure.health.needsSanitization) {
            footer.addClass("is-warning");
            const warningText = footer.createSpan({ 
                text: "⚠️ Structure issues detected.",
                cls: "sidebar-status-text"
            });
            warningText.setAttr("title", structure.health.errors.join("\n"));
            
            footer.createEl("button", {
                text: "Fix Now",
                cls: "sidebar-status-button"
            }).addEventListener("click", () => {
                const view = this.callbacks.getView();
                if (view) {
                    sanitizeSnippets(view);
                    new Notice("Document sanitized and snippets consolidated.");
                }
            });
          } else {
            footer.createSpan({ 
                text: "Drag and drop selection here to create a snippet",
                cls: "sidebar-status-text"
            });
          }
        });

        // Add drop handling to the whole section
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
      },
    );
  }

  private renderFilteredList(contentArea: HTMLElement, script: FountainScript) {
    contentArea.empty();
    const snippets = script.structure().snippets || [];
    const filteredSnippets = snippets.filter(s => {
      if (!this.searchQuery) return true;
      const q = this.searchQuery.toLowerCase();
      const content = s.content.map(el => script.sliceDocument(el.range)).join(" ").toLowerCase();
      return (s.title?.toLowerCase().includes(q) || 
              s.category?.toLowerCase().includes(q) || 
              content.includes(q));
    });

    if (filteredSnippets.length === 0) {
      contentArea.createEl("div", {
        text: this.searchQuery ? "No matches found" : "No snippets found",
        cls: "snippets-instruction",
      });
    } else {
      for (let i = 0; i < filteredSnippets.length; i++) {
        this.renderSnippet(contentArea, script, filteredSnippets[i], i);
      }
    }
  }

  private renderSnippet(
    parent: HTMLElement,
    script: FountainScript,
    snippet: Snippet,
    index: number,
  ): void {
    parent.createDiv({ cls: ["snippet-item", "sidebar-card"] }, (snippetDiv) => {
      snippetDiv.createDiv({ cls: "snippet-header" }, (header) => {
        header.createSpan({ text: snippet.title || `Snippet ${index + 1}`, cls: "snippet-title" });
        
        // Actions container
        header.createDiv({ cls: "snippet-actions" }, (actions) => {
          actions.createEl("button", {
            cls: "snippet-action-btn",
            attr: { title: "Insert at cursor" }
          }, (btn) => {
            setIcon(btn, "plus-circle");
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              this.insertSnippetAtCursor(script, snippet);
            });
          });
        });
      });

      snippetDiv.addEventListener("click", () => {
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

        if (snippet.category !== "Beat JSON") {
          menu.addItem((mitem) => {
            mitem
              .setTitle("Insert at Cursor")
              .setIcon("plus-circle")
              .onClick(() => this.insertSnippetAtCursor(script, snippet));
          });
        }

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

      // Hover Preview
      this.callbacks.hoverPreview.setup(snippetDiv, (container) => {
        if (snippet.category === "Beat JSON" && snippet.text) {
          container.setText(snippet.text);
        } else if (snippet.bodyRange) {
          container.setText(script.sliceDocument(snippet.bodyRange).trim());
        } else if (snippet.range) {
          container.setText(script.sliceDocument(snippet.range).trim());
        }
      });

      snippetDiv.createDiv({ cls: "snippet-preview" }, (preview) => {
        if (snippet.content.length > 0) {
          const firstLine = script.sliceDocument(snippet.content[0].range).trim().slice(0, 100);
          preview.setText(firstLine + (firstLine.length >= 100 ? "..." : ""));
        } else if (snippet.text) {
          const firstLine = snippet.text.trim().slice(0, 100);
          preview.setText(firstLine + (firstLine.length >= 100 ? "..." : ""));
        }
      });
    });
  }

  private insertSnippetAtCursor(script: FountainScript, snippet: Snippet) {
    let text = "";
    if (snippet.category === "Beat JSON" && snippet.text) {
      text = snippet.text;
    } else if (snippet.bodyRange) {
      text = script.sliceDocument(snippet.bodyRange).trim();
    } else if (snippet.range) {
        // Fallback for older snippets or if bodyRange is missing
        text = script.sliceDocument(snippet.range).trim();
        // If it still starts with ###, try to strip it
        if (text.startsWith("###")) {
            text = text.replace(/^###.*?\n/, "").trim();
        }
    }
    
    if (text) {
      this.callbacks.insertTextAtCursor(text);
      new Notice(`Inserted "${snippet.title}" at cursor.`);
    }
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
    new FountainConfirmModal(
      this.callbacks.app,
      "Delete Snippet",
      "Are you sure you want to delete this snippet?",
      () => {
        const view = this.callbacks.getView();
        if (!view) return;
        const adapter =
          snippet.category === "Beat JSON"
            ? new BeatAdapter()
            : new FountainAdapter();
        adapter.deleteSnippet(view, snippet);

        this.callbacks.requestSave();
        this.callbacks.reRender();
      },
    ).open();
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
    container.createDiv({ cls: ["sidebar-section", "toc-container"] }, (sectionDiv) => {
      sectionDiv.createDiv({ cls: "section-title-bar", text: "TABLE OF CONTENTS" });
      const scrollArea = sectionDiv.createDiv({ cls: "sidebar-content-area" });
      scrollArea.createDiv({ cls: "screenplay-toc" }, (div) => {
        div.createDiv({ cls: "toc-controls" }, (tocControls) => {
          // Todos pill toggle
          tocControls.createEl("label", { cls: "toc-toggle-label" }, (label) => {
            const cbTodos = label.createEl("input", {
              type: "checkbox",
              attr: { ...(this.showTodos ? { checked: "" } : {}) },
            });
            label.createSpan({ text: "Todos" });
            cbTodos.addEventListener("change", () => {
              this.showTodos = cbTodos.checked;
              for (const el of container.querySelectorAll<HTMLElement>(".todo")) {
                el.toggle(this.showTodos);
              }
            });
          });
          // Synopsis pill toggle
          tocControls.createEl("label", { cls: "toc-toggle-label" }, (label) => {
            const cbSynopsis = label.createEl("input", {
              type: "checkbox",
              attr: { ...(this.showSynopsis ? { checked: "" } : {}) },
            });
            label.createSpan({ text: "Synopsis" });
            cbSynopsis.addEventListener("change", () => {
              this.showSynopsis = cbSynopsis.checked;
              for (const el of container.querySelectorAll<HTMLElement>(".synopsis, .preview")) {
                el.toggle(this.showSynopsis);
              }
            });
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

      // TOC status bar
      const sections = script.structure().sections;
      const sceneCount = sections.reduce((acc, s) => acc + s.content.filter(e => e.scene).length, 0);
      const sectionCount = sections.filter(s => s.section).length;
      sectionDiv.createDiv({ cls: "sidebar-footer" }, (footer) => {
        footer.createSpan({
          cls: "sidebar-status-text",
          text: `${sceneCount} scene${sceneCount !== 1 ? "s" : ""} · ${sectionCount} section${sectionCount !== 1 ? "s" : ""}`,
        });
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

          // Hover Preview
          this.callbacks.hoverPreview.setup(d, (container) => {
            const fullText = script.sliceDocument(el.range).trim();
            container.setText(fullText);
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

    container.createDiv({ cls: ["sidebar-section", "characters-container"] }, (sectionDiv) => {
      sectionDiv.addClass("screenplay-characters");

      sectionDiv.createDiv({ cls: "section-title-bar", text: "CHARACTERS" });

      const activeChar = this.callbacks.getSpotlightCharacter();

      for (const char of characters) {
        sectionDiv.createDiv(
          {
            cls: ["character-stat", ...(activeChar && activeChar === char.name ? ["active"] : [])],
          },
          (charDiv) => {
            charDiv.createSpan({ cls: "char-name", text: char.name });

            charDiv.addEventListener("click", (evt) => {
              if (evt.metaKey || evt.ctrlKey) {
                this.callbacks.openCharacterNote(char.name, evt);
              } else {
                this.callbacks.toggleSpotlight(char.name);
              }
            });

            // "Open Note" icon (visible on hover via CSS)
            charDiv.createDiv({ cls: "open-note-icon" }, (iconDiv) => {
              setIcon(iconDiv, "eye");
              if (!this.callbacks.hasCharacterNote(char.name)) {
                iconDiv.addClass("no-note");
              }
              iconDiv.addEventListener("click", (evt) => {
                evt.stopPropagation();
                this.callbacks.openCharacterNote(char.name, evt);
              });
            });

            charDiv.createSpan({
              cls: "char-count",
              text: `${char.dialogueCount}`,
            });
          },
        );
      }
    });
  }
}

export class FountainSideBarView extends ItemView {
  private updateToc: () => void;
  private sections: SidebarSection[];
  private hoverPreviewManager: HoverPreviewManager;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.hoverPreviewManager = new HoverPreviewManager();
    this.sections = [
      new ModeSection(this.sidebarCallbacks()),
      new MetricsSection(this.sidebarCallbacks()),
      new TocSection(this.sidebarCallbacks()),
      new CharactersSection(this.sidebarCallbacks()),
      new BoneyardSection(this.sidebarCallbacks()),
      new SnippetsSection(this.sidebarCallbacks()),
    ];

    this.updateToc = debounce(() => this.onFileChange(), 500, true);
  }

  private sidebarCallbacks(): SidebarCallbacks {
    return {
      scrollToRange: (r) => {
        const view = this.theFountainView();
        if (view) view.scrollToHere(r);
      },
      getText: (r) => {
        const view = this.theFountainView();
        return view ? view.getText(r) : "";
      },
      readFromFile: async (path, range) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          const content = await this.app.vault.read(file);
          return content.slice(range.start, range.end);
        }
        return null;
      },
      insertAfterSnippetsHeader: (text) => {
        const view = this.theFountainView();
        if (view) {
          const adapter = getActiveAdapter(view.getScript());
          adapter.addSnippet(view, text);
          this.onFileChange();
        }
      },
      toggleSpotlight: (character) => {
        const view = this.theFountainView();
        if (view) {
          if (view.spotlightCharacter() === character) {
            view.stopSpotlightMode();
          } else {
            view.startSpotlightMode(character);
          }
          this.onFileChange();
        }
      },
      getSpotlightCharacter: () => {
        const view = this.theFountainView();
        return view ? view.spotlightCharacter() : null;
      },
      moveSceneAcross: (args) => {
        const view = this.theFountainView();
        if (view) view.moveSceneAcross(args);
      },
      reRender: () => this.onFileChange(),
      requestSave: () => {
        const view = this.theFountainView();
        if (view) view.requestSave();
      },
      replaceText: (r, s) => {
        const view = this.theFountainView();
        if (view) view.replaceText(r, s);
      },
      insertTextAtCursor: (s) => {
          const view = this.theFountainView();
          if (view) view.insertTextAtCursor(s);
      },
      getScript: () => {
        const view = this.theFountainView();
        return view ? view.getScript() : (null as any);
      },
      app: this.app,
      focusEditor: () => {
        const view = this.theFountainView();
        if (view) view.focusEditor();
      },
      getView: () => this.theFountainView(),
      hoverPreview: this.hoverPreviewManager,
      openCharacterNote: (name, event) => {
        const view = this.theFountainView();
        if (view) view.openCharacterNote(name, event);
      },
      hasCharacterNote: (name) => {
        const view = this.theFountainView();
        return view ? view.hasCharacterNote(name) : false;
      },
    };
  }

  private theFountainView(): FountainView | null {
    const leaf = this.app.workspace.getMostRecentLeaf(
      this.app.workspace.rootSplit,
    );
    if (leaf && leaf.view instanceof FountainView) {
      return leaf.view;
    }
    return null;
  }

  getViewType(): string {
    return VIEW_TYPE_SIDEBAR;
  }

  getDisplayText(): string {
    return "Fountain Sidebar";
  }

  getIcon(): string {
    return "layout-side-right";
  }

  async onOpen() {
    this.registerEvent(this.app.workspace.on("layout-change", this.updateToc));
    this.registerEvent(this.app.vault.on("modify", this.updateToc));
    this.onFileChange();
  }

  onFileChange() {
    const view = this.theFountainView();
    const script = view?.getScript();
    const path = view?.file?.path || "";
    if (script && !("error" in script)) {
      this.render(script, view?.isEditMode() || false, path);
    } else {
      this.contentEl.empty();
      this.contentEl.createDiv({
        text: "Open a fountain file to see metrics and navigation",
        cls: "fountain-sidebar-empty",
      });
    }
  }

  render(script: FountainScript, isEditMode: boolean, path: string) {
    this.contentEl.empty();
    const container = this.contentEl.createDiv({ cls: ["sidebar-container", "fountain-sidebar"] });
    for (const section of this.sections) {
      section.render(container, script, isEditMode, path);
    }
  }
}
