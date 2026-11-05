# catprinter / python

Print text and images on the MX10 printer from Linux with one Python script.

To print from a browser (computer or Android) with no install, use the web app: https://faijdherbe.github.io/catprinter/

## Requirements

- Python 3 with `bleak` and `Pillow` (`pip install bleak pillow`)
- DejaVu fonts (`/usr/share/fonts/truetype/dejavu/`)
- A Bluetooth adapter with BLE

Do **not** pair the printer in bluetoothctl or system settings. The BLE connection works without pairing.

## Usage

```sh
python3 catprint.py "Hello world"
python3 catprint.py "Line one\nLine two" --size 48
python3 catprint.py --image photo.png
```

| Option     | Default | Meaning                                         |
|------------|---------|-------------------------------------------------|
| `--size`   | 32      | Font size in px (24 small, 48+ headings)        |
| `--energy` | 12000   | Darkness, approx. 8000–20000                    |
| `--speed`  | 32      | Lower = slower and darker                       |
| `--feed`   | 150     | Blank rows after the print (approx. 19 mm)      |

The script scales images of any width to 384 px and dithers them. For layouts (lists, receipts, QR codes), render a 384 px wide PNG with Pillow and use `--image`.

## Configuration

`catprint.py` contains the printer address:

```python
ADDR = 'CC:10:24:20:DC:08'
```

Change it for a different printer. To find the address, scan with `bluetoothctl --timeout 10 scan on`. Look for the name `MX10`.

## Protocol

See [../README.md](../README.md#protocol-notes).

## Troubleshooting

- **Connect error**: the printer is off or asleep, or another device (the phone app) holds the connection.
- **Lines are missing**: increase the `asyncio.sleep(0.02)` throttle in `print_image`.
- **Print is too light**: increase `--energy` or decrease `--speed`.

## Claude Code skill

`skill/SKILL.md` is the `catprint` skill. The live copy is in `~/.claude/skills/catprint/` (SKILL.md + catprint.py). If you change the script here, copy it there too:

```sh
cp catprint.py skill/SKILL.md ~/.claude/skills/catprint/
```

## Test

```sh
python3 test_catprint.py
```

This test is offline. It checks the CRC, the packet format and the row size. It does not print.
