# Fountain Metrics: "The Pulse" Technical Reference

This document outlines the heuristics and technical logic used by the Obsidian Fountain plugin to calculate screenplay metrics (page counts, runtime, and dialogue/action balance). These standards are designed to align with professional screenwriting software like Final Draft, Highland 2, and BEAT.

## 1. Page Estimation Engine

Since Fountain is a plain-text format, page counts are estimates based on standard 12pt Courier formatting (10 characters per inch, 6 lines per inch).

### Core Heuristics
- **Lines Per Page:** 55 lines.
- **Scene Headings:** 2 lines (1 line for the heading + 1 line of mandatory whitespace).
- **Transitions:** 1 line.
- **Character Names:** 1 line.
- **Parentheticals:** 1 line.
- **Blank Lines:** 1 line.

### Weighted Line Wrapping
The engine accounts for the narrow margins used in standard screenplay layouts by applying different wrap-limits to different elements:

- **Action & Lyrics:** Wraps at **60 characters**. This accounts for 1" left/right margins on an 8.5" page.
- **Dialogue:** Wraps at **35 characters**. This accounts for the industry-standard narrow center column for dialogue.
- **Centered Text:** Wraps at **35 characters**. Centered lines are treated as taking up the same horizontal weight as dialogue.

## 2. The Rule of Eighths

In professional Hollywood production (script supervising and assistant directing), script length is measured in **eighths of a page**.

- **Calculation:** The total line count is divided by 55 to get a decimal page count.
- **Formatting:** The decimal is rounded to the nearest 1/8 increment.
- **Notation:** 
  - `1.125` -> `1 1/8 pg`
  - `0.5` -> `4/8 pg`
  - `1.625` -> `1 5/8 pg`

This notation is used both in the "Pulse" dashboard and in the Fountain Outline (TOC) next to individual scene headings.

## 3. Runtime Estimation

The plugin follows the "Golden Rule" of screenwriting: **1 Page = 1 Minute of Screen Time**.
- **Calculation:** `Page Count * 60 seconds`.
- **Formatting:** Displayed as `MM:SS` in the sidebar dashboard.

## 4. Script Balance (Dialogue vs. Action)

"The Pulse" provides a visual indicator of your script's "weight":
- **Dialogue %:** The ratio of lines occupied by character names, parentheticals, and dialogue blocks.
- **Action %:** The ratio of lines occupied by action descriptions, scene headings, and transitions.

A balanced script usually falls within a specific range depending on the genre (e.g., Action/Adventure is action-heavy; Sitcoms are dialogue-heavy).

## 5. Technical Implementation Details

- **AST Processing:** Metrics are calculated directly from the parsed Fountain AST in `src/fountain/metrics.ts`.
- **Range-Based Slicing:** Because Fountain elements are pointers to the source document, the engine slices the document text at the specific ranges defined by the parser to ensure word counts include every character accurately.
- **Snippet Exclusion:** Sections explicitly titled `# Snippets` (or similar) are excluded from the "Main Script" metrics to ensure notes and boneyard content do not inflate the page count.
