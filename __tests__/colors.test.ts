import { isSupportedColor, formatColorTag, updateLineColor } from "../src/fountain";

describe("colors utility", () => {
  describe("isSupportedColor", () => {
    test("identifies standard supported colors case-insensitively", () => {
      expect(isSupportedColor("cyan")).toBe(true);
      expect(isSupportedColor("RED")).toBe(true);
      expect(isSupportedColor("Magenta")).toBe(true);
      expect(isSupportedColor("pink")).toBe(true);
    });

    test("identifies unsupported colors", () => {
      expect(isSupportedColor("indigo")).toBe(false);
      expect(isSupportedColor("gold")).toBe(false);
      expect(isSupportedColor("")).toBe(false);
      expect(isSupportedColor(null as any)).toBe(false);
    });
  });

  describe("formatColorTag", () => {
    test("formats color tag to uppercase", () => {
      expect(formatColorTag("red")).toBe("[[RED]]");
      expect(formatColorTag("CYAN")).toBe("[[CYAN]]");
      expect(formatColorTag("Green")).toBe("[[GREEN]]");
    });
  });

  describe("updateLineColor", () => {
    test("appends color tag if no previous tag exists", () => {
      const line = "INT. LIVING ROOM - DAY";
      expect(updateLineColor(line, "cyan")).toBe("INT. LIVING ROOM - DAY [[CYAN]]");
    });

    test("replaces existing standard color tag", () => {
      const line = "INT. LIVING ROOM - DAY [[RED]]";
      expect(updateLineColor(line, "blue")).toBe("INT. LIVING ROOM - DAY [[BLUE]]");
    });

    test("replaces existing explicit standard color tag", () => {
      const line = "INT. LIVING ROOM - DAY [[COLOR RED]]";
      expect(updateLineColor(line, "green")).toBe("INT. LIVING ROOM - DAY [[GREEN]]");
    });

    test("removes color tag when color is null, undefined or none", () => {
      expect(updateLineColor("INT. LIVING ROOM - DAY [[RED]]", null)).toBe("INT. LIVING ROOM - DAY");
      expect(updateLineColor("INT. LIVING ROOM - DAY [[COLOR RED]]", undefined)).toBe("INT. LIVING ROOM - DAY");
      expect(updateLineColor("INT. LIVING ROOM - DAY [[RED]]", "none")).toBe("INT. LIVING ROOM - DAY");
      expect(updateLineColor("INT. LIVING ROOM - DAY [[RED]]", "None")).toBe("INT. LIVING ROOM - DAY");
    });

    test("handles multiple spaces and trims cleanly", () => {
      const line = "  INT. LIVING ROOM - DAY   [[COLOR RED]]  ";
      expect(updateLineColor(line, "cyan")).toBe("INT. LIVING ROOM - DAY [[CYAN]]");
    });
  });
});
