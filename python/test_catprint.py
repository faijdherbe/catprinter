"""Offline check of the packet encoding. Run: python3 test_catprint.py"""
from catprint import crc8, pkt, render_text, rows

assert crc8([0, 0, 0x49]) == 0xf8
assert pkt(0xA3, [0]).hex() == '5178a30001000000ff'
r = next(rows(render_text('X', 32)))
assert len(r) == 48  # 384 px / 8
print('ok')
