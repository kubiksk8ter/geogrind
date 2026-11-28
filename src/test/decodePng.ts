import { inflateSync } from "node:zlib";

export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA value of a pixel, 0–255 per channel. */
  pixel(x: number, y: number): [number, number, number, number];
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RGBA = 6;
const BYTES_PER_PIXEL = 4;

/** Minimal decoder for the 8-bit RGBA, non-interlaced PNGs of the app icons. */
export function decodePng(bytes: Uint8Array): DecodedPng {
  if (!SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new Error("not a PNG");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  const data: Uint8Array[] = [];

  for (let offset = SIGNATURE.length; offset < bytes.length; ) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      if (body[8] !== 8 || body[9] !== RGBA || body[12] !== 0) {
        throw new Error("only 8-bit RGBA non-interlaced PNGs are supported");
      }
    }
    if (type === "IDAT") data.push(body);
    offset += 12 + length;
  }

  const pixels = unfilter(
    inflateSync(Buffer.concat(data)),
    width * BYTES_PER_PIXEL,
    height,
  );
  return {
    width,
    height,
    pixel(x, y) {
      const start = (y * width + x) * BYTES_PER_PIXEL;
      return [
        pixels[start] ?? 0,
        pixels[start + 1] ?? 0,
        pixels[start + 2] ?? 0,
        pixels[start + 3] ?? 0,
      ];
    },
  };
}

function unfilter(raw: Uint8Array, stride: number, height: number) {
  const out = new Uint8Array(stride * height);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const left =
        i >= BYTES_PER_PIXEL
          ? (out[row * stride + i - BYTES_PER_PIXEL] ?? 0)
          : 0;
      const up = row > 0 ? (out[(row - 1) * stride + i] ?? 0) : 0;
      const upLeft =
        row > 0 && i >= BYTES_PER_PIXEL
          ? (out[(row - 1) * stride + i - BYTES_PER_PIXEL] ?? 0)
          : 0;
      out[row * stride + i] =
        ((line[i] ?? 0) + predict(filter, left, up, upLeft)) & 0xff;
    }
  }
  return out;
}

function predict(
  filter: number | undefined,
  left: number,
  up: number,
  upLeft: number,
) {
  switch (filter) {
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return Math.floor((left + up) / 2);
    case 4: {
      const estimate = left + up - upLeft;
      const toLeft = Math.abs(estimate - left);
      const toUp = Math.abs(estimate - up);
      const toUpLeft = Math.abs(estimate - upLeft);
      if (toLeft <= toUp && toLeft <= toUpLeft) return left;
      return toUp <= toUpLeft ? up : upLeft;
    }
    default:
      return 0;
  }
}
