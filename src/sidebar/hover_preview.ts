/** Manages floating snapshots of screenplay content when hovering over sidebar items. */
export class HoverPreviewManager {
  private tooltipEl: HTMLElement | null = null;
  private timeout: number | null = null;

  setup(target: HTMLElement, contentProvider: (container: HTMLElement) => void) {
    target.addEventListener("mouseenter", () => {
      if (this.timeout) window.clearTimeout(this.timeout);
      this.timeout = window.setTimeout(() => {
        this.show(target, contentProvider);
      }, 500);
    });

    target.addEventListener("mouseleave", () => this.hide());
    target.addEventListener("mousedown", () => this.hide());
  }

  private show(target: HTMLElement, contentProvider: (container: HTMLElement) => void) {
    this.hide();

    this.tooltipEl = document.body.createDiv({ cls: "fountain-hover-preview" });
    contentProvider(this.tooltipEl);

    const rect = target.getBoundingClientRect();
    
    // Position to the left of the target (sidebar is on the right)
    this.tooltipEl.style.top = `${Math.max(10, rect.top)}px`;
    this.tooltipEl.style.right = `${window.innerWidth - rect.left + 15}px`;
    
    // Initial state for animation
    this.tooltipEl.style.opacity = "0";
    requestAnimationFrame(() => {
        if (this.tooltipEl) this.tooltipEl.style.opacity = "1";
    });
  }

  private hide() {
    if (this.timeout) {
      window.clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  }
}
