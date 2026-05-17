import { FountainScript } from "../fountain/script";
import type { Range, Snippet } from "../fountain";

export function shouldExcludeBeatFromBoneyard(content: string): boolean {
  return content.includes("BEAT:") && content.includes("END_BEAT");
}

export function getBeatCompatibilityMetadataRanges(script: FountainScript): Range[] {
  const ranges: Range[] = [];
  script.script.forEach((fe) => {
    if (fe.kind === "action") {
      fe.lines.forEach((line) => {
        line.elements.forEach((el) => {
          if (el.kind === "boneyard") {
            const content = script.sliceDocument(el.range);
            if (shouldExcludeBeatFromBoneyard(content)) {
              ranges.push(el.range);
            }
          }
        });
      });
    }
  });
  return ranges;
}

export function parseBeatCompatibilitySnippets(script: FountainScript, metadataRanges: Range[]): Snippet[] {
  const allSnippets: Snippet[] = [];
  metadataRanges.forEach((range) => {
    const content = script.sliceDocument(range);
    const jsonMatch = content.match(/({[\s\S]*})/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.Snippets && Array.isArray(data.Snippets)) {
          data.Snippets.forEach((s: any, i: number) => {
            allSnippets.push({
              title: s.title || "Untitled",
              category: "Beat JSON",
              range: range,
              content: [],
              text: s.text || "",
              index: i,
            });
          });
        }
      } catch (e) {}
    }
  });
  return allSnippets;
}
