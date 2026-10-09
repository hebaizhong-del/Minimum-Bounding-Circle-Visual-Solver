import fs from 'fs';
import path from 'path';

const iconDir = path.resolve('./src-tauri/icons');
if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
}

// Minimal valid PNG buffer
const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAA2SURBVHgB7c0BDQAACAMw9s/9S3hhJ4OQg/S1TUkSJEiQIEFic0AECRIECRIEiSAJECRIEiRInm4e/C0e9E3L2wAAAABJRU5ErkJggg==',
    'base64'
);

fs.writeFileSync(path.join(iconDir, '32x32.png'), pngBuffer);
fs.writeFileSync(path.join(iconDir, '128x128.png'), pngBuffer);
fs.writeFileSync(path.join(iconDir, '128x128@2x.png'), pngBuffer);
fs.writeFileSync(path.join(iconDir, 'icon.icns'), pngBuffer);
fs.writeFileSync(path.join(iconDir, 'icon.ico'), pngBuffer);

console.log('Tauri icons generated successfully!');
