import * as fs from 'fs';
import * as path from 'path';

const fontsDir = 'assets/fonts';
const outputFile = 'src/pdf/fonts_data.ts';

const fonts = [
    { name: 'COURIER_PRIME_REGULAR', file: 'Courier Prime.ttf' },
    { name: 'COURIER_PRIME_BOLD', file: 'Courier Prime Bold.ttf' },
    { name: 'COURIER_PRIME_ITALIC', file: 'Courier Prime Italic.ttf' },
    { name: 'COURIER_PRIME_BOLD_ITALIC', file: 'Courier Prime Bold Italic.ttf' },
];

let content = `/**
 * Base64 encoded Courier Prime TTF fonts for PDF embedding.
 * Generated from assets/fonts/
 */
`;

for (const font of fonts) {
    const filePath = path.join(fontsDir, font.file);
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        const base64 = data.toString('base64');
        content += `export const ${font.name} = "${base64}";\n\n`;
        console.log(`Encoded ${font.file} as ${font.name}`);
    } else {
        console.warn(`Font file not found: ${filePath}`);
    }
}

fs.writeFileSync(outputFile, content);
console.log(`Updated ${outputFile}`);
