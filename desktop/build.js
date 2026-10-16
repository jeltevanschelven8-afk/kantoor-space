/* =========================================================
   Kantoor Space — bouwt Inkt en Cel als Linux-programma (Electron).
   Gebruik (in de map desktop):
     npm install
     node build.js                 # beide apps, AppImage + deb + rpm + tar.gz, x64 + arm64 (op Linux)
     node build.js inkt            # alleen Inkt
     node build.js cel --dir       # alleen uitpakken (snel testen, geen installatiebestand)
     node build.js inkt --target=AppImage --arch=x64
     node build.js --stage-only    # alleen klaarzetten; testen met: npx electron stage/inkt
   Resultaat: desktop/dist/
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const builder = require('electron-builder');

const ROOT = path.resolve(__dirname, '..');
const VERSION = require('./package.json').version;

const APPS = {
  inkt: {
    name: 'Inkt', port: 8080, src: ROOT, desc: 'Word processor from Kantoor Space, compatible with .docx files',
    files: ['index.html', 'manifest.webmanifest', 'sw.js', 'server.js', 'js', 'css', 'fonts', 'vendor', 'icons', 'LICENSE', 'DERDEN-LICENTIES.md'],
    mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  cel: {
    name: 'Cel', port: 8081, src: path.join(ROOT, 'cel'), desc: 'Spreadsheet from Kantoor Space, compatible with .xlsx files',
    files: ['index.html', 'manifest.webmanifest', 'sw.js', 'server.js', 'js', 'css', 'fonts', 'vendor', 'icons', '../LICENSE', '../DERDEN-LICENTIES.md'],
    mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  },
};

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const opt = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1].split(',') : d; };
const dirOnly = args.includes('--dir');

/* Startscript dat het echte programma (<app>.bin) start.
   Ubuntu 24.04 en nieuwer blokkeren de "user namespaces" die de Chromium-sandbox nodig heeft; zonder setuid-sandbox
   (zoals in een AppImage of .tar.gz) start een Electron-programma dan helemaal niet. Alleen in die situatie start het met --no-sandbox.
   Met een werkende sandbox (bijv. de .deb/.rpm-installatie, Arch, Fedora) blijft de sandbox gewoon aan. */
const launcher = (id) => `#!/bin/sh
# Kantoor Space — start ${id} (made by JJ van Schelven)
HERE="$(dirname "$(readlink -f "$0")")"
EXTRA=""
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] || [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = "0" ]; then
  if [ ! -u "$HERE/chrome-sandbox" ] || [ "$(stat -c %u "$HERE/chrome-sandbox" 2>/dev/null)" != "0" ]; then EXTRA="--no-sandbox"; fi
fi
exec "$HERE/${id}.bin" $EXTRA "$@"
`;
const afterPack = async (ctx) => {
  if (ctx.electronPlatformName !== 'linux') return;
  const exe = path.join(ctx.appOutDir, ctx.packager.executableName);
  fs.renameSync(exe, exe + '.bin');
  fs.writeFileSync(exe, launcher(ctx.packager.executableName), { mode: 0o755 });
};

const copy = (from, to) => {
  const st = fs.statSync(from);
  if (st.isDirectory()) { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from)) { if (f === 'gedeeld' || f.startsWith('.')) continue; copy(path.join(from, f), path.join(to, f)); } }
  else fs.copyFileSync(from, to);
};

const stage = (id) => {
  const a = APPS[id];
  const dir = path.join(__dirname, 'stage', id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'web'), { recursive: true });
  for (const f of a.files) copy(path.join(a.src, f), path.join(dir, 'web', path.basename(f)));
  fs.copyFileSync(path.join(__dirname, 'main.js'), path.join(dir, 'main.js'));
  fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify({ name: a.name, id, port: a.port }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: id, productName: a.name, version: VERSION, description: a.desc, main: 'main.js', desktopName: id + '.desktop',
    author: { name: 'JJ van Schelven', email: 'noreply@github.com' }, license: 'MIT',
    homepage: 'https://github.com/jeltevanschelven8-afk/kantoor-space',
  }, null, 2));
  return dir;
};

(async () => {
  const ids = only.length ? only : Object.keys(APPS);
  for (const id of ids) {
    const a = APPS[id];
    if (!a) throw new Error('Onbekende app: ' + id);
    const dir = stage(id);
    if (args.includes('--stage-only')) { console.log('klaargezet: ' + dir); continue; }   // testen: npx electron stage/<app>
    console.log(`\n=== ${a.name} ${VERSION} ===`);
    const targets = dirOnly ? ['dir'] : opt('target', ['AppImage', 'deb', 'rpm', 'tar.gz']);
    const arch = opt('arch', ['x64', 'arm64']).map((x) => builder.Arch[x]);
    await builder.build({
      projectDir: __dirname,
      targets: builder.Platform.LINUX.createTarget(targets, ...arch),
      publish: 'never',
      config: {
        appId: 'space.kantoor.' + id,
        productName: a.name,
        directories: { app: dir, output: path.join(__dirname, 'dist') },
        files: ['**/*'],
        asar: true,
        asarUnpack: [],
        afterPack,
        artifactName: '${productName}-${version}-linux-${arch}.${ext}',
        linux: {
          executableName: id,
          icon: path.join(dir, 'web', 'icons', 'icon-512.png'),
          category: 'Office',
          synopsis: a.desc,
          description: `${a.desc}. Made by JJ van Schelven. No account, no tracking, works offline.`,
          maintainer: 'JJ van Schelven <noreply@github.com>',
          mimeTypes: a.mime,
          syncDesktopName: true,
          desktop: { entry: { Name: a.name, Comment: a.desc, StartupWMClass: a.name } },
        },
        deb: { packageCategory: 'editors' },
        rpm: { fpm: ['--rpm-rpmbuild-define=_build_id_links none'] },
      },
    });
  }
  console.log('\nKlaar: zie desktop/dist/');
})().catch((e) => { console.error(e); process.exit(1); });
