/**
 * Standard colors defined by the Beat screenplay standard.
 */
export const SUPPORTED_COLORS = [
  "cyan",
  "magenta",
  "yellow",
  "red",
  "green",
  "blue",
  "brown",
  "gray",
  "orange",
  "purple",
  "pink",
] as const;

export type SupportedColor = typeof SUPPORTED_COLORS[number];

export const BEAT_COLORS: Record<string, string> = {
  red: "#ef0049",
  blue: "#0081ef",
  green: "#00df79",
  pink: "#fe83df",
  magenta: "#ec008c",
  gray: "#808080",
  grey: "#808080",
  purple: "#b520da",
  yellow: "#fbc82d",
  goldenrod: "#d7940f",
  rose: "#ecb898",
  buff: "#766456",
  cherry: "#ec5a96",
  teal: "#0ce0e3",
  orange: "#ffa10d",
  brown: "#a96a07",
  lightgray: "#dcdcdc",
  darkgray: "#aaaaaa",
  verydarkgray: "#646464",
  backgroundgray: "#292a2d",
  fdxremoval: "#ffbedc",
  mint: "#48e7d3",
  violet: "#743ee6",
  olive: "#4d932c",
  cyan: "#07bdeb",
};

/**
 * Checks case-insensitively if a color name is standard and supported.
 */
export function isSupportedColor(color: string): boolean {
  if (!color) return false;
  return SUPPORTED_COLORS.includes(color.toLowerCase() as SupportedColor);
}

/**
 * Formats a color to standard explicit uppercase tag: [[<COLOR>]].
 */
export function formatColorTag(color: string): string {
  return `[[${color.toUpperCase()}]]`;
}

/**
 * Parses and updates the color tag in a given scene heading line text.
 * Strips any existing standard colors or hex codes, and appends the new color tag if specified.
 *
 * @param lineText The original scene heading line
 * @param color The new color name to set (case-insensitive), or null/undefined/""/"none" to remove the color tag
 * @returns The updated line text
 */
export function updateLineColor(lineText: string, color?: string | null): string {
  // Matches any [[COLOR <val>]] or [[<val>]] tags
  const colorTagRegex = /\[\[(?:COLOR\s+)?([a-zA-Z]+|#[a-fA-F0-9]{3,6})\]\]/gi;
  
  let cleanedLine = lineText;
  let match;
  
  // Find all matches and check if they are supported colors or hex. If so, remove them.
  while ((match = colorTagRegex.exec(lineText)) !== null) {
    const val = match[1].toLowerCase();
    if (isSupportedColor(val) || val.startsWith("#")) {
      cleanedLine = cleanedLine.replace(match[0], "");
    }
  }
  
  // Clean up extra spaces
  cleanedLine = cleanedLine.replace(/\s+/g, " ").trim();
  
  if (color && color.toLowerCase() !== "none") {
    return `${cleanedLine} ${formatColorTag(color)}`;
  }
  
  return cleanedLine;
}
