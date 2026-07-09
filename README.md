# Devora

**A local dev cockpit that bridges Jira, Azure DevOps, SonarQube and Claude Code.**

Devora runs as a small web app on your machine. It shows your active sprint, watches your build pipelines and code coverage, and — with one click — launches [Claude Code](https://claude.com/claude-code) in a terminal with the full ticket context (description, comments, screenshots, Figma designs) already prepared, so the AI can start planning or implementing immediately.

No build step, no database: an Express server, a single-page Alpine.js + Tailwind frontend, and a `config.json`.

---

## Features

### 🗂 Sprint board

- Pulls the **active sprint** from your Jira board and groups tickets by status (In Progress → In Review → To Do → Done).
- Instant search across ticket key, summary and assignee.
- Ticket detail view with rendered description, comments, and image attachments (proxied through the server, so Jira auth stays server-side).

### 🤖 One-click AI development

Select a ticket, pick a target repo, and hit **▶ Start Dev** or **📄 Start Plan**. Devora then:

1. Writes a `.devora-context.md` into the repo with the ticket title, description, and everything you selected.
2. Downloads the ticket's screenshots into `.devora-attachments/`.
3. Opens a terminal in the repo running `claude` with a prompt pointing at that context.

**Dev mode** implements the ticket; **Plan mode** makes Claude enter plan mode and produce a step-by-step implementation plan without writing code.

You can enrich the context before launching:

- **Additional instructions** — free-text guidance for the AI (e.g. "Use the existing AuthService, don't touch the DB schema").
- **Comment selection** — cherry-pick which Jira comments are relevant and include them in the context.
- **Design SVGs (Figma)** — paste SVG exports from Figma (right-click layer → *Copy as SVG*), each with a title. They're saved into `.devora-svgs/` in the repo and referenced in the context as the visual design reference. The list persists across reloads; add and remove items freely.
- **Commit suggestion** — when enabled, Claude proposes a copy-paste commit message in your configured format once it's done.
- **Full permissions (dangerous)** — passes `--dangerously-skip-permissions` to Claude for uninterrupted runs.

### 🎨 Design system awareness

Point Devora at your design system repo (Settings → *Design system repo*) and every AI session is instructed to:

- Explore the design system source to discover available components and variants.
- **Use design system components in priority** for any UI element instead of hand-writing markup and CSS — e.g. a table with buttons must be built from the design system's table and button components.
- Compare each Figma SVG against the design system and reuse matching components. The goal: **zero CSS overrides** for anything the design system already covers.

Add the **Challenge design system** toggle and the AI won't silently write custom CSS when the design system has a gap — it stops and asks you how to handle it: contact the design system team, build a local one-off, or adapt the design.

### 🅰️ ONEM frontend skill

For Angular projects using the `@onemrvapublic/design-system`, the **ONEM frontend skill** toggle expands a skill file into the repo before launch. It detects the exact design system version the target project depends on and lists the components available **at that git tag** (via `git ls-tree`, no checkout needed), so the AI never suggests components that don't exist in your version.

### 🔧 Azure DevOps build monitor + AI build fixing

- Watch any number of **project / repo / branch** combinations; the top bar shows the latest build of each with **per-stage status dots** (running / succeeded / failed), refreshed every 60 s, linking to the build in Azure DevOps.
- When a build fails, hit **Fix build**: Devora fetches the failed tasks and the last 150 lines of each task's log, writes them into `.devora-context.md`, and launches Claude to find the root cause and fix it (dev or plan mode).
- Detects **Spotless** in Maven projects and hints the AI to run `mvn spotless:apply` for formatting failures.

### 📊 SonarQube coverage

Track any number of SonarQube projects; the top bar shows live coverage badges, color-coded (≥ 80 % green, ≥ 60 % yellow, below red), refreshed every 5 minutes.

### ⚙️ Settings UI

Everything is configurable from the in-app settings modal — Jira board and API token, repos folder, design system repo, commit message format, Azure DevOps PAT and watched pipelines (with project/repo/branch pickers), SonarQube URL, token and projects. Secrets are write-only in the UI and stored in your local `config.json`.

---

## Getting started

### Prerequisites

- **Node.js** 18+
- **[Claude Code](https://claude.com/claude-code)** CLI installed and authenticated (`claude` on your PATH)
- A terminal emulator — on Windows: **Git Bash**; on Linux: alacritty, gnome-terminal, foot, kitty, wezterm, xterm, konsole or xfce4-terminal (auto-detected). If none is found, Devora shows the command to run manually.

### Install & run

```bash
git clone <this-repo>
cd devora
npm install
cp config.example.json config.json   # then fill it in
npm run start
```

Open **http://localhost:3000** (or your configured port). You can complete most of the configuration from the settings modal (⚙) once the server is running.

### Configuration

`config.json` (never commit it):

| Key | Description |
| --- | --- |
| `jira.baseUrl` | Your Jira instance, e.g. `https://yourcompany.atlassian.net` |
| `jira.email` / `jira.apiToken` | Jira account + [API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `jira.boardId` | Sprint board id (pickable in settings) |
| `reposPath` | Folder containing your local git repos — its subfolders appear in the repo picker |
| `designSystemPath` | *(optional)* Path to your design system repo; enables design-system-first AI instructions |
| `azure.orgUrl` / `azure.pat` / `azure.watches` | Azure DevOps org, personal access token, and watched pipelines |
| `sonar.baseUrl` / `sonar.token` / `sonar.projects` | SonarQube instance and tracked projects |
| `suggestCommit` / `commitFormat` | Commit message suggestion toggle and template |
| `port` | Server port (default `3000`) |
| `proxy` | *(optional)* HTTP proxy for outbound Jira/Azure/Sonar calls |

### Files Devora writes into your repos

When launching a session, Devora drops working files into the **target** repo:

```
.devora-context.md      # ticket / build context for the AI
.devora-attachments/    # downloaded ticket screenshots
.devora-svgs/           # your pasted Figma SVGs
.devora-skill.md        # expanded ONEM frontend skill (if enabled)
.devora-start.sh        # the launch script
```

You may want to add `.devora-*` to your global gitignore.

---

## Run automatically on Linux (systemd)

Start Devora on login with a user-level systemd service.

Create `~/.config/systemd/user/devora.service` (adjust paths):

```ini
[Unit]
Description=Devora dev bridge (Jira/Azure/Claude)
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/YOURUSER/repos/devora
ExecStart=/home/YOURUSER/.nvm/versions/node/v24.14.1/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=NODE_EXTRA_CA_CERTS=/home/YOURUSER/.crt/rva-all.crt

[Install]
WantedBy=default.target
```

Then:

```bash
systemctl --user daemon-reload
systemctl --user enable devora
systemctl --user start devora
```

Devora forwards your graphical session environment (`DISPLAY`, `WAYLAND_DISPLAY`, D-Bus, …) when spawning terminals, so AI launches work even when the server was started by systemd before you logged into the desktop.

---

## Tech stack

- **Backend** — Node.js + Express, plain `fetch` clients for the Jira, Azure DevOps and SonarQube REST APIs, optional corporate proxy support.
- **Frontend** — Alpine.js + Tailwind (CDN), zero build step.
- **AI** — Claude Code CLI, driven through generated context files and prompts.
