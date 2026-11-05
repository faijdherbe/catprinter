---
name: catprint
description: Print text, notes, lists, receipts, labels or images on Jeroen's Bluetooth thermal "cat printer" (MX10). Use when the user says "print this", "print ...", "catprint", "op de printer", "bonnetje", or asks to put something on paper / the little printer.
---

# Cat printer (MX10)

Script: `~/.claude/skills/catprint/catprint.py` (host python3, uses already-installed `bleak` + Pillow. No install is necessary).

- Printer: BLE `CC:10:24:20:DC:08`, protocol `0x51 0x78`, 384 px wide, black/white only.
- Do NOT pair it via bluetoothctl/system settings. BLE connect works unpaired.
- Run from a neutral cwd, e.g. `cd /tmp && python3 ~/.claude/skills/catprint/catprint.py ...`, timeout 60s.

## Plain text

```
python3 ~/.claude/skills/catprint/catprint.py "Line one\nLine two" --size 32
```
Words wrap automatically. `--size` = font px (24 small, 32 normal, 48+ big headings). DejaVu Sans has no emoji: remove emoji or replace them with text.

## Anything with layout (lists, receipts, bold headings, QR codes, tables, drawings)

Render a PNG yourself with Pillow, 384 px wide, white background, black content, then:
```
python3 ~/.claude/skills/catprint/catprint.py --image /path/to/file.png
```
Fonts: `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`, `DejaVuSans-Bold.ttf`, `DejaVuSansMono.ttf`. Put temp PNGs in the session scratchpad. The script dithers images and scales any width to 384 px.

## Tuning

- `--energy` darkness, default 12000 (approx. 8000–20000). `--speed` default 32, lower = darker.
- `--feed` blank rows printed after the content, default 150 (approx. 19 mm), so the user can tear off without cutting through the text. Use more if the user asks.
- Script prints `printer state: 0x1/0x2/0x4/0x8` = no paper / cover open / overheat / low battery. Tell the user.
- Connect error: printer is off/asleep or another device (phone app) holds the connection.

Do not ask for confirmation before you print what the user asked for. After the print, tell the user in one line what you printed.
