// Solara Bay — a 2D top-down open-world crime game for the make.fun GTA 6
// competition. This file builds the game and the submission dossier: it
// copies the game/ sources and the screenshots into the output directory,
// then writes dossier.json through the kit's vendor buildDossier helper.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || 'out';
const root = process.cwd();

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

// Copy the game sources verbatim, so the dossier's game/ matches this repo.
copyDir(path.join(root, 'game'), path.join(outDir, 'game'));

// Copy the four screenshots the judge reads. Fail loudly if one is
// missing, so a broken dossier is never built by accident.
fs.mkdirSync(path.join(outDir, 'screenshots'), { recursive: true });
for (const shot of ['1-cover.jpg', '2-drive.jpg', '3-city.jpg', '4-title.jpg']) {
  const src = path.join(root, 'screenshots', shot);
  if (!fs.existsSync(src)) throw new Error(`missing screenshot: ${src}`);
  fs.copyFileSync(src, path.join(outDir, 'screenshots', shot));
}

// The dossier (makefun/dossier/v1) the judge reads: the game sources plus
// the screenshots, built by the kit's vendored library. The scorer's own
// caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots
// or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
fs.writeFileSync(path.join(outDir, 'dossier.json'), dossier);
console.log(`dossier.json: ${Buffer.byteLength(dossier, 'utf8')} bytes`);
