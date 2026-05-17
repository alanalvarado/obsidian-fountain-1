import { getActiveAdapter } from "../compatibility/registry";
import { BeatAdapter } from "../compatibility/beat_adapter";
import type { FountainScript } from "../fountain";
import { SidebarSection } from "./base";

export class ModeSection extends SidebarSection {
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
