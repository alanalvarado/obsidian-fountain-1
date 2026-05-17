import { App, Menu, Modal, Notice, Setting, setIcon } from "obsidian";
import { FountainConfirmModal } from "../modals/confirm_modal";
import type { FountainScript, Range, Snippet } from "../fountain";
import { FountainAdapter } from "../compatibility/fountain/fountain_adapter";
import { sanitizeSnippets } from "../fountain/sanitizer";
import { SidebarSection } from "./base";

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

export class SnippetsSection extends SidebarSection {
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
        this.callbacks.scrollToRange(snippet.range);
      });

      snippetDiv.addEventListener("contextmenu", (evt) => {
        evt.preventDefault();
        const menu = new Menu();

        menu.addItem((mitem) => {
          mitem
            .setTitle("Jump to Script")
            .setIcon("arrow-up-right")
            .onClick(() => {
              this.callbacks.scrollToRange(snippet.range);
            });
        });

        menu.addItem((mitem) => {
          mitem
            .setTitle("Insert at Cursor")
            .setIcon("plus-circle")
            .onClick(() => this.insertSnippetAtCursor(script, snippet));
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

      this.callbacks.hoverPreview.setup(snippetDiv, (container) => {
        if (snippet.bodyRange) {
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
    if (snippet.bodyRange) {
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
      const adapter = new FountainAdapter();
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
        const adapter = new FountainAdapter();
        adapter.deleteSnippet(view, snippet);

        this.callbacks.requestSave();
        this.callbacks.reRender();
      },
    ).open();
  }
}
