# Custom Fountain Syntax Extensions

The Obsidian Fountain plugin extends the standard Fountain specification with several custom features for navigation, organization, and compatibility with other screenwriting apps.

## 1. Plugin-Specific Extensions

These features are unique to this plugin and are designed to integrate Fountain scripts with the Obsidian vault.

### Cross-File Links (`[[>target]]`)

Link to other files in your vault (character notes, research, other scripts, etc.).

*   **Syntax**: `[[>target]]` or `[[>target|display text]]`
*   **Resolution**: Uses Obsidian's standard link resolution (basename, full path, with or without extension).
*   **Behavior**: Clickable in Reading view; autocompletes in the Editor; automatically updated when the target file is renamed.
*   **PDF Export**: Rendered as plain inline text (if notes are visible).

### Todo Notes (`[[todo: ...]]`)

Mark tasks directly within your script.

*   **Syntax**: `[[todo: Your task description]]`
*   **Behavior**: These notes are indexed and displayed in the **Table of Contents** sidebar under their respective scenes. Clicking a todo in the sidebar jumps directly to its location.

### Margin Marks (`[[marker]]`)

Create visual labels that appear in the right margin of the script.

*   **Syntax**: `[[marker text]]` or simply `[[marker]]`
*   **Behavior**:
    *   **Reading View**: Appears as a small, distinct label in the right margin.
    *   **Common Uses**: Performance cues (`[[marker lights]]`, `[[marker sound]]`), comedy beats (`[[marker laugh]]`), or emotional beats (`[[marker tension]]`).
    *   *Note: Legacy `[[@marker]]` syntax is automatically migrated to the standard `[[marker]]` syntax upon file load.*

### Note Kinds (`[[kind: text]]`)

Categorize your authorial notes for better organization.

*   **Syntax**: `[[kind: note text]]` (e.g., `[[research: check dates]]`, `[[+added in draft 2]]`, `[[-cut for time]]`).
*   **Behavior**: Helps distinguish different types of feedback or annotations in the source text.

### Snippets Section (`# Snippets`)

Create a library of reusable content blocks at the end of your document.

*   **Syntax**: Place a `# Snippets` header at the end of your file. Separate individual snippets using page breaks (`===`).
*   **Behavior**: Snippets appear in the sidebar and can be dragged into the script. Everything after the `# Snippets` header is treated as a snippet.

---

## 2. BEAT Compatibility Syntax

The plugin natively adopts select [BEAT](https://www.beat-app.fi/) syntax as core features to allow seamless cross-platform workflow.

### Color Coding (`[[COLOR]]`)

Apply colors to scene and section headings.

*   **Syntax**: `[[COLOR <color>]]` or `[[<color>]]` (e.g., `[[RED]]`, `[[COLOR cyan]]`).
*   **Supported Colors**: Must be standard CSS color words (cyan, magenta, yellow, red, green, blue, brown, gray, orange, purple, pink). Custom hex codes (e.g., `[[#FF0000]]`) are unsupported.
*   **Behavior**:
    *   Applies a background or text color to the heading in the Editor, Table of Contents, and Index Card views.
    *   The tag itself is hidden or dimmed to keep the script readable.

### Markers (`[[marker]]`)

Internal markers for specific beats or points in a scene heading.

*   **Syntax**: `[[marker]]`, `[[marker <text>]]`, `[[marker <color>]]`, or `[[marker <color> <text>]]`
*   **Behavior**: Extracted and used for structural organization.

### BEAT Metadata Block

BEAT stores proprietary metadata in a specific JSON block at the end of the file.

*   **Syntax**: `/* If you're seeing this, you can remove the following stuff - BEAT: { ...JSON... } END_BEAT */`
*   **Behavior**: The plugin passively preserves this block to maintain compatibility with Beat's window states and character genders. Snippets are strictly managed using the Fountain Native `# Snippets` block.

---

## 3. General "Boneyard" Section

While Fountain supports `/* ... */` for comments, the plugin adds a structural "boneyard" for larger blocks of cut content.

*   **Syntax**: Place a `# boneyard` section header at the end of the document.
*   **Behavior**: Content following this header can be toggled visible/hidden in the plugin settings or Reading view. It provides a persistent "parking lot" for alternative scenes.
