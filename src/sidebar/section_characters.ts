import { Menu, setIcon } from "obsidian";
import type { FountainScript } from "../fountain";
import { SidebarSection } from "./base";

export class CharactersSection extends SidebarSection {
  render(
    container: HTMLElement,
    script: FountainScript,
    _isEditMode: boolean,
    _path: string,
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

            // Bind contextmenu for character renaming
            charDiv.addEventListener("contextmenu", (evt) => {
              evt.preventDefault();
              const menu = new Menu();
              menu.addItem((mitem) => {
                mitem
                  .setTitle("Rename Character")
                  .setIcon("pencil")
                  .onClick(() => {
                    this.callbacks.renameCharacter(char.name);
                  });
              });
              menu.showAtMouseEvent(evt);
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
