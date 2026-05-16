import {
  App,
  ButtonComponent,
  type MarkdownPostProcessorContext,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";
import {
  executeRemovalCommand,
  generatePDFCommand,
  ifFountainFile,
  ifFountainView,
  newDocumentCommand,
  openSidebar,
  openSidebarCommand,
} from "./commands";
import { toggleBoneyardComment } from "./commands/boneyard_commands";
import { moveSelectionToSnippets, convertDocumentFormat } from "./commands/format_commands";
import { BeatAdapter } from "./compatibility/beat_adapter";
import { FountainAdapter } from "./compatibility/fountain_adapter";
import { setActiveAdapter } from "./compatibility/registry";
import { applyEditsToFountainFile } from "./edit_pipeline";
import type { Edit } from "./fountain";
import { parse } from "./fountain/parser";
import { LinkIndex } from "./links_index";
import { EditorViewState } from "./views/editor_view_state";
import { FountainView, VIEW_TYPE_FOUNTAIN } from "./views/fountain_view";
import { renderContent } from "./views/reading_view";
import { Logger } from "./logger";
import {
  FountainSideBarView,
  VIEW_TYPE_SIDEBAR,
} from "./sidebar/sidebar_view";

export interface FountainSettings {
  compatibilityMode: "fountain" | "beat";
  debugMode: boolean;
}

const DEFAULT_SETTINGS: FountainSettings = {
  compatibilityMode: "fountain",
  debugMode: false,
};

export default class FountainPlugin extends Plugin {
  settings: FountainSettings;
  private linkIndex?: LinkIndex;

  async onload() {
    await this.loadSettings();
    Logger.initialize(this.settings.debugMode);
    this.updateActiveAdapter();
    this.registerView(VIEW_TYPE_FOUNTAIN, (leaf) => new FountainView(leaf));
    this.registerExtensions(["fountain"], VIEW_TYPE_FOUNTAIN);
    this.registerView(
      VIEW_TYPE_SIDEBAR,
      (leaf) => new FountainSideBarView(leaf),
    );
    this.registerCommands();
    this.linkIndex = new LinkIndex(this.app);
    this.app.workspace.onLayoutReady(() => {
      openSidebar(this.app);
      this.linkIndex?.initialize();
      this.installFountainMdAutoRename();
    });
    this.registerMarkdownPostProcessor(this.markdownPostProcessor);
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (view.getViewType() === VIEW_TYPE_FOUNTAIN) {
          this.addFountainMenuItems(menu, view as FountainView);
        }
      }),
    );
    this.registerEvent(
      this.app.workspace.on("fountain-menu", (menu, view) => {
        this.addFountainMenuItems(menu, view);
      }),
    );
    this.addSettingTab(new FountainSettingTab(this.app, this));

    // Register Explicit Format Conversion Commands
    this.addCommand({
      id: "fountain-convert-beat",
      name: "Convert Document to Beat Format",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(FountainView);
        if (view) {
          if (!checking) {
            convertDocumentFormat(view, "beat");
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: "fountain-convert-standard",
      name: "Convert Document to Standard Fountain",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(FountainView);
        if (view) {
          if (!checking) {
            new FountainConfirmModal(
              this.app,
              "Convert to Standard Fountain",
              "This will permanently scrub Beat compatibility tags (colors, markers) from this document. Proceed?",
              () => convertDocumentFormat(view, "fountain"),
            ).open();
          }
          return true;
        }
        return false;
      }
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.updateActiveAdapter();
  }

  private updateActiveAdapter() {
    const mode = this.settings.compatibilityMode || "fountain";
    Logger.initialize(this.settings.debugMode);
    setActiveAdapter(mode === "beat" ? new BeatAdapter() : new FountainAdapter());
  }

  /**
   * When the user follows an unresolved `[[foo.fountain]]` (or markdown)
   * link from a `.md` file, Obsidian's core link handler creates
   * `foo.fountain.md` regardless of whether `.fountain` is registered as a
   * view extension. There is no public API to override the extension that
   * Obsidian picks for new files created from links — see
   *   https://forum.obsidian.md/t/api-method-to-add-link-and-have-it-parsed-into-metadatacache/72046
   *
   * We work around this in two halves: rename empty `*.fountain.md` files
   * back to `.fountain` on disk, and force any leaf still showing a
   * `.fountain` file as a markdown view onto the registered fountain
   * view. Both halves are needed because the on-disk rename races with the
   * leaf-open call inside Obsidian's link-click flow — whichever finishes
   * first, the other half cleans up the stragglers.
   *
   * Re-check periodically whether an officially supported hook has shown
   * up and drop this code once it has.
   */
  private installFountainMdAutoRename() {
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (!(file instanceof TFile)) return;
        if (!file.name.toLowerCase().endsWith(".fountain.md")) return;
        if (file.stat.size > 0) return;
        const newPath = file.path.slice(0, -".md".length);
        if (this.app.vault.getAbstractFileByPath(newPath)) return;
        this.app.fileManager.renameFile(file, newPath).catch((err) => {
          console.error(
            "fountain: rename .fountain.md -> .fountain failed",
            err,
          );
        });
      }),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!file || file.extension !== "fountain") return;
        this.app.workspace.iterateAllLeaves((leaf) => {
          const view = leaf.view;
          // Only convert markdown leaves — Obsidian's right-sidebar views
          // (backlink, outgoing-link, outline) also expose `view.file` for
          // the active file, and matching them here would force-convert
          // them all to FountainView too.
          if (view.getViewType() !== "markdown") return;
          const viewFile = (view as { file?: TFile }).file;
          if (viewFile?.path !== file.path) return;
          void leaf.setViewState({
            type: VIEW_TYPE_FOUNTAIN,
            state: { file: file.path },
          });
        });
      }),
    );
  }

  async onunload() {
    // Note that there is no unregisterView or unregisterExtensions methods
    // because obsidian already does this automatically when the plugin is unloaded.
    this.linkIndex?.dispose();
    this.linkIndex = undefined;
  }

  applyEditsToFountainFile(path: string, edits: Edit[]): Promise<void> {
    return applyEditsToFountainFile(this.app, path, edits);
  }

  private markdownPostProcessor(
    element: HTMLElement,
    _context: MarkdownPostProcessorContext,
  ) {
    const codeblocks = element.findAll("code");

    for (const codeblock of codeblocks) {
      const parent = codeblock.parentElement;
      if (
        parent?.tagName === "PRE" &&
        codeblock.classList.contains("language-fountain")
      ) {
        const fountainText = codeblock.textContent || "";
        const container = createDiv({ cls: "screenplay" });
        const script = parse(fountainText, {});
        renderContent(container, script, {});
        parent.replaceWith(container);
      }
    }
  }

  private registerCommands() {
    this.addRibbonIcon("square-pen", "New fountain document", () => {
      newDocumentCommand(this.app);
    });
    this.addCommand({
      id: "new-fountain-document",
      name: "New fountain document",
      callback: () => {
        newDocumentCommand(this.app);
      },
    });
    this.addCommand({
      id: "generate-pdf",
      name: "Generate PDF",
      checkCallback: ifFountainFile(this.app, generatePDFCommand),
    });
    this.addCommand({
      id: "add-scene-numbers",
      name: "Add scene numbers",
      checkCallback: ifFountainView(this.app, (fv) => fv.addSceneNumbers()),
    });
    this.addCommand({
      id: "remove-scene-numbers",
      name: "Remove scene numbers",
      checkCallback: ifFountainView(this.app, (fv) => fv.removeSceneNumbers()),
    });
    this.addCommand({
      id: "remove-character-dialogue",
      name: "Remove character dialogue",
      checkCallback: ifFountainView(this.app, (fv) =>
        executeRemovalCommand(this.app, fv, "dialogue"),
      ),
    });
    this.addCommand({
      id: "remove-scenes-sections",
      name: "Remove scenes and sections",
      checkCallback: ifFountainView(this.app, (fv) =>
        executeRemovalCommand(this.app, fv, "structure"),
      ),
    });
    this.addCommand({
      id: "remove-element-types",
      name: "Remove element types",
      checkCallback: ifFountainView(this.app, (fv) =>
        executeRemovalCommand(this.app, fv, "types"),
      ),
    });
    this.addCommand({
      id: "open-sidebar",
      name: "Open sidebar",
      checkCallback: openSidebarCommand(this.app),
    });
    this.addCommand({
      id: "toggle-spell-check",
      name: "Toggle spell check",
      checkCallback: ifFountainView(this.app, (fv) => {
        const enabled = fv.toggleSpellCheck();
        new Notice(enabled ? "Spell check enabled" : "Spell check disabled");
      }),
    });
    this.addCommand({
      id: "toggle-index-cards-view",
      name: "Toggle index card view",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "i" }],
      checkCallback: ifFountainView(this.app, (fv) => {
        fv.toggleIndexCardsView();
      }),
    });
    this.addCommand({
      id: "select-current-scene",
      name: "Select current scene",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "l" }],
      checkCallback: (checking) => {
        const fv = this.app.workspace.getActiveViewOfType(FountainView);
        if (fv === null || !(fv.state instanceof EditorViewState)) return false;
        if (!checking) fv.state.selectCurrentScene();
        return true;
      },
    });
    this.addCommand({
      id: "send-to-boneyard",
      name: "Send selection to boneyard (In-line)",
      checkCallback: (checking) => {
        const fv = this.app.workspace.getActiveViewOfType(FountainView);
        if (fv === null || !fv.hasSelection()) return false;
        if (!checking) toggleBoneyardComment(fv);
        return true;
      },
    });
    this.addCommand({
      id: "move-to-snippets",
      name: "Move selection to snippets (Library)",
      checkCallback: (checking) => {
        const fv = this.app.workspace.getActiveViewOfType(FountainView);
        if (fv === null || !fv.hasSelection()) return false;
        if (!checking) moveSelectionToSnippets(this.app, fv, true, this.settings.snippetStorage);
        return true;
      },
    });
  }

  private addFountainMenuItems(menu: any, view: FountainView) {
    let isBoneyard = false;
    if (view.state instanceof EditorViewState) {
      const selection = view.state.getSelection();
      if (selection && selection.text) {
        const text = selection.text.trim();
        if (text.startsWith("/*") && text.endsWith("*/")) {
          isBoneyard = true;
        }
      }
    }

    menu.addItem((item: any) => {
      item
        .setTitle(isBoneyard ? "Restore from Boneyard" : "Send to Boneyard (In-line)")
        .setIcon(isBoneyard ? "corner-up-left" : "archive")
        .onClick(() => toggleBoneyardComment(view));
    });
    menu.addItem((item: any) => {
      item
        .setTitle("Move to Snippets (Library)")
        .setIcon("scissors")
        .onClick(() => moveSelectionToSnippets(this.app, view, true, this.settings.compatibilityMode));
    });
  }
}

class FountainSettingTab extends PluginSettingTab {
  plugin: FountainPlugin;

  constructor(app: App, plugin: FountainPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Fountain Plugin Settings" });

    new Setting(containerEl)
      .setName("Compatibility Mode")
      .setDesc("Choose the default format for new documents. Beat mode enables [[colors]], [[markers]], and Beat JSON. Note: Existing documents auto-detect their own format.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("fountain", "Standard Fountain")
          .addOption("beat", "Beat Compatibility")
          .setValue(this.plugin.settings.compatibilityMode)
          .onChange(async (value: "fountain" | "beat") => {
            this.plugin.settings.compatibilityMode = value;
            await this.plugin.saveSettings();

            // Re-render open views to reflect syntax highlighting changes, but DO NOT modify files automatically.
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FOUNTAIN);
            for (const leaf of leaves) {
              if (leaf.view instanceof FountainView) {
                // Trigger a full re-parse and re-render
                leaf.view.state.update();
                leaf.view.updateLines();
              }
            }
          }),
      );

    new Setting(containerEl)
      .setName("Debug Mode")
      .setDesc("Enable detailed diagnostic logging in the console.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.debugMode)
          .onChange(async (value) => {
            this.plugin.settings.debugMode = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}

/**
 * An in-app confirmation modal that replaces window.confirm().
 * Unlike the native OS dialog, this renders entirely within the Electron
 * window DOM and does NOT trigger an OS-level window blur/focus steal.
 */
class FountainConfirmModal extends Modal {
  private title: string;
  private message: string;
  private onConfirm: () => void;

  constructor(app: App, title: string, message: string, onConfirm: () => void) {
    super(app);
    this.title = title;
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });

    const buttonRow = contentEl.createDiv({ cls: "modal-button-container" });

    new ButtonComponent(buttonRow)
      .setButtonText("Cancel")
      .onClick(() => this.close());

    new ButtonComponent(buttonRow)
      .setButtonText("Proceed")
      .setCta()
      .onClick(() => {
        this.close();
        this.onConfirm();
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}
