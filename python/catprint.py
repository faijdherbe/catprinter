#!/usr/bin/env python3
"""Print text or an image on the MX10 cat printer (0x51 0x78 protocol, 384 px wide).

  catprint.py "Hello world"
  catprint.py --image photo.png
"""
import argparse, asyncio
from PIL import Image, ImageDraw, ImageFont, ImageOps
from bleak import BleakClient

ADDR = 'CC:10:24:20:DC:08'
TX = '0000ae01-0000-1000-8000-00805f9b34fb'
RX = '0000ae02-0000-1000-8000-00805f9b34fb'
WIDTH = 384
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def crc8(data):
    c = 0
    for x in data:
        c ^= x
        for _ in range(8):
            c = ((c << 1) ^ 7) & 0xff if c & 0x80 else (c << 1) & 0xff
    return c


def pkt(cmd, payload):
    p = list(payload)
    return bytes([0x51, 0x78, cmd, 0, len(p) & 0xff, len(p) >> 8] + p + [crc8(p), 0xff])


def render_text(text, size):
    font = ImageFont.truetype(FONT, size)
    lines = []
    for para in text.split('\n'):
        line = ''
        for word in para.split(' '):
            test = (line + ' ' + word).strip()
            if font.getlength(test) <= WIDTH or not line:
                line = test
            else:
                lines.append(line)
                line = word
        lines.append(line)
    h = int(size * 1.2)
    img = Image.new('L', (WIDTH, h * len(lines)), 255)
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        d.text((0, i * h), l, font=font, fill=0)
    return img


def load_image(path):
    img = ImageOps.exif_transpose(Image.open(path)).convert('L')
    img = img.resize((WIDTH, round(img.height * WIDTH / img.width)))
    return img.convert('1')  # Floyd-Steinberg dither


def rows(img):
    img = img.convert('1')
    px = img.load()
    for y in range(img.height):
        row = bytearray(WIDTH // 8)
        for x in range(WIDTH):
            if px[x, y] == 0:  # black dot. Bit 0 = leftmost pixel
                row[x // 8] |= 1 << (x % 8)
        yield bytes(row)


async def print_image(img, energy, speed, feed):
    paused = asyncio.Event()
    paused.set()

    def on_rx(_, d):
        if len(d) > 6 and d[2] == 0xAE:  # flow control: 0x10 = pause, 0x00 = resume
            paused.clear() if d[6] else paused.set()
        elif len(d) > 6 and d[2] == 0xA3 and d[6] & 0x0F:  # 0x80 = busy, not an error
            print('printer state:', hex(d[6]), '(1=no paper, 2=cover open, 4=overheat, 8=low battery)')

    async with BleakClient(ADDR, timeout=20) as c:
        await c.start_notify(RX, on_rx)
        send = lambda b: c.write_gatt_char(TX, b, response=False)
        await send(pkt(0xA3, [0]))  # get state
        await send(pkt(0xA4, [0x33]))  # quality
        await send(pkt(0xA6, [0xAA, 0x55, 0x17, 0x38, 0x44, 0x5F, 0x5F, 0x5F, 0x44, 0x38, 0x2C]))  # lattice start
        await send(pkt(0xAF, [energy & 0xff, energy >> 8]))
        await send(pkt(0xBD, [speed]))
        await send(pkt(0xBE, [1]))  # apply energy
        for i, r in enumerate(rows(img)):
            await paused.wait()
            await send(pkt(0xA2, r))
            if i % 8 == 7:
                await asyncio.sleep(0.02)  # ponytail: fixed throttle. If lines are missing, increase it
        for i in range(feed):  # blank rows, not 0xA1 feed: blank rows always move the paper
            await send(pkt(0xA2, bytes(WIDTH // 8)))
            if i % 8 == 7:
                await asyncio.sleep(0.02)
        await send(pkt(0xA6, [0xAA, 0x55, 0x17, 0, 0, 0, 0, 0, 0, 0, 0x17]))  # lattice end
        await send(pkt(0xA3, [0]))
        await asyncio.sleep(1.5)  # the printer must empty its buffer before the disconnect


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('text', nargs='?', default='')
    ap.add_argument('--image')
    ap.add_argument('--size', type=int, default=32, help='font size in px')
    ap.add_argument('--energy', type=int, default=12000, help='darkness, ~8000-20000')
    ap.add_argument('--speed', type=int, default=32, help='lower = slower and darker')
    ap.add_argument('--feed', type=int, default=150, help='blank lines after print')
    a = ap.parse_args()
    img = load_image(a.image) if a.image else render_text(a.text.replace('\\n', '\n'), a.size)
    asyncio.run(print_image(img, a.energy, a.speed, a.feed))


if __name__ == '__main__':
    main()
