import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionDir = path.resolve(__dirname, '..');
const buildDir = path.join(extensionDir, 'dist');
const zipFile = path.join(extensionDir, 'dopaqueue-extension.zip');

console.log('Packaging extension...');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  console.error('Error: Build directory "dist" does not exist. Run "npm run build" first.');
  process.exit(1);
}

// Remove existing zip if it exists
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

const output = fs.createWriteStream(zipFile);
const archive = new archiver.ZipArchive({
  zlib: { level: 9 } // Maximum compression level
});

output.on('close', () => {
  console.log(`✓ Packaging complete! Created: ${zipFile} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('Warning during packaging:', err);
  } else {
    throw err;
  }
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Append files from dist directory recursively
archive.directory(buildDir, false);

archive.finalize();
