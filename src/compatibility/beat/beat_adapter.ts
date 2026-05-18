import { FountainScript } from "../../fountain";
import type { Edit, Range, Snippet } from "../../fountain";
import { ICompatibilityAdapter } from "../types";
import { FountainAdapter } from "../fountain/fountain_adapter";
import { FountainView } from "../../views/fountain_view";

import { processBeatAST } from "./beat_tag_extractor";
import { scrubBeatProprietaryTags, scrubBeatString } from "./beat_tag_scrubber";
import {
  shouldExcludeBeatFromBoneyard,
  getBeatCompatibilityMetadataRanges,
  parseBeatCompatibilitySnippets,
} from "./beat_metadata_parser";
import {
  convertToBeatFormat,
  convertToStandardFormat,
} from "./beat_converter";

export { BEAT_BOILERPLATE_START, BEAT_BOILERPLATE_END } from "./beat_converter";

/**
 * Pure lightweight shell implementation of ICompatibilityAdapter for Beat format.
 * Delegates all concerns to specialized sub-modules in compliance with SRP.
 */
export class BeatAdapter extends FountainAdapter {
  
  processAST(script: FountainScript): void {
    processBeatAST(script);
  }

  scrubProprietaryTags(script: FountainScript): Edit[] {
    return scrubBeatProprietaryTags(script);
  }

  scrubString(text: string): string {
    return scrubBeatString(text);
  }

  shouldExcludeFromBoneyard(content: string): boolean {
    return shouldExcludeBeatFromBoneyard(content);
  }

  getCompatibilityMetadataRanges(script: FountainScript): Range[] {
    return getBeatCompatibilityMetadataRanges(script);
  }

  parseCompatibilitySnippets(script: FountainScript, metadataRanges: Range[]): Snippet[] {
    return parseBeatCompatibilitySnippets(script, metadataRanges);
  }

  convertToBeatFormat(script: FountainScript): Edit[] {
    return convertToBeatFormat(script);
  }

  convertToStandardFormat(script: FountainScript): Edit[] {
    return convertToStandardFormat(script);
  }
}
