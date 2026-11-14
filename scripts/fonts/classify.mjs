// Scan d:\BLENDER\font — 1 famille = 1 dossier de 1er niveau.
// Classe chaque famille : commercial_ok | personal_only | needs_review | unknown
// Lecture seule. Sortie : scripts/fonts/classification.json + résumé console.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || 'D:\\BLENDER\\font';
const OUT = path.join(process.cwd(), 'scripts', 'fonts', 'classification.json');

const FONT_EXT = new Set(['.ttf', '.otf', '.woff', '.woff2']);
const LIC_HINT = /licen|eula|readme|terms|agreement|read[\s_-]?me|info/i;

const PERSONAL = [
  'personal use only', 'personal-use', 'for personal use', 'free for personal',
  'non-commercial', 'noncommercial', 'not for commercial', 'no commercial',
  'demo version', 'demo font', 'trial version', 'evaluation only',
  'purchase a', 'buy a license', 'buy the full', 'donationware',
];
const COMMERCIAL = [
  'free for commercial', 'commercial use is allowed', 'commercial use allowed',
  '100% free', 'free for both personal and commercial', 'commercial license included',
  'sil open font license', 'open font license', 'ofl', 'apache license',
  'mit license', 'creative commons zero', 'cc0', 'public domain', 'unlicense',
];

function walk(dir, acc) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    if (e.name === '__MACOSX' || e.name.startsWith('._')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function readTextSafe(p) {
  try {
    if (fs.statSync(p).size > 2_000_000) return '';
    return fs.readFileSync(p, 'latin1').toLowerCase();
  } catch { return ''; }
}

const families = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== '__MACOSX')
  .map(d => d.name);

const result = [];
const counts = { commercial_ok: 0, personal_only: 0, needs_review: 0, unknown: 0 };

for (const fam of families) {
  const dir = path.join(ROOT, fam);
  const files = walk(dir, []);
  const fonts = files.filter(f => FONT_EXT.has(path.extname(f).toLowerCase()));
  if (fonts.length === 0) continue;

  const licFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return (ext === '.txt' || ext === '.md') && LIC_HINT.test(path.basename(f));
  });
  // inclut aussi tout .txt court du dossier au cas où
  const extraTxt = files.filter(f => path.extname(f).toLowerCase() === '.txt' && !licFiles.includes(f));
  const corpus = [...licFiles, ...extraTxt].map(readTextSafe).join('\n');
  const hasPdfLic = files.some(f => path.extname(f).toLowerCase() === '.pdf' && LIC_HINT.test(path.basename(f)));

  const pers = PERSONAL.some(s => corpus.includes(s));
  const comm = COMMERCIAL.some(s => corpus.includes(s));

  let cls;
  if (pers && !comm) cls = 'personal_only';
  else if (comm && !pers) cls = 'commercial_ok';
  else if (comm && pers) cls = 'needs_review';
  else if (!corpus.trim() && hasPdfLic) cls = 'needs_review'; // licence en PDF non lue
  else cls = 'unknown';

  counts[cls]++;
  const exts = {};
  for (const f of fonts) { const e = path.extname(f).toLowerCase().slice(1); exts[e] = (exts[e] || 0) + 1; }
  result.push({ family: fam, class: cls, fontCount: fonts.length, exts, licFiles: licFiles.map(f => path.basename(f)), hasPdfLic });
}

fs.writeFileSync(OUT, JSON.stringify({ root: ROOT, counts, families: result }, null, 2));
console.log('Familles avec polices :', result.length);
console.log(counts);
console.log('\nExemples commercial_ok :', result.filter(r => r.class === 'commercial_ok').slice(0, 12).map(r => r.family).join(' | '));
console.log('\nExemples personal_only :', result.filter(r => r.class === 'personal_only').slice(0, 12).map(r => r.family).join(' | '));
console.log('\nSortie :', OUT);
