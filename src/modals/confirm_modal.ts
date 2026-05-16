import { App, ButtonComponent, Modal } from "obsidian";

/**
 * An in-app confirmation modal that replaces native window.confirm().
 * This prevents OS-level focus stealing on Windows/Electron.
 */
export class FountainConfirmModal extends Modal {
  constructor(
    app: App,
    private title: string,
    private message: string,
    private onConfirm: () => void,
  ) {
    super(app);
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
