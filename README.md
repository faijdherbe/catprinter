# catprinter

Tools to print on the MX10 Bluetooth thermal "cat printer" (BLE `CC:10:24:20:DC:08`, 384 px wide, black and white only).

Public web app: https://faijdherbe.github.io/catprinter/

| Folder              | What                                                       |
|---------------------|------------------------------------------------------------|
| [python/](python/)  | CLI script (`bleak` + Pillow) and the Claude Code `catprint` skill |
| [web/](web/)        | Web app (PWA, Web Bluetooth). Public page: https://faijdherbe.github.io/catprinter/ |

Each project is in its own folder and has its own README. Information that applies to all the projects is in this file.

## Protocol notes

- Packet: `51 78 <cmd> 00 <len lo> <len hi> <payload> <crc8> ff`. The CRC-8 polynomial is `0x07` and it covers the payload only.
- Write to characteristic `ae01`. Notifications come on `ae02`.
- Print sequence (one packet per step):
  `A3` get state → `A4` quality → `A6` lattice start → `AF` energy → `BD` speed → `BE` apply energy → `A2` row per line (48 bytes, LSB = leftmost pixel) → `A6` lattice end.
- Flow control: notification `AE` with byte 6 = `0x10` means pause, `0x00` means resume.
- State bits (`A3` reply, byte 6): `1` no paper, `2` cover open, `4` overheat, `8` low battery, `0x80` busy (not an error).
- For paper feed, send blank `A2` rows, because the `A1` feed command does not always advance the paper.
- The printer accepts only one BLE connection at a time. While a tool or the phone app holds the connection, the other tools cannot connect.
- If a connected process stops, BlueZ can keep the connection open. To release it, run `bluetoothctl disconnect CC:10:24:20:DC:08`.
- Auto-off: with no connection, the printer switches off after approximately 10 minutes of idle time (measured on 2026-11-05: last print at approx. 14:46, no advertisements after 14:56). While a connection is open and the host sends an `A3` state request every 30 s, the printer stays on (test: 13.5 minutes with no disconnect).
