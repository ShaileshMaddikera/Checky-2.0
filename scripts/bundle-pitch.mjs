import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const inputFile = path.join(publicDir, 'pitch.html');
const outputFile = path.join(publicDir, 'checky-pitch-deck.html');

let html = fs.readFileSync(inputFile, 'utf8');

// Replace all <img src="pitch-images/..."> with base64 data URIs
html = html.replace(/src="(pitch-images\/[^"]+)"/g, (match, relPath) => {
  const absPath = path.join(publicDir, relPath);
  if (!fs.existsSync(absPath)) {
    console.warn(`  ⚠ missing: ${relPath} (keeping as-is)`);
    return match;
  }
  const ext = path.extname(relPath).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
             : ext === 'png' ? 'image/png'
             : ext === 'webp' ? 'image/webp'
             : ext === 'svg' ? 'image/svg+xml'
             : 'image/png';
  const data = fs.readFileSync(absPath).toString('base64');
  console.log(`  ✓ embedded: ${relPath} (${Math.round(data.length * 0.75 / 1024)}KB)`);
  return `src="data:${mime};base64,${data}"`;
});

fs.writeFileSync(outputFile, html);
const sizeKB = Math.round(fs.statSync(outputFile).size / 1024);
console.log(`\n✅ Bundled → public/checky-pitch-deck.html (${sizeKB}KB)`);
