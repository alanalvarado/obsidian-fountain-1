import type {
  FountainScript,
  Range,
  StructureSection,
  Synopsis,
} from "../fountain";
import { dataRange, extractNotes } from "../fountain";
import { formatEighths } from "../fountain/metrics";
import { FountainView } from "../views/fountain_view";
import { getScenePreview } from "../views/render_tools";
import { styledTextToHtml } from "../views/styled_text";
import { SidebarSection, SidebarCallbacks } from "./base";

export class TocSection extends SidebarSection {
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
          d.addClass(`beat-color-${sect.color}`);
          d.style.setProperty(
            "--item-color",
            sect.color.startsWith("#")
              ? sect.color
              : `var(--beat-color-${sect.color})`,
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
            d.addClass(`beat-color-${el_scene.color}`);
            d.style.setProperty(
              "--item-color",
              el_scene.color.startsWith("#")
                ? el_scene.color
                : `var(--beat-color-${el_scene.color})`,
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
