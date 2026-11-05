# Catprinter web app: design

Date: 2026-11-05. Status: approved in the brainstorm, waiting for the user review of this file.

## Goal

A static web app in `web/` that prints text and images on the MX10 printer with Web Bluetooth. It runs from GitHub Pages and from `localhost`. Chrome does not load ES modules from `file://`. You can install it as a PWA. It works in Chrome and Edge on desktop, and in Chrome on Android. It does not work in Firefox, in Safari or on iOS.

## Functions

- **Composer:** a page is a list of sections. A section contains text or an image. You add, delete and move sections. Move a section with drag-and-drop on its handle.
- **Text section:** GFM Markdown. Supported: headings `#`/`##`/`###`, bold, italic, paragraphs, line breaks, lists, numbered lists, task items `- [ ]`/`- [x]`, horizontal lines `---`, quotes `>`, inline code, code blocks and tables. Settings: alignment (left, center, right) and font size. The inline syntax `->text<-` centers one line.
- **Image section:** settings for width (percent of 384 px), alignment and mode (dither for photos, threshold for line art). Also brightness, contrast and rotation (0°, 90°, 180°, 270°).
- **Templates:** a template has a name, a TOP and a BOTTOM. TOP and BOTTOM are lists of sections, the same as a page. When a template is selected, the Edit area shows only the CONTENT sections. The preview and the print show TOP + CONTENT + BOTTOM.
- **Printer settings:** darkness (energy), speed and feed after the print. Defaults: 12000, 32 and 100 rows.
- **Autosave:** there are no Save buttons. The app saves each change at once: the draft (the CONTENT sections and the selected template), the templates and the printer settings. After each save, a small "Saved" text shows.
- **Delete confirmation:** each delete (a template or a section) asks for confirmation in a dialog with the buttons Delete and Keep.
- **Export and import:** one template to one JSON file, and one JSON file to one template.

Not in this version: a keepalive ping, more than one printer, a sync between devices.

## Screens

The screen comes from the URL hash, so the Android back button works.

| Hash         | Phone                         | Desktop                                 |
|--------------|-------------------------------|-----------------------------------------|
| `#edit`      | Template select + sections    | One screen: Edit (left) + Preview (right, sticky) |
| `#preview`   | Template select + preview + Print | The same screen as `#edit`            |
| `#templates` | Template list                 | Template list                           |
| `#template`  | Template editor               | Template editor (Edit left, Preview right) |
| `#printer`   | Printer screen                | Printer screen                          |
| `#about`     | About screen                  | About screen                            |

- **Navigation:** one set of links. Phone: bottom tab bar `nav.bottom.s` with Edit · Preview · Templates · Printer · About. Desktop: links in the top bar `header.fixed` with Compose · Templates · Printer · About. In the template editor, Templates stays active.
- **Connection indicator:** a chip at the top right on all screens, with `aria-live="polite"`. A tap opens `#printer`. Each state has a color, an icon and a word:

| State                         | Color | Text           |
|-------------------------------|-------|----------------|
| No printer selected yet       | Grey  | `No printer`   |
| Printer selected, not connected, or an error | Red | `MX10 offline` |
| Connected                     | Green | `MX10`         |

- **Print button:** the last element of the preview panel. Desktop: under the sticky preview. Phone: on `#preview`, directly above the tab bar.
- **Template list:** one row for each template. A tap on the name opens the editor. A `more_vert` menu has Edit, Export and Delete. The menu opens over the rows below it and does not push them down. Under the list: New template and Import. New template makes a template with the name "New template" at once and opens the editor.
- **Template editor:** a name field, a TOP area and a BOTTOM area, each with its own sections and add buttons. Between them, a marker shows "CONTENT goes here". The preview shows TOP + the marker + BOTTOM.
- **Printer screen:** a list with the state of paper, cover and battery. Sliders for darkness, speed and feed. At the bottom: a red Disconnect button (`button.error`). When the app is not connected, the same place shows a Connect button. The screen has no "Connected to" text, because the indicator shows the state.
- **Browser check:** at start, the app tests the real API: `navigator.bluetooth.requestDevice` must exist and `getAvailability()` must return `true`. If not, a full-screen card explains what the app does and why it cannot print in this browser, or that Bluetooth is off. The button "Continue without printing" opens the app. Then Print and Connect are disabled, with the text "You cannot connect or print in this browser."

## Style

- Beer CSS 5.0.3 (Material Design 3), violet theme: `ui("theme", "#7540bf")`. Mode: `auto`.
- Pinned local copies in `web/lib/`. The app loads nothing from a CDN.
- Custom CSS only when Beer has no solution, in one `<style>` block: the indicator colors, the drag state and `image-rendering: pixelated` on the preview.
- All UI rules in `CLAUDE.md` apply.

## Files

All files are in `web/`. There is no build step.

| File                  | Purpose |
|-----------------------|---------|
| `index.html`          | Markup of all screens, the `<style>` block. |
| `app.js`              | Screens and hash routing, composer, drag-and-drop, storage, autosave, export and import. |
| `render.js`           | Sections → one canvas 384 px wide → 1-bit bitmap. Markdown tokens come from `marked`. |
| `printer.js`          | Web Bluetooth, packets, CRC-8, flow control, state bits. A port of `python/catprint.py`. |
| `lib/`                | `beer.min.css`, `beer.min.js`, `material-dynamic-colors.min.js`, `material-symbols-outlined.woff2`, `marked.min.js`. |
| `manifest.webmanifest`| PWA manifest: name "Catprinter", `display: standalone`, theme color `#7540bf`, icons. |
| `sw.js`               | Service worker: caches all static files under one version name. |
| `icons/`              | App icons, 192 px and 512 px. |
| `test.html`           | Offline tests in the browser. |

The modules are ES modules (`<script type="module">`). `render.js` and `printer.js` do not use the DOM of the page, so `test.html` can import them.

## Data

```js
// Section
{ id, type: "text", md: "# Title", align: "left" | "center" | "right", size: 24 }
{ id, type: "image", src: "data:image/png;base64,...", width: 100, align: "center",
  mode: "dither" | "threshold", brightness: 0, contrast: 0, rotate: 0 | 90 | 180 | 270 }

// Template
{ id, name: "Receipt", top: [Section], bottom: [Section] }

// localStorage keys
"catprinter.templates"  // [Template]
"catprinter.draft"      // { templateId | null, content: [Section] }
"catprinter.settings"   // { energy: 12000, speed: 32, feed: 100 }
```

- When you add an image, the app scales it to a maximum width of 768 px. It keeps this copy as a PNG data URL in `src`. With it, you can change the image settings later.
- If localStorage is full, the app shows an error near the cause: "Storage is full. Delete a template or an image and try again."
- Export file: the Template object as JSON, file name `<name>.catprinter.json`. Import checks the fields `name`, `top` and `bottom` before it adds the template. It gives the template a new `id`.

## Rendering

1. Merge the sections: TOP + CONTENT + BOTTOM (or only CONTENT when no template is selected).
2. Draw each section on its own canvas 384 px wide. Then put the canvases one under the other on one canvas.
3. Text: `marked.lexer()` gives the tokens. A small `marked` extension changes `->text<-` into a centered block. `render.js` draws each token with the generic canvas fonts `sans-serif` and `monospace`. Supported tokens: headings, bold, italic, lists, task boxes, quotes (a line on the left) and code (monospace). Also horizontal lines and tables (equal column widths, text wraps inside a cell).
4. Image: scale to the width → brightness/contrast → rotate → dither (Floyd-Steinberg) or threshold (128).
5. Text pixels go to 1 bit with threshold 128.
6. The preview shows this 1-bit canvas with `image-rendering: pixelated`. The printer gets the same bitmap.

## Print flow

1. The user taps Print.
2. If the app is not connected, it opens the Bluetooth dialog and connects. `requestDevice` uses name filters (`namePrefix` MX, GB, GT and YT) and the GATT service that contains `ae01`/`ae02` in `optionalServices`. The expected service UUID is `0xae30`. The first implementation step checks it on the real printer. The tap on Print is the user action that Chrome requires.
3. The app sends the packets in the sequence of `README.md` → Protocol notes. It obeys flow control (`AE` pause/resume). After each 8 rows, it waits 20 ms. After the content, it sends blank rows for the feed.
4. During the print: the Print button is disabled, shows a `progress.circle` spinner and "Printing 120/384", and has `aria-busy="true"`. The rest of the UI stays usable.
5. After the print: the button is normal again.

## Errors

| Cause                     | Indicator | Message near the Print button |
|---------------------------|-----------|-------------------------------|
| State bit 1               | Red       | Paper is empty. Put in paper and try again. |
| State bit 2               | Red       | Cover is open. Close the cover and try again. |
| State bit 4               | Red       | Printer is too hot. Wait 1 minute and try again. |
| State bit 8               | Stays green | Battery is low. Charge the printer. |
| Connection lost (for example the auto-off after 10 minutes) | Red | Printer is not connected. Tap Print to connect again. |
| User closed the Bluetooth dialog | No change | No message. |
| Connect failed            | Red       | Cannot connect. Make sure that the printer is on and that no other device is connected to it. |

## PWA

- `manifest.webmanifest` and `sw.js` as in the table under Files.
- The service worker caches all files on install. It serves them cache-first. A change of the version name in `sw.js` makes the browser get the new files.
- The service worker works only on `https://` and `localhost`. On `file://`, the app works but is not installable.

## Tests

- `web/test.html` (offline, no printer). It shows "ok" or the failed check.
  - CRC-8: `crc8([0,0,0x49]) == 0xf8`. Packet: `pkt(0xA3,[0])` → `5178a30001000000ff`.
  - Renderer: a fixed piece of Markdown gives a bitmap that is 384 px wide and of the expected height. A `->text<-` line has the same white space on the left and on the right (±2 px).
  - Template merge: TOP + CONTENT + BOTTOM in this sequence.
- Before each merge: the steps in `CLAUDE.md` → Before merge. If print code changed, one short test print on the real printer.
