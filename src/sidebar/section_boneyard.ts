import { Menu, setIcon } from "obsidian";
import { FountainConfirmModal } from "../modals/confirm_modal";
import type { FountainScript } from "../fountain";
import { SidebarSection } from "./base";

export class BoneyardSection extends SidebarSection {
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
              header.createSpan({ text: block.title || `Boneyard Block ${i + 1}`, cls: "boneyard-title" });
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
                  .setTitle("Delete from Boneyard")
                  .setIcon("trash")
                  .onClick(() => {
                    new FountainConfirmModal(
                      this.callbacks.app,
                      "Delete Boneyard Block",
                      "Are you sure you want to delete this boneyard block?",
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
        const boneyardBlockCount = boneyard.length;
        sectionDiv.createDiv({ cls: "sidebar-footer" }, (footer) => {
          footer.createSpan({
            cls: "sidebar-status-text",
            text: `${boneyardBlockCount} boneyard block${boneyardBlockCount !== 1 ? "s" : ""}`,
          });
        });
      }
    });
  }
}
