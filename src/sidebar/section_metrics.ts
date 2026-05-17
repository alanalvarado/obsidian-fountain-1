import { formatDuration, formatEighths } from "../fountain/metrics";
import type { FountainScript } from "../fountain";
import { SidebarSection } from "./base";

export class MetricsSection extends SidebarSection {
  render(
    container: HTMLElement,
    script: FountainScript,
    _isEditMode: boolean,
    _path: string,
  ): void {
    const structure = script.structure();
    const m = structure.metrics;

    container.createDiv({ cls: "sidebar-section" }, (div) => {
      div.createDiv({ cls: "section-title-bar", text: "THE PULSE" });
      div.createDiv({ cls: "section-content" }, (content) => {
        content.createDiv({ cls: "metrics-grid" }, (grid) => {
          grid.createDiv({ cls: "metric-item" }, (item) => {
            item.createDiv({ cls: "metric-label", text: "PAGES" });
            item.createDiv({ cls: "metric-value", text: formatEighths(m.pageCount).replace(" pg", "") });
          });
          grid.createDiv({ cls: "metric-item" }, (item) => {
            item.createDiv({ cls: "metric-label", text: "RUNTIME" });
            item.createDiv({ cls: "metric-value", text: formatDuration(m.durationSeconds) });
          });
          grid.createDiv({ cls: "metric-item" }, (item) => {
            item.createDiv({ cls: "metric-label", text: "WORDS" });
            item.createDiv({
              cls: "metric-value small",
              text: m.wordCount.toLocaleString(),
            });
          });
        });

        // Balance bar
        content.createDiv({ cls: "balance-container" }, (balance) => {
          balance.createDiv({
            cls: "balance-bar",
            attr: {
              title: `Dialogue: ${m.dialoguePercent}% | Action: ${m.actionPercent}%`,
            },
          }, (bar) => {
            bar.createDiv({
              cls: "balance-fill dialogue",
              attr: { style: `width: ${m.dialoguePercent}%` },
            });
            bar.createDiv({
              cls: "balance-fill action",
              attr: { style: `width: ${m.actionPercent}%` },
            });
          });
          balance.createDiv({ cls: "balance-labels" }, (labels) => {
            labels.createSpan({ cls: "label-dialogue", text: "Dialogue" });
            labels.createSpan({ cls: "label-action", text: "Action" });
          });
        });
      });
    });
  }
}
