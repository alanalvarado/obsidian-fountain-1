import { formatMarkerTag, parseMarker } from "../src/utils/markers";
import { parse } from "../src/fountain/parser";
import { extractNotes } from "../src/fountain";

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

  describe("parseMarker", () => {
    test("parses standard blank marker", () => {
      const script = parse("This is a line. [[marker]]");
      const notes = extractNotes(script.script);
      expect(notes.length).toBe(1);
      const parsed = parseMarker(notes[0], script.document);
      expect(parsed).toEqual({
        isMarker: true,
        text: "",
        markerWord: "MARKER",
      });
    });

    test("parses marker with descriptive text", () => {
      const script = parse("Some action. [[marker climax scene]]");
      const notes = extractNotes(script.script);
      expect(notes.length).toBe(1);
      const parsed = parseMarker(notes[0], script.document);
      expect(parsed).toEqual({
        isMarker: true,
        text: "climax scene",
        markerWord: "MARKER",
      });
    });

    test("parses colored blank marker", () => {
      const script = parse("Some action. [[marker cyan]]");
      const notes = extractNotes(script.script);
      expect(notes.length).toBe(1);
      const parsed = parseMarker(notes[0], script.document);
      expect(parsed).toEqual({
        isMarker: true,
        color: "cyan",
        text: "",
        markerWord: "MARKER",
      });
    });

    test("parses colored marker with descriptive text", () => {
      const script = parse("Some action. [[marker RED key revelation]]");
      const notes = extractNotes(script.script);
      expect(notes.length).toBe(1);
      const parsed = parseMarker(notes[0], script.document);
      expect(parsed).toEqual({
        isMarker: true,
        color: "red",
        text: "key revelation",
        markerWord: "MARKER",
      });
    });

    test("parses legacy @marker tag", () => {
      const script = parse("Legacy mark. [[@reveal]]");
      const notes = extractNotes(script.script);
      expect(notes.length).toBe(1);
      const parsed = parseMarker(notes[0], script.document);
      expect(parsed).toEqual({
        isMarker: true,
        text: "",
        markerWord: "REVEAL",
      });
    });

    test("parses legacy @marker tag with text", () => {
      const script = parse("Legacy text. [[@effect with some description]]");
      const notes = extractNotes(script.script);
      expect(notes.length).toBe(1);
      const parsed = parseMarker(notes[0], script.document);
      expect(parsed).toEqual({
        isMarker: true,
        text: "with some description",
        markerWord: "EFFECT",
      });
    });

    test("ignores normal notes", () => {
      const script = parse("Normal note [[this is just a note]].");
      const notes = extractNotes(script.script);
      expect(notes.length).toBe(1);
      const parsed = parseMarker(notes[0], script.document);
      expect(parsed.isMarker).toBe(false);
    });
  });
});

