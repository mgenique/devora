/**
 * Lists the components a design system repo provides.
 *
 * Referenced from a skill file (see `skill.example.md`) through the
 * `$DS_COMPONENTS` placeholder, which Devora replaces with this script's
 * output before writing `.devora-skill.md` into the target repo.
 *
 * Everything is driven by `config.json`:
 *   designSystemPath           path to the local design system repo (required)
 *   designSystemPackage        npm package name, e.g. "@acme/design-system" (optional)
 *   designSystemComponentsDir  dir inside the repo holding one folder per
 *                              component, e.g. "projects/acme/design-system"
 *                              (optional — auto-detected when omitted)
 *
 * When a package name is configured, the version the current project depends on
 * is resolved and the component list is read from the matching git tag with
 * `git ls-tree` — non-destructive, no checkout required — so the list always
 * matches the version actually in use.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

const DS_REPO = (config.designSystemPath || '').trim();
const DS_PKG  = (config.designSystemPackage || '').trim();
const DS_COMP = (config.designSystemComponentsDir || '').trim();

// Conventional locations for "one folder per component", tried in order when
// `designSystemComponentsDir` is not configured.
const COMPONENT_DIR_CANDIDATES = [
  'projects', 'packages', 'libs', 'src/lib', 'src/components', 'src', 'components',
];

if (!DS_REPO) {
  console.log('No `designSystemPath` configured in Devora settings — component list unavailable.');
  process.exit(0);
}

// Walk up from dir looking for a package.json that declares the DS dependency.
// Also scans one level of immediate subdirectories as a fallback (for monorepo roots).
function findDsVersion(startDir) {
  // Walk up
  let dir = startDir;
  const root = path.parse(dir).root;
  while (dir !== root) {
    const version = readVersionFrom(path.join(dir, 'package.json'));
    if (version) return { version, source: path.join(dir, 'package.json') };
    dir = path.dirname(dir);
  }

  // Scan immediate subdirectories (handles monorepo root invocation)
  try {
    for (const sub of fs.readdirSync(startDir)) {
      const version = readVersionFrom(path.join(startDir, sub, 'package.json'));
      if (version) return { version, source: path.join(startDir, sub, 'package.json') };
    }
  } catch (_) {}

  return null;
}

function readVersionFrom(pkgFile) {
  if (!fs.existsSync(pkgFile)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    const raw = all[DS_PKG];
    if (!raw) return null;
    // Strip semver range specifiers: ^, ~, >=, <=, >, <, whitespace
    return raw.replace(/^[\^~>=<\s]+/, '').split(/\s+/)[0];
  } catch (_) {
    return null;
  }
}

function resolveGitTag(version) {
  // semantic-release uses v{major}.{minor}.{patch} — try that first, then bare version
  for (const tag of [`v${version}`, version]) {
    try {
      execSync(`git -C "${DS_REPO}" cat-file -t ${tag}`, { stdio: 'pipe' });
      return tag;
    } catch (_) {}
  }
  return null;
}

// Resolve the directory holding one folder per component, relative to the repo root.
function resolveComponentsDir() {
  if (DS_COMP) return DS_COMP;
  for (const candidate of COMPONENT_DIR_CANDIDATES) {
    const full = path.join(DS_REPO, candidate);
    try {
      if (fs.statSync(full).isDirectory() && fs.readdirSync(full).some(
        f => fs.statSync(path.join(full, f)).isDirectory()
      )) return candidate;
    } catch (_) {}
  }
  return '';
}

function listFromGitTree(ref, compDir) {
  // Output format: "<mode> <type> <hash>\t<path>"  — filter tree (dir) entries only
  const out = execSync(
    `git -C "${DS_REPO}" ls-tree ${ref} -- ${compDir ? `${compDir}/` : ''}`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  return out.trim().split('\n')
    .filter(line => /^\d+ tree /.test(line))
    .map(line => path.basename(line.split('\t')[1]))
    .sort();
}

function listFromFilesystem(compDir) {
  const full = path.join(DS_REPO, compDir);
  return fs.readdirSync(full)
    .filter(f => !f.startsWith('.') && f !== 'node_modules')
    .filter(f => fs.statSync(path.join(full, f)).isDirectory())
    .sort();
}

// Components are referenced as `<package>/<name>` when a package name is known,
// otherwise just by folder name.
function printComponents(names) {
  names.forEach(n => console.log(`- \`${DS_PKG ? `${DS_PKG}/${n}` : n}\``));
}

// ── Main ───────────────────────────────────────────────────────────────────────

const compDir = resolveComponentsDir();
const found   = DS_PKG ? findDsVersion(process.cwd()) : null;

if (found) {
  const { version, source } = found;
  const tag = resolveGitTag(version);

  console.log(`Design system: \`${DS_PKG}@${version}\` (from ${path.relative(process.cwd(), source) || source})`);

  if (tag) {
    console.log(`Git tag: \`${tag}\` — component list reflects this exact version.\n`);
    try {
      printComponents(listFromGitTree(tag, compDir));
    } catch (e) {
      console.log(`(git ls-tree failed: ${e.message} — falling back to filesystem HEAD)\n`);
      printComponents(listFromFilesystem(compDir));
    }
  } else {
    console.log(`Tag \`v${version}\` not found locally — component list from filesystem HEAD.\n`);
    printComponents(listFromFilesystem(compDir));
  }
} else {
  if (DS_PKG) {
    console.log(`No \`${DS_PKG}\` dependency found in any package.json — component list from filesystem HEAD.\n`);
  } else {
    console.log(`Components found in \`${DS_REPO}${compDir ? `/${compDir}` : ''}\`:\n`);
  }
  try {
    printComponents(listFromFilesystem(compDir));
  } catch (e) {
    console.log(`ERROR: could not read design system at ${DS_REPO}: ${e.message}`);
  }
}
