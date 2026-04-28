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
    attachments, mode, repo, useOnemFrontend,
    suggestCommit, commitFormat, comments,
  } = req.body;

  if (!repo) return res.status(400).json({ error: 'No repo selected' });

  const projectWinPath   = path.join(config.reposPath, repo);
  const projectPosixPath = toPosix(projectWinPath);

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
  const claudePrompt = isPlan
    ? `${skillPreamble}read .devora-context.md for Jira ticket ${ticketKey}, then enter plan mode and establish a detailed implementation plan. Do not write any code yet — only analyse the ticket and produce a step-by-step plan.${instructions ? ' Pay special attention to the Additional Instructions section.' : ''}${savedAttachments.length ? ' Screenshots are in .devora-attachments/.' : ''}`
    : `${skillPreamble}implement Jira ticket ${ticketKey}. Read .devora-context.md for full details.${instructions ? ' Pay special attention to the Additional Instructions section.' : ''}${savedAttachments.length ? ' Screenshots from the ticket are in .devora-attachments/.' : ''}${commitSuffix}`;

  const script       = `#!/bin/bash\ncd "${projectPosixPath}"\nclaude "${claudePrompt.replace(/"/g, '\\"')}"\n`;
  const scriptWinPath = path.join(projectWinPath, '.devora-start.sh');
  fs.writeFileSync(scriptWinPath, script);

  const manualCmd = `cd "${projectPosixPath}" && claude "${claudePrompt.replace(/"/g, '\\"')}"`;

  if (process.platform === 'win32') {
    const gitBash = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ].find(p => fs.existsSync(p));

    if (!gitBash) return res.json({ ok: false, manual: manualCmd });

    const scriptPosixPath = toPosix(scriptWinPath);
    exec(`start "" "${gitBash}" "${scriptPosixPath}"`, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  } else {
    const TERMINALS = [
      { bin: 'alacritty',      args: s => ['-e', 'bash', s] },
      { bin: 'gnome-terminal', args: s => ['--', 'bash', s] },
      { bin: 'xterm',          args: s => ['-e', 'bash', s] },
      { bin: 'konsole',        args: s => ['-e', 'bash', s] },
      { bin: 'xfce4-terminal', args: s => ['--command', `bash ${s}`] },
    ];

    const term = TERMINALS.find(t => {
      try { execSync(`which ${t.bin}`, { stdio: 'ignore' }); return true; } catch { return false; }
    });

    if (!term) return res.json({ ok: false, manual: manualCmd });

    const child = spawn(term.bin, term.args(scriptWinPath), { detached: true, stdio: 'ignore' });
    child.unref();
    res.json({ ok: true });
  }
});

module.exports = router;
