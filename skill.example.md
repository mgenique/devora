# Example skill file

Copy this file, adapt it to your stack, and point **Settings → Skill file** at it.

When the **Skill file** toggle is enabled on a ticket, Devora expands this file
and writes it into the target repo as `.devora-skill.md`, then tells Claude to
read it before doing anything else. Use it to encode everything the AI should
know about your project that isn't obvious from the code: framework version,
import conventions, state management, i18n, testing rules, and so on.

## Placeholders

Devora replaces these before writing the file:

| Placeholder | Replaced with |
| --- | --- |
| `$ARGUMENTS` | The ticket key and title, e.g. `PROJ-123 — Add export button` |
| `$DS_COMPONENTS` | The component list of the design system repo configured in Settings |

Front matter (a leading `---` block) is stripped, so a Claude Code slash command
file from `.claude/commands/` can be used as-is.

---

Everything below is a template — replace it with your own conventions.

---

You are an expert frontend developer working on this project.

**Task:** $ARGUMENTS

## Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | *e.g. Angular 21* | Standalone components, signals, `inject()` |
| Component library | *your design system package* | Subpath imports only |
| State | *e.g. `@ngrx/component-store`* | One store per feature |
| Translations | *e.g. `ngx-translate`* | Key format `FEATURE.SECTION.KEY` |
| Styling | *e.g. SCSS + design tokens* | Never hardcode colors or spacing |

## Available design system components

Resolved from this project's `package.json` → matching git tag in the design
system repo (non-destructive, no checkout):

$DS_COMPONENTS

## Import patterns

```ts
// Describe how components must be imported, e.g. subpath imports only:
// import { Spinner } from '@acme/design-system/spinner';
```

## Project structure

```
src/
├── features/<feature>/
│   ├── components/   // presentational
│   ├── containers/   // smart, connected to the store
│   ├── store/
│   ├── http/
│   └── model/
├── core/             // interceptors, cross-cutting services
└── i18n/
```

## Design tokens

```scss
// List the CSS custom properties to use instead of hardcoded values:
// padding: var(--spacer);
// color:   var(--color-primary);
```

## Rules — Always / Never

**Always:**
- Use a design system component when one exists — never recreate it with custom CSS
- Use the translation layer — never hardcode display strings
- *…your rules*

**Never:**
- Override design system component styles directly
- *…your rules*
