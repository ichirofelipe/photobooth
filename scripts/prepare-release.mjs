// Prepares a website release after building the APK.
//
// 1. Copies the freshly built APK (newest of android/.../release/*.apk) to website/prim.apk
// 2. Updates website/version.json: version (from package.json), file size,
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
const websiteApk = path.join(root, 'website', 'prim.apk');
const versionFile = path.join(root, 'website', 'version.json');

const builtApkCandidates = [
  path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
  path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'prim.apk'),
];

// Pick the most recently built APK so a stale output can never be released.
const builtApk = builtApkCandidates
  .filter((candidate) => fs.existsSync(candidate))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

if (builtApk) {
  fs.copyFileSync(builtApk, websiteApk);
  console.log(`Copied ${path.relative(root, builtApk)} -> website/prim.apk`);
} else {
  console.warn('No freshly built APK found under android/app/build/outputs/apk/release/.');
  console.warn('Run "npm run build:apk" first, or continue to re-hash the existing website APK.');
}

if (!fs.existsSync(websiteApk)) {
  console.error('website/prim.apk does not exist. Nothing to release.');
  process.exit(1);
}

const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const apkBytes = fs.readFileSync(websiteApk);
const sha256 = crypto.createHash('sha256').update(apkBytes).digest('hex');

const manifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
manifest.version = version;
manifest.releasedAt = new Date().toISOString().slice(0, 10);
manifest.apkFileName = 'prim.apk';
manifest.fileSizeBytes = apkBytes.length;
manifest.sha256 = sha256;
fs.writeFileSync(versionFile, `${JSON.stringify(manifest, null, 2)}\n`);

console.log('\nUpdated website/version.json:');
console.log(`  version:   ${manifest.version}`);
console.log(`  released:  ${manifest.releasedAt}`);
console.log(`  size:      ${(apkBytes.length / (1024 * 1024)).toFixed(1)} MB`);
console.log(`  sha256:    ${sha256}`);
console.log('\nNext steps:');
console.log('  1. Edit releaseNotes in website/version.json (and bump package.json version BEFORE building, if you have not).');
console.log('  2. Commit and push — Render redeploys the static site automatically.');
