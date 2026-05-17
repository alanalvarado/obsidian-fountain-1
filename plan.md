Assessment of Feature 4211 (Character Note Links)
Current State Analysis
The current implementation attempted to adhere to the DRY (Don't Repeat Yourself) principle by hijacking the existing openLink method used for [[>custom]] links. This involved passing a dynamically generated path (e.g., ./Characters/ALAN.md) into Obsidian's workspace.openLinkText.

While DRY in theory, this approach violates SRP (Single Responsibility Principle) and introduces stability issues:

The "Folder already exists" Error: openLinkText is designed for fuzzy Markdown link resolution, not strict, programmatic file creation. When we pass a relative path for a file that doesn't exist, Obsidian's internal link handler attempts to resolve and create the necessary folder structure. Our manual folder creation logic races or clashes with Obsidian's internal logic, resulting in the Folder already exists crash.
Ambiguous Pathing: metadataCache.getFirstLinkpathDest is excellent for finding [[links]], but it searches the whole vault if it can't find an exact match. For Character Notes, we require deterministic organization (a specific file in a specific folder).
Code Mirror Alignment: The decorations in the editor correctly apply the .dialogue-character-name class, but relying on openLink for navigation abstracts away our control over the newly created file's initial state.
Proposed Changes: Deterministic File Management
To achieve a world-class, robust implementation, we will decouple Character Notes from the fuzzy openLink system and use direct, deterministic Vault API calls.

1. Refactor fountain_view.ts
We will replace the openCharacterNote and refreshCharacterNoteCache logic with strict path resolution.

[MODIFY] src/views/fountain_view.ts
Path Resolver: Create a private helper getCharacterNotePath(characterName: string): string that calculates the exact vault path (e.g., MyScripts/Characters/ALAN.md) based on the current file's directory and the settings.
Cache Refresh: Update refreshCharacterNoteCache to use this.app.vault.getAbstractFileByPath(exactPath) instead of getFirstLinkpathDest. This ensures the cache only registers notes that exist exactly where they are supposed to.
Strict Creation (openCharacterNote):
Calculate the exact file path.
Check if the TFile exists.
If it does NOT exist:
Extract the folder path. Check if it exists via getAbstractFileByPath.
If the folder does not exist, sequentially create the folder(s) using this.app.vault.createFolder().
Create the file using this.app.vault.create(exactPath, "").
Finally, navigate to the guaranteed TFile using this.app.workspace.getLeaf(inNewLeaf).openFile(file).
2. Verify UI/UX Integrity
[MODIFY] src/sidebar/sidebar_view.ts
Ensure the eye icon click handler strictly passes the event modifiers to the new, hardened openCharacterNote method.
The layout order [Name] [Eye Icon] [Dialogue Count] will be preserved as established.
[MODIFY] src/codemirror/editor.ts & src/views/readonly_view_state.ts
No changes required here; the DOM listeners and decorations are correctly passing the character name and event to the View callbacks.
Verification Plan
Automated/Manual Tests
Fresh Start: Delete the Characters/ folder if it exists.
Creation Test: Click the eye icon in the sidebar for a character. Verify that the folder and the note are created instantly without errors, and the new note opens in a tab.
Relative Pathing Test: Move the screenplay to a subfolder (e.g., Project A/Script.fountain). Verify that character notes are created inside Project A/Characters/.
Cache Sync Test: Type a new character name in the editor. Verify the eye icon appears in the sidebar and clicking it works immediately.
User Review Required
IMPORTANT

The transition from fuzzy link resolution (openLinkText) to strict Vault API file creation guarantees that characters won't be mixed across projects and eliminates the folder collision error.

Review the plan above. Shall I proceed with implementing this deterministic file management approach?
