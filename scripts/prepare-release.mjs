// Prepares a website release after building the APK.
//
// 1. Copies the freshly built APK (android/.../release/prim.apk) to public/prim.apk
// 2. Updates public/website/version.json: version (from package.json), file size,
//    SHA-256 checksum, release date, and download file name.
//
// Release notes in version.json are NOT touched — edit those by hand, then
// commit and push. Render redeploys the static site automatically on push.
//
// Usage: npm run release:prepare

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicApk = path.join(root, 'public', 'prim.apk');
const versionFile = path.join(root, 'public', 'website', 'version.json');

const builtApkCandidates = [
  path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'prim.apk'),
  path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
];

const builtApk = builtApkCandidates.find((candidate) => fs.existsSync(candidate));
if (builtApk) {
  fs.copyFileSync(builtApk, publicApk);
  console.log(`Copied ${path.relative(root, builtApk)} -> public/prim.apk`);
} else {
  console.warn('No freshly built APK found under android/app/build/outputs/apk/release/.');
  console.warn('Run "npm run build:apk" first, or continue to re-hash the existing public APK.');
}

if (!fs.existsSync(publicApk)) {
  console.error('public/prim.apk does not exist. Nothing to release.');
  process.exit(1);
}

const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const apkBytes = fs.readFileSync(publicApk);
const sha256 = crypto.createHash('sha256').update(apkBytes).digest('hex');

const manifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
manifest.version = version;
manifest.releasedAt = new Date().toISOString().slice(0, 10);
manifest.apkFileName = 'prim.apk';
manifest.fileSizeBytes = apkBytes.length;
manifest.sha256 = sha256;
fs.writeFileSync(versionFile, `${JSON.stringify(manifest, null, 2)}\n`);

console.log('\nUpdated public/website/version.json:');
console.log(`  version:   ${manifest.version}`);
console.log(`  released:  ${manifest.releasedAt}`);
console.log(`  size:      ${(apkBytes.length / (1024 * 1024)).toFixed(1)} MB`);
console.log(`  sha256:    ${sha256}`);
console.log('\nNext steps:');
console.log('  1. Edit releaseNotes in public/website/version.json (and bump package.json version BEFORE building, if you have not).');
console.log('  2. Commit and push — Render redeploys the static site automatically.');
