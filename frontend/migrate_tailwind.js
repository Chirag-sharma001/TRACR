const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'index.html');
const indexCssPath = path.join(__dirname, 'src', 'index.css');

let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Extract tailwind config
const configMatch = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
let configStr = configMatch ? configMatch[1] : '';

let CSS_ADDITIONS = `
@import "tailwindcss";
@plugin "@tailwindcss/forms";
@plugin "@tailwindcss/container-queries";

@theme {
`;

if (configStr) {
    // we just manually evaluate the object since it's just a raw object
    const fn = new Function('return ' + configStr);
    const config = fn();
    const extend = config.theme.extend;
    
    // Add colors
    if (extend.colors) {
        for (const [key, value] of Object.entries(extend.colors)) {
            CSS_ADDITIONS += `  --color-${key}: ${value};\n`;
        }
    }
    // Add border radius
    if (extend.borderRadius) {
        for (const [key, value] of Object.entries(extend.borderRadius)) {
            if (key === 'DEFAULT') {
                CSS_ADDITIONS += `  --radius: ${value};\n`;
            } else {
                CSS_ADDITIONS += `  --radius-${key}: ${value};\n`;
            }
        }
    }
    // Add fonts
    if (extend.fontFamily) {
        for (const [key, value] of Object.entries(extend.fontFamily)) {
            CSS_ADDITIONS += `  --font-${key}: ${value.map(v => '"' + v + '"').join(', ')};\n`;
        }
    }
}
CSS_ADDITIONS += `}
`;

// Prepend to index.css
const curCss = fs.readFileSync(indexCssPath, 'utf8');
fs.writeFileSync(indexCssPath, CSS_ADDITIONS + '\n' + curCss);

// Clean up index.html
html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com\?.*?"><\/script>/g, '');
html = html.replace(/<script id="tailwind-config">[\s\S]*?<\/script>/g, '');

fs.writeFileSync(indexHtmlPath, html);
console.log("Migration complete!");
