# Snippets and EOF Clippings

## Objective

Establish a formal separation between **Snippets** (EOF plain-text scratchpad) and **Boneyard** (inline contextual blocks).

## 1. Core Definition: What is a Snippet?

In this obsidian plugin, a Snippet is an **Out-of-Line Staging area** (Clipping).

- **Purpose**: Moving large cut sequences, alternative scenes, or script-specific scratchpad fragments entirely out of the active draft to avoid cluttering. They remain handy in the sidebar to drag-and-drop back into the active script.
- **Location**: Stored at the absolute bottom of the `.fountain` file under a single `# Snippets` header.

## 2. Structural Format (Fountain Native)

To ensure Snippets do not interfere with standard parsing, reading views, or PDF generation, they strictly follow the Fountain Native standard:

```markdown
===

# Snippets

### Title of Snippet One
Snippet content goes here...

### Title of Snippet Two
Content of snippet two...
```

### Syntax Rules

- **Pre-Header Divider (`===`)**: A single Fountain Page Break (`===`) MUST precede the `# Snippets` block. This isolates the entire scratchpad area from standard active script printing.
- **Header**: `# Snippets` defines the boundary. Everything below this line is treated as a snippet.
- **Title (`###`)**: Each individual snippet MUST begin with a Depth-3 header (`### Title`). This acts as the strict delimiter between snippets.
- **No Individual Dividers**: Individual snippets do NOT have `===` separators at their end.

## 3. Out of Scope: Global Vault Templates

Vault-wide templates (e.g., auto-filling standard transition slugs or title pages across multiple files) are **explicitly out of scope** for this plugin.

**Business Case**: Obsidian already provides robust, dedicated solutions for global text expansion (Core Templates, Templater plugin, Text Expander). Replicating these features inside a screenwriting parser introduces unnecessary technical debt. Our plugin focuses solely on script-specific scratchpad management.

## 4. Deprecated Formats

- **Legacy Individual Snippet Separators (`===` after each snippet)**: The original author's format of appending a `===` separator after each individual snippet is fully deprecated. Individual snippets are now bounded purely by the next `###` header or EOF to prevent empty pages and structural noise.
- **Legacy Untitled Separators**: The old format of simply separating raw text with `===` (without a `### Title`) is deprecated as it causes AST parsing loops. The Sanitizer will automatically upgrade untitled blocks by auto-generating fallback titles.
- **Beat JSON Metadata (Work In Progress / On Hold)**: Storing snippets inside the proprietary `/* BEAT: {"Snippets": [...]} */` JSON block is currently on hold. As this functionality remains unreleased and unfinished in the Beat app, we have disconnected the integration. Once Beat officially releases and finalizes this JSON structure, we will complete our compatibility adapter to support seamless cross-app snippet syncing. Until then, snippets are stored strictly via the Fountain Native `# Snippets` standard.
