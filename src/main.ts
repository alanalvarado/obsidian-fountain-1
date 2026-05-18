import {
  App,
  type MarkdownPostProcessorContext,
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
  toggleBoneyardComment,
  moveSelectionToSnippets,
  convertDocumentFormat,
} from "./commands";
import { BeatAdapter } from "./compatibility/beat/beat_adapter";
import { FountainAdapter } from "./compatibility/fountain/fountain_adapter";
import { setActiveAdapter } from "./compatibility/registry";
import { applyEditsToFountainFile } from "./utils/edit_pipeline";
import type { Edit } from "./fountain";
import { parse } from "./fountain/parser";
import { LinkIndex } from "./services/links_index";
import { FountainConfirmModal } from "./modals/confirm_modal";
import { EditorViewState } from "./views/editor_view_state";
import { FountainView, VIEW_TYPE_FOUNTAIN } from "./views/fountain_view";
import { renderContent } from "./views/reading_view";
import { Logger } from "./utils/logger";
import {
  FountainSideBarView,
  VIEW_TYPE_SIDEBAR,
} from "./sidebar/sidebar_view";
import { addFountainMenuItems } from "./views/editor_context_menu";
import { BEAT_COLORS } from "./fountain";
import { sanitizeSnippets } from "./fountain/sanitizer";

export interface FountainSettings {
  characterNotesFolder: string;
  debugMode: boolean;
}

const DEFAULT_SETTINGS: FountainSettings = {
  characterNotesFolder: "Characters/",
  debugMode: false,
};

export default class FountainPlugin extends Plugin {
  settings: FountainSettings;
  private linkIndex?: LinkIndex;

  async onload() {
    await this.loadSettings();
    Logger.initialize(this.settings.debugMode);
    
    // Inject Beat compatible colors globally onto document root
    for (const [color, hex] of Object.entries(BEAT_COLORS)) {
      document.documentElement.style.setProperty(`--beat-color-${color}`, hex);
    }

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
          addFountainMenuItems(this.app, menu, view as FountainView, this.settings);
        }
      }),
    );
    this.registerEvent(
      this.app.workspace.on("fountain-menu", (menu, view) => {
        addFountainMenuItems(this.app, menu, view, this.settings);
      }),
    );
    this.addSettingTab(new FountainSettingTab(this.app, this));

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
    Logger.initialize(this.settings.debugMode);
    setActiveAdapter(new BeatAdapter());
  }

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
        if (!checking) moveSelectionToSnippets(fv, true);
        return true;
      },
    });

    this.addCommand({
      id: "fountain-sanitize-snippets",
      name: "Sanitize Snippets Block",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(FountainView);
        if (view) {
          if (!checking) {
            sanitizeSnippets(view);
          }
          return true;
        }
        return false;
      },
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
      .setName("Character Notes Folder")
      .setDesc("The folder where character profile notes are stored (e.g., 'Characters/'). Leave empty for root.")
      .addText((text) =>
        text
          .setPlaceholder("Characters/")
          .setValue(this.plugin.settings.characterNotesFolder)
          .onChange(async (value) => {
            let folder = value.trim();
            if (folder && !folder.endsWith("/")) folder += "/";
            this.plugin.settings.characterNotesFolder = folder;
            await this.plugin.saveSettings();

            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FOUNTAIN);
            for (const leaf of leaves) {
              if (leaf.view instanceof FountainView) {
                leaf.view.refreshCharacterNoteCache();
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
