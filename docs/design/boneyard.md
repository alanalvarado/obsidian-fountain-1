# Boneyard (Inline Omissions)

## Objective
Formalize the structural role of the **Boneyard** feature within the Obsidian NewFountain ecosystem to prevent functional overlap with Snippets.

## 1. Core Definition: What is the Boneyard?
The Boneyard is designed for **Inline, Contextual Omissions**. 
- **Purpose**: Temporarily commenting out specific blocks of text (dialogue, action lines) without losing their precise location in the script hierarchy.
- **Workflow Context**: "I am cutting John's second sentence here, but I want to keep it embedded in the scene so I can instantly toggle it back into the flow if I change my mind."

## 2. Structural Format
The Boneyard utilizes standard Fountain block-comments.

```markdown
JOHN
I don't think we should go in there.
/* 
He points at the crumbling doorway.
JOHN (CONT'D)
It looks like a death trap. 
*/
```

### Syntax Rules
- **Block Comment (`/* ... */`)**: Any text wrapped in these block comments is parsed as a Boneyard omission.
- **Location**: Boneyard items remain exactly where they were written. They are never relocated to the EOF (End Of File).

## 3. Sidebar Integration
- The Sidebar's **BONEYARD** section parses all `/* ... */` blocks in the document.
- Clicking a Boneyard omission in the sidebar navigates the editor to the exact line where the cut was made.
- The sidebar provides a "Restore to Script" action, which strips the `/*` and `*/` markers, instantly reintegrating the text back into the active draft.

## 4. Distinction from Snippets
- **Boneyard**: Small to medium contextual cuts that stay inline.
- **Snippets**: Large, multi-page sequence cuts or reusable document boilerplates that are physically removed from the scene flow and stored at the EOF.

## 5. Beat Metadata Block Exclusion
Because the third-party application **Beat** uses the exact same `/* ... */` syntax to store its proprietary JSON metadata block at the bottom of the file (e.g., `/* ... BEAT: {...} END_BEAT */`), our AST parser explicitly filters it out to prevent it from cluttering the Boneyard sidebar.
- **Protocol**: Under the plugin's Single Responsibility Principle (SRP) design, the core parser (`FountainScript`) remains unaware of the "Beat" application. Instead, it delegates filtering rules to the active compatibility adapter.
- **Managed By**: 
  - `src/compatibility/beat/beat_adapter.ts` (`shouldExcludeFromBoneyard()` and `getCompatibilityMetadataRanges()` filter and parse the Beat metadata comment).
  - `src/fountain/script.ts` (queries the active adapter during structural compilation to cleanly separate `beatMetadata` and exclude it from the generic boneyard elements).
