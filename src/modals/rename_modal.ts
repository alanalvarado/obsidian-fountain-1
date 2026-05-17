import { App, ButtonComponent, Modal, TextComponent } from "obsidian";

export class FountainRenameModal extends Modal {
  private newName: string = "";

  constructor(
    app: App,
    private oldName: string,
    private onConfirm: (newName: string) => void,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: `Rename Character: ${this.oldName}` });

    const inputContainer = contentEl.createDiv({ cls: "modal-input-container" });
    
    const label = inputContainer.createEl("div", { text: "New Name (UPPERCASE recommended):" });
    label.style.marginBottom = "8px";

    const textComponent = new TextComponent(inputContainer)
      .setPlaceholder(this.oldName)
      .setValue(this.oldName)
      .onChange((value) => {
        this.newName = value.trim();
      });

    textComponent.inputEl.style.width = "100%";
    textComponent.inputEl.style.marginBottom = "16px";

    // Automatically focus the input
    textComponent.inputEl.focus();
    textComponent.inputEl.select();

    // Listen to Enter key in input
    textComponent.inputEl.addEventListener("keypress", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const nameToUse = this.newName || this.oldName;
        if (nameToUse && nameToUse !== this.oldName) {
          this.close();
          this.onConfirm(nameToUse);
        }
      }
    });

    const buttonRow = contentEl.createDiv({ cls: "modal-button-container" });

    new ButtonComponent(buttonRow)
      .setButtonText("Cancel")
      .onClick(() => this.close());

    new ButtonComponent(buttonRow)
      .setButtonText("Rename")
      .setCta()
      .onClick(() => {
        const nameToUse = this.newName || this.oldName;
        if (nameToUse && nameToUse !== this.oldName) {
          this.close();
          this.onConfirm(nameToUse);
        }
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}
