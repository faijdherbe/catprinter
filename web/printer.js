// MX10 printer: packets (pure functions) and the Web Bluetooth transport.
// Protocol: see README.md -> Protocol notes.
export const WIDTH = 384;
export const SERVICE = 0xae30; // check on the real printer before the first test print
const TX = 0xae01;
const RX = 0xae02;

export function crc8(data) {
  let c = 0;
  for (const x of data) {
    c ^= x;
    for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 7) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

export function pkt(cmd, payload) {
  const p = [...payload];
  return Uint8Array.from([0x51, 0x78, cmd, 0, p.length & 0xff, p.length >> 8, ...p, crc8(p), 0xff]);
}

// One 48-byte row per bitmap row. Bit 0 = leftmost pixel. 1 = black.
export function packRows(bitmap) {
  const rows = [];
  for (let y = 0; y < bitmap.height; y++) {
    const r = new Uint8Array(WIDTH / 8);
    for (let x = 0; x < WIDTH; x++) if (bitmap.data[y * WIDTH + x]) r[x >> 3] |= 1 << (x & 7);
    rows.push(r);
  }
  return rows;
}

export function printJob(bitmap, {energy, speed, feed}) {
  const blank = new Uint8Array(WIDTH / 8);
  return [
    pkt(0xA3, [0]), // get state
    pkt(0xA4, [0x33]), // quality
    pkt(0xA6, [0xAA, 0x55, 0x17, 0x38, 0x44, 0x5F, 0x5F, 0x5F, 0x44, 0x38, 0x2C]), // lattice start
    pkt(0xAF, [energy & 0xff, energy >> 8]),
    pkt(0xBD, [speed]),
    pkt(0xBE, [1]), // apply energy
    ...packRows(bitmap).map(r => pkt(0xA2, r)),
    ...Array.from({length: feed}, () => pkt(0xA2, blank)), // blank rows: 0xA1 feed does not always move the paper
    pkt(0xA6, [0xAA, 0x55, 0x17, 0, 0, 0, 0, 0, 0, 0, 0x17]), // lattice end
    pkt(0xA3, [0]),
  ];
}

const STATE_BITS = [[1, 'paper'], [2, 'cover'], [4, 'heat'], [8, 'battery']]; // 0x80 = busy, not an error
export const stateErrors = b => STATE_BITS.filter(([bit]) => b & bit).map(([, k]) => k);

let device = null;
let tx = null;
let paused = false;
let resume = null;
let chunk = 512;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Test the real API: 'ok', 'no-api' (browser has no Web Bluetooth) or 'off' (no adapter, or Bluetooth is off).
export async function bluetoothState() {
  if (!navigator.bluetooth?.requestDevice) return 'no-api';
  try {
    return (await navigator.bluetooth.getAvailability()) ? 'ok' : 'off';
  } catch {
    return 'no-api';
  }
}

export const isConnected = () => !!device?.gatt.connected;

export async function connect(onEvent) {
  if (!device) {
    // Cat printers with the 0x51 0x78 protocol. Only the MX10 is tested.
    const filters = ['MX', 'GB', 'GT', 'YT'].map(namePrefix => ({namePrefix}));
    device = await navigator.bluetooth.requestDevice({filters, optionalServices: [SERVICE]});
    device.addEventListener('gattserverdisconnected', () => {
      paused = false;
      resume?.(); // a print that waits for 'resume' continues, and its next write fails
      onEvent('disconnected');
    });
  }
  const service = await (await device.gatt.connect()).getPrimaryService(SERVICE);
  tx = await service.getCharacteristic(TX);
  const rx = await service.getCharacteristic(RX);
  rx.oncharacteristicvaluechanged = e => {
    const d = new Uint8Array(e.target.value.buffer);
    if (d.length < 7) return;
    if (d[2] === 0xAE) { // flow control: 0x10 = pause, 0x00 = resume
      paused = d[6] !== 0;
      if (!paused) resume?.();
    } else if (d[2] === 0xA3) onEvent('state', d[6]);
  };
  paused = false;
  await rx.startNotifications();
  await write(pkt(0xA3, [0]));
  return device.name;
}

export function disconnect() {
  device?.gatt.disconnect();
}

// ponytail: if a large write fails (small BLE MTU), use 20-byte writes. The printer reads a byte stream.
async function write(p) {
  for (let i = 0; i < p.length; i += chunk) {
    try {
      await tx.writeValueWithoutResponse(p.slice(i, i + chunk));
    } catch (e) {
      if (chunk === 20 || !isConnected()) throw e;
      chunk = 20;
      return write(p.slice(i));
    }
  }
}

export async function print(bitmap, settings, onProgress) {
  const total = bitmap.height + settings.feed;
  let rows = 0;
  for (const p of printJob(bitmap, settings)) {
    if (paused) await new Promise(r => (resume = r));
    await write(p);
    if (p[2] === 0xA2 && ++rows % 8 === 0) {
      onProgress(rows, total);
      await sleep(20); // ponytail: fixed throttle, the same as catprint.py. If lines are missing, increase it.
    }
  }
  await sleep(1500); // the printer must empty its buffer before the next job
}
