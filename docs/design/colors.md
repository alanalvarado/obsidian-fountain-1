# Scene Heading Colors

## Objective
Formalize the supported syntax for applying visual colors to Scene Headings, natively adopting the Beat-compatible color specification.

## 1. Supported Syntax
The plugin allows writers to highlight specific scene headings or sections using predefined CSS color tags. The plugin natively parses and renders these colors in the Editor, Table of Contents, and Index Cards.

### Valid Formats
1. **Explicit Color Prefix:** `[[COLOR <color>]]`
   - Example: `[[COLOR RED]]`
2. **Implicit Color Word:** `[[<color>]]`
   - Example: `[[RED]]`

### Supported Colors
The engine specifically looks for standard Beat-supported color names:
- `cyan`
- `magenta`
- `yellow`
- `red`
- `green`
- `blue`
- `brown`
- `gray`
- `orange`
- `purple`
- `pink`

*(Note: While our AST parser handles colors case-insensitively for resilience, the **canonical format is strictly uppercase (CAPS)**. In the native Beat editor, any lowercase entry (e.g. `[[red]]` or `[[color red]]`) is instantly capitalized to `[[RED]]` or `[[COLOR RED]]`. Writers and code generators should strictly output uppercase formatting to ensure maximum compatibility).*

## 2. Unsupported Syntax
### Custom Hex Codes (`[[#FF0000]]`)
Custom hexadecimal color codes are **strictly unsupported** by the Beat standard and, by extension, this plugin.
- **Reasoning**: Beat relies on predetermined CSS classes to render structural colors. Arbitrary hex codes break this rendering pipeline and create unpredictable UI behavior in external applications.
- **Rule**: Writers must exclusively use the predefined color words listed above. Any custom hex codes will be ignored or stripped during sanitization.
