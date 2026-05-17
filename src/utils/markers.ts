/**
 * Formats a marker note tag following the Beat screenplay standard.
 * Adheres strictly to the four variations described in docs/design/markers.md:
 * - [[marker]]
 * - [[marker <text>]]
 * - [[marker <color>]]
 * - [[marker <color> <text>]]
 *
 * @param color Optional supported CSS color (e.g., 'cyan', 'red')
 * @param text Optional descriptive marker text
 * @returns The formatted marker string
 */
export function formatMarkerTag(color?: string, text?: string): string {
  const parts = ["marker"];
  
  if (color) {
    parts.push(color.toLowerCase());
  }
  
  if (text) {
    // Trim descriptive text
    const trimmedText = text.trim();
    if (trimmedText) {
      parts.push(trimmedText);
    }
  }
  
  return `[[${parts.join(" ")}]]`;
}
