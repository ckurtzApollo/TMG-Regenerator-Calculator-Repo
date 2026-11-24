// Inline styles.css, model.js and app.js into one self-contained HTML file: dist/tmg-regenerator-calculator.html
const fs = require('fs');
const path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, '..', 'src', p), 'utf8');
let html = src('index.html')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${src('styles.css')}</style>`)
  .replace('<script src="model.js"></script>', () => `<script>\n${src('model.js')}</script>`)
  .replace('<script src="presets.js"></script>', () => `<script>\n${src('presets.js')}</script>`)
  .replace('<script src="storage.js"></script>', () => `<script>\n${src('storage.js')}</script>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${src('app.js')}</script>`);
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'tmg-regenerator-calculator.html'), html);
console.log('Built dist/tmg-regenerator-calculator.html');
