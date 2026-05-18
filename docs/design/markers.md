# Marker Syntax Specification

## Objective
Establish a unified, high-fidelity syntax, parsing pipeline, and premium rendering system for structural markers within Obsidian NewFountain. This specification formally separates **Markers** from standard screenplay **Notes** and defines the high-end swallowtail visual aesthetics for both reading and editing views.

---

## 1. Notes vs. Markers (Terminology Standard)
To ensure long-term codebase maintainability, the system strictly separates two distinct annotation types:
*   **Notes** (`[[this is a note]]`): Standard inline, non-structural annotations meant for editorial thoughts or general tasks.
*   **Markers** (`[[marker]]` or `[[@marker]]`): Structural labels, story beat anchors, or specific production/technical cues. Markers are non-printing, live in the margins, and visually transform the lines they annotate.

---

## 2. Supported Marker Syntax

The parser natively processes both standard Beat-compatible marker patterns and legacy margin-mark conventions:

### A. Beat-Compatible Markers
- **Blank Marker**: `[[marker]]`
- **Descriptive Marker**: `[[marker climax scene]]`
- **Colored Marker**: `[[marker cyan]]`
- **Colored & Descriptive**: `[[marker red key incident]]`

*Rules:*
- The keyword `marker` (case-insensitive) MUST be the first token.
- The optional color must match one of the predefined screenplay colors (e.g. `red`, `blue`, `green`, `pink`, `magenta`, `purple`, `yellow`, `orange`, `cyan`, `violet`, `rose`, `teal`).

### B. Legacy Margin Markers
- **Legacy Margin Marker**: `[[@marker]]`
- **Legacy Descriptive**: `[[@climax some description]]`

*Rules:*
- The `@` prefix represents legacy author margin markers. These are natively supported, fully functional, and display in the margin.
- **Auto-Migration Engine**: While legacy `@` syntax remains fully operational in both views, the plugin's Sanitizer automatically migrates legacy markup to the standardized `[[marker]]` syntax upon save/formatting to preserve monorepo integrity.

---

## 3. High-Fidelity Rendering Specification

When a marker is parsed on a script line, it visually transforms the line in both the **Editor View** (Live Preview) and **Reading View** (Rendered HTML) to look like a physical ribbon bookmark.

### A. The Margin Badge (Swallowtail Ribbon flag)
- **CSS Class**: `.fountain-marker-badge`
- **Visuals**: A prominent vertical bookmark tab absolute-positioned in the left margin (`right: calc(100% + 1.2ch)`, `width: 4.2ch`). It contains a single hidden character (a dot `.`) rendered in transparent color (`color: transparent !important; user-select: none;`) to force standard line-height baseline alignment (`height: 1.25em;`, `top: 0.05em;`). This preserves the natural vertical spacing gap between consecutive bookmarks on adjacent lines while keeping the badge visually textless and pure.
- **Physical Cut**: Shaped as a realistic ribbon using an inverted CSS `clip-path` polygon pointing inwards on the left edge:
  ```css
  clip-path: polygon(15% 0%, 100% 0%, 100% 100%, 15% 100%, 0% 50%);
  ```
- **Borderless Style**: Styled as a clean, uniform, borderless visual bookmark flag for maximum aesthetic purity.
- **Glassmorphism**: Rendered with soft theme-adaptive variables, a warm golden gradient, a rotated layout (`transform: rotate(-1deg)`), and a smooth hover lift transition (`transform: rotate(0deg) scale(1.08)`).
- **Color Mapping**: Colored markers (e.g. `cyan`, `red`) dynamically map their custom color to the entire flag background (`background: var(--item-color) !important`) for a fully saturated, vibrant accent indicator.

### B. The Line Text Color (Ribbon Body Text)
- **CSS Class**: `.fountain-marker-line`
- **Visuals**: Styles the text color of the entire screenplay element block to match the marker's visual tone.
- **Theme Adaptability / Coloring**:
  - **Standard Markers**: Adapts to `--fountain-marker-text` (sleek slate in light mode, soft silver/gray in dark mode).
  - **Colored Markers**: Dynamically applies the custom color (`var(--item-color) !important`) to all text on the line.


### C. Editor Raw Tag Styling
- **CSS Class**: `.fountain-marker-tag`
- **Visuals**: The raw text `[[marker]]` inside the editor remains fully readable and editable, styled with a dashed border, monospace typography, and a soft background tint, making it instantly recognizable to the writer.
