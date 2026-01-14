import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AnimationEntry {
  path: string;
  pack: string;
  category: string | null;
  filename: string;
}

interface AnimationManifest {
  version: number;
  generatedAt: string;
  totalCount: number;
  packs: string[];
  animations: AnimationEntry[];
}

const ANIMATIONS_DIR = path.join(__dirname, '..', 'public', 'animations');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'animation-manifest.json');

function walkDir(dir: string, baseDir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath, baseDir));
    } else if (entry.name.endsWith('.vrma')) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push(relativePath);
    }
  }

  return files;
}

function parseAnimationPath(relativePath: string): AnimationEntry {
  const parts = relativePath.split(path.sep);
  const pack = parts[0];
  const filename = parts[parts.length - 1];

  // Category is the folder between pack and filename (if exists)
  let category: string | null = null;
  if (parts.length > 2) {
    // Could be nested like pack/gender/category/file.vrma or pack/category/file.vrma
    category = parts.slice(1, -1).join('/');
  }

  return {
    path: relativePath.replace(/\\/g, '/'), // Normalize to forward slashes
    pack,
    category,
    filename: filename.replace('.vrma', ''),
  };
}

function generateManifest(): void {
  console.log('Scanning animations directory...');

  if (!fs.existsSync(ANIMATIONS_DIR)) {
    console.error(`Animations directory not found: ${ANIMATIONS_DIR}`);
    process.exit(1);
  }

  const files = walkDir(ANIMATIONS_DIR, ANIMATIONS_DIR);
  console.log(`Found ${files.length} .vrma files`);

  const animations = files.map(parseAnimationPath);
  const packs = [...new Set(animations.map(a => a.pack))].sort();

  const manifest: AnimationManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalCount: animations.length,
    packs,
    animations,
  };

  // Ensure public directory exists
  const publicDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to: ${OUTPUT_FILE}`);
  console.log(`Total animations: ${manifest.totalCount}`);
  console.log(`Packs: ${packs.join(', ')}`);
}

generateManifest();
