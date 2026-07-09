'use strict';
const { Router }        = require('express');
const { getConfig }     = require('../config');
const { jiraFetchRaw }  = require('../jira');
const fs   = require('fs');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');

const router = Router();

function toPosix(winPath) {
  return winPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, l) => `/${l.toLowerCase()}`);
}

router.post('/start-dev', async (req, res) => {
  const config = getConfig();
  const {
    ticketKey, ticketTitle, ticketDescription, instructions,
    attachments, mode, repo, useOnemFrontend, challengeDesignSystem,
    dangerouslyGrantPermissions,
    suggestCommit, commitFormat, comments, svgItems,
  } = req.body;

  if (!repo) return res.status(400).json({ error: 'No repo selected' });

  const projectWinPath   = path.join(config.reposPath, repo);
  const projectPosixPath = toPosix(projectWinPath);

  const designSystemPath = (config.designSystemPath || '').trim();
  const dsPosixPath      = designSystemPath ? toPosix(designSystemPath) : '';

  // Download image attachments into .devora-attachments/
  const savedAttachments = [];
  if (attachments?.length) {
    const attachDir = path.join(projectWinPath, '.devora-attachments');
    fs.mkdirSync(attachDir, { recursive: true });
    for (const { url, filename } of attachments) {
      try {
        const { buffer } = await jiraFetchRaw(url);
        fs.writeFileSync(path.join(attachDir, filename), buffer);
        savedAttachments.push(filename);
      } catch (_) {}
    }
  }

  // Save design SVGs into .devora-svgs/
  const savedSvgs = [];
  if (svgItems?.length) {
    const svgDir = path.join(projectWinPath, '.devora-svgs');
    fs.mkdirSync(svgDir, { recursive: true });
    svgItems.forEach((item, i) => {
      if (!item?.svg) return;
      const slug = (item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `design-${i + 1}`;
      let filename = `${slug}.svg`;
      if (savedSvgs.some(s => s.filename === filename)) filename = `${slug}-${i + 1}.svg`;
      fs.writeFileSync(path.join(svgDir, filename), item.svg);
      savedSvgs.push({ title: item.title || filename, filename });
    });
  }

  // Write .devora-context.md into the project
  const context = [
    `# Jira Ticket: ${ticketKey}`,
    ``,
    `## ${ticketTitle}`,
    ``,
    `## Description`,
    ticketDescription || '_No description provided._',
    ...(instructions ? [``, `## Additional Instructions`, instructions] : []),
    ...(comments?.length ? [
      ``,
      `## Selected Comments`,
      ...comments.map(c => `**${c.author}:**\n${c.text}`),
    ] : []),
    ...(savedAttachments.length ? [
      ``,
      `## Screenshots & Attachments`,
      `The following images have been saved in \`.devora-attachments/\` for reference:`,
      ...savedAttachments.map(f => `- .devora-attachments/${f}`),
    ] : []),
    ...(savedSvgs.length ? [
      ``,
      `## Design References (Figma SVGs)`,
      `The following SVG exports from Figma have been saved in \`.devora-svgs/\`. Use them as the visual design reference when implementing the corresponding UI elements — match their layout, spacing, colors and typography:`,
      ...savedSvgs.map(s => `- **${s.title}**: .devora-svgs/${s.filename}`),
    ] : []),
    ...(dsPosixPath ? [
      ``,
      `## Design System`,
      `The design system project source is available locally at \`${dsPosixPath}\`. Explore it to discover the components, variants and styling options it provides.`,
      `- Before building any UI element, check whether the design system already provides a component for it, and use that component in priority.`,
      ...(savedSvgs.length ? [
        `- Compare each design SVG in \`.devora-svgs/\` with the design system components: when an element in a design (button, table, input, badge, ...) matches an existing component, use the component instead of recreating it with custom CSS. For example, a table containing buttons should be built from the design system's table and button components, not hand-styled markup.`,
      ] : []),
      `- Avoid custom CSS and style overrides whenever the design system offers an equivalent option — the goal is zero CSS overrides for anything the design system already covers.`,
    ] : []),
    ...(challengeDesignSystem ? [
      ``,
      `## Challenge the Design System`,
      `If part of the design cannot be achieved with existing design system components and would require custom CSS or overrides, do NOT write it silently. For each such gap, stop and ask the user how to proceed — for example: contact the design system team to request the missing component/variant, implement a local one-off with custom CSS, or adapt the design to what the design system offers. Wait for the user's decision before implementing that part.`,
    ] : []),
  ].join('\n');

  fs.writeFileSync(path.join(projectWinPath, '.devora-context.md'), context);

  // Expand and write the ONEM frontend skill if requested
  if (useOnemFrontend) {
    try {
      const skillTemplatePath = path.join(__dirname, '..', '..', '.claude', 'commands', 'onem-frontend.md');
      let skill = fs.readFileSync(skillTemplatePath, 'utf8');
      skill = skill.replace(/^---\n[\s\S]*?\n---\n\n?/, '');

      let components = '(component list unavailable)';
      try {
        const dsScript = path.join(__dirname, '..', '..', 'scripts', 'ds-components.js');
        components = execSync(`node "${dsScript}"`, {
          cwd:      projectWinPath,
          encoding: 'utf8',
          timeout:  15000,
        }).trim();
      } catch (_) {}
      skill = skill.replace(/\$SHELL\([^)]*ds-components\.js[^)]*\)/, components);
      skill = skill.replace('$ARGUMENTS', `${ticketKey} — ${ticketTitle}`);

      fs.writeFileSync(path.join(projectWinPath, '.devora-skill.md'), skill);
    } catch (e) {
      console.error('Failed to write skill file:', e.message);
    }
  }

  // Build Claude prompt
  const isPlan       = mode === 'plan';
  const commitSuffix = (!isPlan && suggestCommit && commitFormat)
    ? ` When you have finished implementing, suggest a commit message to copy-paste. Use exactly this format: ${commitFormat}`
    : '';
  const skillPreamble = useOnemFrontend
    ? 'Read `.devora-skill.md` first — it contains your Angular/ONEM frontend role, conventions, and available design system components. Then '
    : '';
  const svgSuffix = savedSvgs.length
    ? ' Figma design SVGs are in .devora-svgs/ (see the Design References section) — use them as the design reference for the UI.'
    : '';
  const dsSuffix = dsPosixPath
    ? ` A design system is available at ${dsPosixPath} — reuse its components in priority instead of writing custom CSS (see the Design System section).`
    : '';
  const challengeSuffix = challengeDesignSystem
    ? ' If something requires custom CSS because the design system does not cover it, ask the user how to handle it before implementing (see the Challenge the Design System section).'
    : '';
  const claudePrompt = isPlan
    ? `${skillPreamble}read .devora-context.md for Jira ticket ${ticketKey}, then enter plan mode and establish a detailed implementation plan. Do not write any code yet — only analyse the ticket and produce a step-by-step plan.${instructions ? ' Pay special attention to the Additional Instructions section.' : ''}${savedAttachments.length ? ' Screenshots are in .devora-attachments/.' : ''}${svgSuffix}${dsSuffix}${challengeSuffix}`
    : `${skillPreamble}implement Jira ticket ${ticketKey}. Read .devora-context.md for full details.${instructions ? ' Pay special attention to the Additional Instructions section.' : ''}${savedAttachments.length ? ' Screenshots from the ticket are in .devora-attachments/.' : ''}${svgSuffix}${dsSuffix}${challengeSuffix}${commitSuffix}`;

  const claudeFlags  = dangerouslyGrantPermissions ? ' --dangerously-skip-permissions' : '';
  const script       = `#!/bin/bash\ncd "${projectPosixPath}"\nclaude${claudeFlags} "${claudePrompt.replace(/"/g, '\\"')}"\n`;
  const scriptWinPath = path.join(projectWinPath, '.devora-start.sh');
  fs.writeFileSync(scriptWinPath, script);

  const manualCmd = `cd "${projectPosixPath}" && claude${claudeFlags} "${claudePrompt.replace(/"/g, '\\"')}"`;

  launchTerminal(scriptWinPath, manualCmd, res);
});

// ── POST /api/fix-build ───────────────────────────────────────────────────

function projectUsesSpotless(projectWinPath) {
  try {
    const pomPath = path.join(projectWinPath, 'pom.xml');
    if (!fs.existsSync(pomPath)) return false;
    return fs.readFileSync(pomPath, 'utf8').toLowerCase().includes('spotless');
  } catch { return false; }
}

router.post('/fix-build', (req, res) => {
  const config = getConfig();
  const { buildContext, instructions, repo, mode, dangerouslyGrantPermissions, suggestCommit, commitFormat } = req.body;

  if (!repo) return res.status(400).json({ error: 'No repo selected' });

  const projectWinPath   = path.join(config.reposPath, repo);
  const projectPosixPath = toPosix(projectWinPath);

  const hasBuildStageFailure = (buildContext.failedTasks || []).some(t =>
    /build/i.test(t.stageName || '') || /build/i.test(t.taskName || '')
  );
  const usesSpotless = hasBuildStageFailure && projectUsesSpotless(projectWinPath);

  const contextLines = [
    `# Fix Build #${buildContext.buildId}`,
    ``,
    `## Build info`,
    `- Pipeline: ${buildContext.definitionName}`,
    `- Branch: ${buildContext.branch}`,
    `- Triggered by: ${buildContext.requestedFor}`,
    `- Commit: ${buildContext.commitShort}`,
    ``,
    `## Failed tasks`,
    ...(buildContext.failedTasks || []).flatMap(t => [
      ``,
      `### ${t.taskName}  (stage: ${t.stageName})`,
      '```',
      t.logLines,
      '```',
    ]),
    ...(usesSpotless ? [
      ``,
      `## Hint: Spotless detected`,
      `This project uses the Spotless Maven plugin. If the failure is a code-formatting check, run \`mvn spotless:apply\` to auto-fix formatting before re-building.`,
    ] : []),
    ...(instructions ? [``, `## Additional instructions`, instructions] : []),
    ``,
    `Analyse the failures above, find the root cause in this repository, and fix the code.`,
  ];

  fs.writeFileSync(path.join(projectWinPath, '.devora-context.md'), contextLines.join('\n'));

  const isPlan       = mode === 'plan';
  const commitSuffix = (!isPlan && suggestCommit && commitFormat)
    ? ` When you have finished fixing, suggest a commit message to copy-paste. Use exactly this format: ${commitFormat}`
    : '';
  const spotlessSuffix = usesSpotless
    ? ` This project uses Spotless — if the failure is a formatting check, run \`mvn spotless:apply\` first.`
    : '';
  const claudePrompt = isPlan
    ? `Read .devora-context.md for the failing build context, then enter plan mode and produce a step-by-step fix plan. Do not write any code yet.`
    : `Read .devora-context.md and fix the failing build.${spotlessSuffix}${commitSuffix}`;

  const claudeFlags  = dangerouslyGrantPermissions ? ' --dangerously-skip-permissions' : '';
  const script       = `#!/bin/bash\ncd "${projectPosixPath}"\nclaude${claudeFlags} "${claudePrompt.replace(/"/g, '\\"')}"\n`;
  const scriptWinPath = path.join(projectWinPath, '.devora-start.sh');
  fs.writeFileSync(scriptWinPath, script);

  const manualCmd = `cd "${projectPosixPath}" && claude${claudeFlags} "${claudePrompt.replace(/"/g, '\\"')}"`;
  launchTerminal(scriptWinPath, manualCmd, res);
});

// ── Terminal launcher (shared) ────────────────────────────────────────────

function launchTerminal(scriptPath, manualCmd, res) {
  if (process.platform === 'win32') {
    const gitBash = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ].find(p => fs.existsSync(p));

    if (!gitBash) return res.json({ ok: false, manual: manualCmd });

    exec(`start "" "${gitBash}" "${toPosix(scriptPath)}"`, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  } else {
    const TERMINALS = [
      { bin: 'alacritty',      args: s => ['-e', 'bash', s] },
      { bin: 'gnome-terminal', args: s => ['--', 'bash', s] },
      { bin: 'foot',           args: s => ['bash', s] },
      { bin: 'kitty',          args: s => ['bash', s] },
      { bin: 'wezterm',        args: s => ['start', '--', 'bash', s] },
      { bin: 'xterm',          args: s => ['-e', 'bash', s] },
      { bin: 'konsole',        args: s => ['-e', 'bash', s] },
      { bin: 'xfce4-terminal', args: s => ['--command', `bash ${s}`] },
    ];

    const term = TERMINALS.find(t => {
      try { execSync(`which ${t.bin}`, { stdio: 'ignore' }); return true; } catch { return false; }
    });

    if (!term) return res.json({ ok: false, manual: manualCmd });

    // Forward display / session env vars so the terminal can connect to the
    // graphical session even when spawned as a detached child of the server.
    // Query live via systemctl so this works when the service started before
    // the graphical session (boot-time autostart).
    const SESSION_KEYS = [
      'DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR',
      'DBUS_SESSION_BUS_ADDRESS', 'XDG_SESSION_TYPE',
    ];
    const displayEnv = {};
    try {
      const sysEnv = execSync('systemctl --user show-environment', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const line of sysEnv.split('\n')) {
        const eq = line.indexOf('=');
        if (eq > 0) {
          const key = line.slice(0, eq);
          if (SESSION_KEYS.includes(key)) displayEnv[key] = line.slice(eq + 1);
        }
      }
    } catch {}
    // Fall back to process.env for anything not found above
    for (const key of SESSION_KEYS) {
      if (!displayEnv[key] && process.env[key]) displayEnv[key] = process.env[key];
    }

    const child = spawn(term.bin, term.args(scriptPath), {
      detached: true,
      stdio:    'ignore',
      env:      { ...process.env, ...displayEnv },
    });

    let responded = false;

    child.on('error', (err) => {
      if (!responded) {
        responded = true;
        console.error(`[devora] terminal spawn error (${term.bin}):`, err.message);
        res.json({ ok: false, manual: manualCmd });
      }
    });

    // Give the process a short window to report a launch error; if it doesn't
    // crash immediately, assume it opened successfully.
    setTimeout(() => {
      if (!responded) {
        responded = true;
        child.unref();
        res.json({ ok: true });
      }
    }, 500);
  }
}

module.exports = router;
