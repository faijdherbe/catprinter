# catprinter: development rules

Tools to print on the MX10 BLE thermal printer. Read `README.md` for the protocol before you change print code.

## Workflow

- Always use the superpowers skills: `superpowers:brainstorming` before new features, `superpowers:systematic-debugging` for bugs, `superpowers:test-driven-development` for logic, and `superpowers:verification-before-completion` before you say that the work is complete.
- Always use `ponytail:ponytail` (full) for all code: the smallest solution that works.
- Always write ASD-STE100 (skill `asd-ste100`): messages to the user, Markdown files, code comments, UI text and error messages. Strict mode for UI text, error messages and instructions. STE-flavored mode for READMEs. Check Markdown with `python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py <files>`.
- For UI work, use `ui-ux-pro-max:ui-ux-pro-max` and follow the UI rules below.

## Layout

- One project per folder (`python/`, `web/`, ...). Each project has its own `README.md`.
- When you add a project, add a row to the table in the root `README.md`.
- Information that applies to all projects (protocol, printer behavior) goes in the root `README.md`, not in a project README. When you find a new fact about the printer, write it there.

## Printer and hardware

- The protocol constants (UUIDs, lattice bytes, energy/speed defaults, throttle) passed tests on the real printer. Do not change them without a test print.
- Never pair the printer (bluetoothctl or system settings). BLE connect works unpaired.
- The printer accepts only one connection. Before a test, make sure that no other process holds it. If a connect fails with "not found", run `bluetoothctl info CC:10:24:20:DC:08`. If the output shows `Connected: yes`, run `bluetoothctl disconnect CC:10:24:20:DC:08`.
- Make test prints short (a few lines, `--feed 40`) to save paper. Print a full image only when the user asks.
- Run the offline check first. Print on the printer only after the offline check passes.

## Code

- No build step and no new dependencies without a clear need. Python: host `python3` with the installed `bleak` + Pillow. Do not use `python3 -I` (it hides `bleak` in `~/.local`).
- Web: static files only, plain HTML/JS, no framework, no bundler. Use relative paths, so that the page works from `file://`, `localhost` and GitHub Pages. Target: Web Bluetooth in Chrome/Edge (desktop and Android).
## UI (web)

Source: `ui-ux-pro-max` UX guidelines. Check the UI against these rules before you say that UI work is complete.

- CSS framework: Beer CSS 5.0.3 (Material Design 3). Keep pinned local copies in `web/lib/`: `beer.min.css`, `beer.min.js`, `material-dynamic-colors.min.js` (1.1.4) and `material-symbols-outlined.woff2`. Do not load them from a CDN.
- Theme: violet. Set it with `ui("theme", "#7540bf")`. Mode: `auto` (the device setting). Do not change the Beer theme variables globally.
- Use the Beer components and helpers as the Beer docs show them. The app uses these:
  `nav.bottom.s` (phone tab bar), `header.fixed` (top bar), `article` (card), `div.field.label.border` (text field, select), `div.slider`, `menu`, `dialog`, `chip`, `ul.list`, `button.error` (red button), `progress.circle` (spinner). Use Material Symbols icons (`<i>print</i>`).
- Write custom CSS only when Beer has no solution (for example `image-rendering: pixelated` on the preview). Keep custom CSS in one small `<style>` block. In custom CSS, use the Beer color tokens (for example `var(--error)`), so that light and dark mode both work.
- Use native HTML elements inside the Beer components: `<button>`, `<input type="file" accept="image/*">`, `<textarea>`, `<input type="range">`, `<select>`, `<label>`. Do not make custom controls.
- Each control has a visible `<label>`. Do not use a placeholder as the only label.
- Touch targets: minimum 48×48 CSS px (Android), with 8 px or more between targets. WCAG minimum is 24×24 CSS px.
- Do not remove the focus ring. All functions work with the keyboard only.
- Text contrast: minimum 4.5:1. Base font size: 16 px. Do not use color as the only signal of a state.
- Show the state of the printer at all times in one status line with `aria-live="polite"`: not connected, connecting, connected, printing (with progress), error.
- While a print runs, disable the print button, show a `progress.circle` spinner and the progress in rows, and set `aria-busy="true"`. Do not freeze the UI.
- Show each error near its cause, in plain STE text, with the next step for the user (for example "Paper is empty. Put in paper and try again."). If Web Bluetooth is not available, tell the user which browser to use.
- Always show a preview of the exact 384 px black/white bitmap that the printer will get, before the user prints.
- Mobile-first layout, one column, no horizontal scroll. Use `<meta name="viewport" content="width=device-width, initial-scale=1">`. Do not disable zoom.
- Use no emoji as icons. Use few animations, and obey `prefers-reduced-motion`.

## Tests

- Each project keeps one small offline check (no printer needed) for the packet encoding: CRC-8 (`crc8([0,0,0x49]) == 0xf8`) and packet format (`pkt(0xA3,[0])` → `5178a30001000000ff`).

## Skill

- `python/skill/SKILL.md` + `python/catprint.py` are the source of the `catprint` skill. The live copy is in `~/.claude/skills/catprint/`. After a change, copy both files there.

## Before merge

Do all these steps before each merge. Do not merge if a step fails. Fix the problem, then do all the steps again. Tell the user the result of each step.

1. Offline checks: run the check of each changed project (for example `cd python && python3 test_catprint.py`).
2. Code review: run the `code-review` skill on the diff.
3. Security scan: run the `security-review` skill. Also check for secrets and personal data in the files.
4. UI/UX evaluation (only if web UI changed): use `ui-ux-pro-max`. Check the UI against the "UI (web)" rules above and against the Pre-Delivery Checklist in its `references/pro-rules.md`.
5. Rule check: read this file and check the diff against each rule. This includes layout, hardware, code, UI, ASD-STE100 (`ste-lint` on changed Markdown) and the skill copy.
6. Test print: if print code changed, make one short test print on the real printer.

## Git

- No `git init`, commit or push unless the user asks.
