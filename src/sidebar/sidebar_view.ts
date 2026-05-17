import { App, ItemView, TFile, type WorkspaceLeaf, debounce } from "obsidian";
import type { FountainScript } from "../fountain";
import { getActiveAdapter } from "../compatibility/registry";
import { FountainView } from "../views/fountain_view";
import { SidebarCallbacks, SidebarSection } from "./base";
import { HoverPreviewManager } from "./hover_preview";
import { MetricsSection } from "./section_metrics";
import { TocSection } from "./section_toc";
import { CharactersSection } from "./section_characters";
import { BoneyardSection } from "./section_boneyard";
import { SnippetsSection } from "./section_snippets";

export const VIEW_TYPE_SIDEBAR = "fountain-sidebar";

export class FountainSideBarView extends ItemView {
  private updateToc: () => void;
  private sections: SidebarSection[];
  private hoverPreviewManager: HoverPreviewManager;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.hoverPreviewManager = new HoverPreviewManager();
    this.sections = [
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
      renameCharacter: (name) => {
        const view = this.theFountainView();
        if (view) view.promptRenameCharacter(name);
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
