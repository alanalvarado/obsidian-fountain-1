import { formatMarkerTag } from "../src/utils/markers";

describe("markers utility", () => {
  describe("formatMarkerTag", () => {
    test("generates standard blank marker", () => {
      expect(formatMarkerTag()).toBe("[[marker]]");
      expect(formatMarkerTag(undefined, "")).toBe("[[marker]]");
    });

    test("generates marker with descriptive text", () => {
      expect(formatMarkerTag(undefined, "climax scene")).toBe("[[marker climax scene]]");
      expect(formatMarkerTag(undefined, "  trimmed text  ")).toBe("[[marker trimmed text]]");
    });

    test("generates colored blank marker", () => {
      expect(formatMarkerTag("cyan")).toBe("[[marker cyan]]");
      expect(formatMarkerTag("RED")).toBe("[[marker red]]");
    });

    test("generates colored marker with descriptive text", () => {
      expect(formatMarkerTag("cyan", "climax scene")).toBe("[[marker cyan climax scene]]");
      expect(formatMarkerTag("RED", "  trimmed text  ")).toBe("[[marker red trimmed text]]");
    });
  });
});
