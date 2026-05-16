import { ICompatibilityAdapter } from "./types";
import { FountainAdapter } from "./fountain_adapter";
import { BeatAdapter } from "./beat_adapter";
import type { FountainScript } from "../fountain/script";

let globalAdapter: ICompatibilityAdapter = new FountainAdapter();

export function setActiveAdapter(adapter: ICompatibilityAdapter) {
  globalAdapter = adapter;
}

export function getActiveAdapter(script?: FountainScript): ICompatibilityAdapter {
  if (script && script.detectedFormat === "beat") {
    return new BeatAdapter();
  }
  if (script && script.detectedFormat === "fountain") {
    return new FountainAdapter();
  }
  return globalAdapter;
}
