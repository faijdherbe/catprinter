# catprinter / web

Web app to print text and images on the MX10 printer from the browser.

Public page: https://faijdherbe.github.io/catprinter/

## Browsers

- Chrome or Edge on a computer, and Chrome on Android, have Web Bluetooth.
- On Linux, Chrome has Web Bluetooth only after you enable `chrome://flags/#enable-experimental-web-platform-features`.
- Firefox, Zen, Safari and all browsers on iPhone and iPad have no Web Bluetooth.

When the app starts, it tests the real Web Bluetooth API (`requestDevice` and `getAvailability`). If the test fails, the app tells you why it cannot print. You can continue without printing: then you can make pages and templates and see the preview, but you cannot connect or print.

## Printers

The Bluetooth dialog shows printers whose name starts with MX, GB, GT or YT. These cat printers use the same `51 78` protocol and print 384 px wide. Only the MX10 is tested.

## Run locally

Chrome does not load ES modules from a `file://` URL. Use a local server:

    python3 -m http.server 8642 -d web

Then open http://localhost:8642/.

The service worker keeps the files in a cache. After a change, increase `VERSION` in `sw.js`. The new version then takes control at once, and open pages reload one time.

## Use

1. Edit: add text sections (GFM Markdown) and image sections. Drag a section on its handle to move it.
2. `->text<-` on its own line centers that line.
3. Preview: the exact 1-bit bitmap that the printer gets. Tap Print.
4. Templates: a template has a TOP and a BOTTOM. Select it on the Edit screen. The app puts your content between them.
5. Printer: darkness, speed and feed.
6. About: what the app does, your data, the browsers, and a link to this repo.

The app saves each change at once in the browser (localStorage). To move templates to another device, use Export and Import.

## Install

In Chrome, use "Install app" (computer) or "Add to home screen" (Android). The app also starts with no network connection.

## Test

    sh web/run-tests.sh

This test is offline and needs no printer. It uses headless Chrome. It prints `ok`, or `FAIL` and the failed checks.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup of all screens and the custom CSS |
| `app.js` | Browser check, screens, composer, storage, templates, print flow |
| `render.js` | Sections → 1-bit bitmap, 384 px wide |
| `printer.js` | Packets and Web Bluetooth |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA |
| `lib/` | Pinned copies: Beer CSS 5.0.3, material-dynamic-colors 1.1.4, Material Symbols, marked 18.1.1 |
| `test.html`, `run-tests.sh` | Offline tests |
