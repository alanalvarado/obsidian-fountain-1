import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { measureInches } from "../views/reading_view";

class PageBreakWidget extends WidgetType {
  constructor(readonly pageNumber: number) {
    super();
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "fountain-editor-page-break";
    const num = document.createElement("span");
    num.className = "fountain-page-number";
    num.textContent = `PAGE ${this.pageNumber}`;
    wrap.appendChild(num);
    return wrap;
  }

  eq(other: PageBreakWidget) {
    return other.pageNumber === this.pageNumber;
  }
  
  override get estimatedHeight() { return 60; }
}

export const paginationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.calculateDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.calculateDecorations(update.view);
      }
    }

    calculateDecorations(view: EditorView) {
      const widgets = [];
      const pixelsPerInch = measureInches(view.dom);
      const pageHeight = 11 * pixelsPerInch;
      const topPadding = 1 * pixelsPerInch; // 1in top padding
      
      let cumulativeHeight = topPadding;
      let pageNumber = 1;

      // We only calculate for the visible viewport to stay fast, 
      // but we need to know the height from the start.
      // For simplicity in this first version, we'll iterate through the doc.
      // CodeMirror's lineBlockAt is reasonably fast.
      
      const doc = view.state.doc;
      for (let i = 1; i <= doc.lines; i++) {
        const line = view.lineBlockAt(doc.line(i).from);
        const height = line.height;
        
        if (cumulativeHeight + height > pageHeight) {
          pageNumber++;
          widgets.push(
            Decoration.widget({
              widget: new PageBreakWidget(pageNumber),
              side: 1,
              block: true,
            }).range(line.from)
          );
          cumulativeHeight = height; // Start new page with this line
        } else {
          cumulativeHeight += height;
        }
      }

      return Decoration.set(widgets);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
