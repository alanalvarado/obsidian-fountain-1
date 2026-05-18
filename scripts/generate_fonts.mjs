import * as fs from 'fs';
import * as path from 'path';
import ttf2woff from 'ttf2woff';
import ttf2woff2 from 'ttf2woff2';

const fontsDir = 'assets/fonts';
const outputPdfFile = 'src/pdf/fonts_data.ts';
const outputCssFile = 'src/styles/fonts.css';

const fonts = [
    { name: 'COURIER_PRIME_REGULAR', file: 'Courier Prime.ttf', weight: 'normal', style: 'normal' },
    { name: 'COURIER_PRIME_BOLD', file: 'Courier Prime Bold.ttf', weight: 'bold', style: 'normal' },
    { name: 'COURIER_PRIME_ITALIC', file: 'Courier Prime Italic.ttf', weight: 'normal', style: 'italic' },
    { name: 'COURIER_PRIME_BOLD_ITALIC', file: 'Courier Prime Bold Italic.ttf', weight: 'bold', style: 'italic' },
];

let contentPdf = `/**
 * Base64 encoded Courier Prime TTF fonts for PDF embedding.
 * Generated from assets/fonts/
 */
`;

let contentCss = `/*
 * Base64 encoded Courier Prime WOFF/WOFF2 fonts for screen rendering in Obsidian.
 * Generated from assets/fonts/
 */
`;

for (const font of fonts) {
    const filePath = path.join(fontsDir, font.file);
    if (fs.existsSync(filePath)) {
        const ttfBuffer = fs.readFileSync(filePath);
        
        // 1. Encode TTF for PDF
        const ttfBase64 = ttfBuffer.toString('base64');
        contentPdf += `export const ${font.name} = "${ttfBase64}";\n\n`;
        console.log(`Encoded TTF for ${font.file} as ${font.name}`);

        // 2. Convert to WOFF2 & WOFF for CSS
        const woff2Buffer = ttf2woff2(ttfBuffer);
        const woffBuffer = Buffer.from(ttf2woff(new Uint8Array(ttfBuffer)).buffer);

        const woff2Base64 = woff2Buffer.toString('base64');
        const woffBase64 = woffBuffer.toString('base64');

        contentCss += `@font-face {
    font-family: 'Courier Prime';
    src: url('data:font/woff2;charset=utf-8;base64,${woff2Base64}') format('woff2'),
         url('data:font/woff;charset=utf-8;base64,${woffBase64}') format('woff');
    font-weight: ${font.weight};
    font-style: ${font.style};
}

`;
        console.log(`Converted and encoded WOFF/WOFF2 for ${font.file}`);
    } else {
        console.warn(`Font file not found: ${filePath}`);
    }
}

fs.writeFileSync(outputPdfFile, contentPdf);
console.log(`Updated ${outputPdfFile}`);

fs.writeFileSync(outputCssFile, contentCss);
console.log(`Updated ${outputCssFile}`);

