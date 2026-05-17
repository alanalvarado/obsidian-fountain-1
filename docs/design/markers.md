# Marker Syntax Specification

## Objective
Establish the syntax and parsing rules for structural markers, formally adopting the Beat-compatible marker syntax as a native feature within Obsidian NewFountain.

## 1. Core Definition
Markers are internal, non-printing labels used for specific story beats, structural organization, or editorial flags. 

## 2. Supported Syntax (Beat Compatible)
The plugin natively parses the following marker variations:

- `[[marker]]`: A blank marker.
- `[[marker text here]]`: A marker with descriptive text.
- `[[marker color]]`: A marker assigned a specific CSS color.
- `[[marker color text here]]`: A colored marker with descriptive text.

### Implementation Details
- The literal word `marker` (case-insensitive) MUST be the first token inside the double brackets.
- The color (if provided) must match a supported CSS color from the Beat standard (e.g., `red`, `cyan`, `magenta`).

## 3. Legacy Syntax Deprecation & Migration
The original author's legacy syntax utilized the `@` symbol for markers (`[[@marker]]`).

### Auto-Migration Rules
- The literal string `[[@marker]]` is strictly deprecated.
- **Migration Engine**: The plugin's AST parser and Sanitizer automatically detect the explicit literal string `[[@marker]]` and non-destructively convert it to the standardized `[[marker]]` syntax upon file load/focus. 
- This ensures absolute compatibility with the Beat standard without requiring manual user intervention.
