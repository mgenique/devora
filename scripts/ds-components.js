/**
 * Called by the /onem-frontend Claude Code skill via $SHELL.
 * Finds the @onemrvapublic/design-system version used by the current project,
 * then uses `git ls-tree` to list available components at that exact git tag —
 * non-destructive, no checkout required.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const _config = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'config.json'), 'utf8'));
const DS_REPO = require('path').join(_config.reposPath, 'design-system');
const DS_COMP = 'projects/onemrva/design-system';
const DS_PKG  = '@onemrvapublic/design-system';

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

function listFromGitTree(ref) {
  // Output format: "<mode> <type> <hash>\t<path>"  — filter tree (dir) entries only
  const out = execSync(
    `git -C "${DS_REPO}" ls-tree ${ref} -- ${DS_COMP}/`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  return out.trim().split('\n')
    .filter(line => /^\d+ tree /.test(line))
    .map(line => path.basename(line.split('\t')[1]))
    .sort();
}

function listFromFilesystem() {
  const full = path.join(DS_REPO, DS_COMP);
  return fs.readdirSync(full)
    .filter(f => fs.statSync(path.join(full, f)).isDirectory())
    .sort();
}

// ── Main ───────────────────────────────────────────────────────────────────────

const found = findDsVersion(process.cwd());

if (found) {
  const { version, source } = found;
  const tag = resolveGitTag(version);

  console.log(`Design system: \`${DS_PKG}@${version}\` (from ${path.relative(process.cwd(), source) || source})`);

  if (tag) {
    console.log(`Git tag: \`${tag}\` — component list reflects this exact version.\n`);
    try {
      listFromGitTree(tag).forEach(d => console.log(`- \`${DS_PKG}/${d}\``));
    } catch (e) {
      console.log(`(git ls-tree failed: ${e.message} — falling back to filesystem HEAD)\n`);
      listFromFilesystem().forEach(d => console.log(`- \`${DS_PKG}/${d}\``));
    }
  } else {
    console.log(`Tag \`v${version}\` not found locally — component list from filesystem HEAD.\n`);
    listFromFilesystem().forEach(d => console.log(`- \`${DS_PKG}/${d}\``));
  }
} else {
  console.log(`No \`${DS_PKG}\` dependency found in any package.json — component list from filesystem HEAD.\n`);
  try {
    listFromFilesystem().forEach(d => console.log(`- \`${DS_PKG}/${d}\``));
  } catch (e) {
    console.log(`ERROR: could not read design system at ${DS_REPO}: ${e.message}`);
  }
}
