const fs = require('fs');
const path = require('path');

const srcHtmlPath = path.join(__dirname, 'src', 'stitch-template.html');
const appJsxPath = path.join(__dirname, 'src', 'App.jsx');
const indexCssPath = path.join(__dirname, 'src', 'index.css');

let html = fs.readFileSync(srcHtmlPath, 'utf8');

// Extract styles
const styleMatches = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
let cssContent = '';
styleMatches.forEach(match => {
    cssContent += match[1] + '\n';
});

// Write to index.css
fs.appendFileSync(indexCssPath, cssContent);

// Extract body
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
let bodyContent = bodyMatch ? bodyMatch[1] : '';

// Convert class to className
bodyContent = bodyContent.replace(/class="/g, 'className="');
// Convert inline styles if any (rare in stitch tailwind output, but let's be careful)
// We'll leave it for now to see if it causes issues.
// Convert self-closing tags
bodyContent = bodyContent.replace(/<img(.*?)>/g, (m, g1) => {
    if (!g1.endsWith('/')) return `<img${g1} />`;
    return m;
});


const appJsxCode = `
import { useState } from 'react'

function App() {
  return (
    <>
      ${bodyContent}
    </>
  )
}

export default App
`;

fs.writeFileSync(appJsxPath, appJsxCode);

console.log('Successfully generated App.jsx and index.css');
