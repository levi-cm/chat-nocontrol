import { PPXError } from "./types";

export interface ByteReader {
  readBytes(length: number): Uint8Array;
  readUint8(): number;
  readUint16BE(): number;
  readUint32BE(): number;
  readUint64BE(): bigint;
  remaining(): number;
}

export interface ByteWriter {
  writeBytes(bytes: Uint8Array): void;
  writeUint8(value: number): void;
  writeUint16BE(value: number): void;
  writeUint32BE(value: number): void;
  writeUint64BE(value: bigint): void;
  toBytes(): Uint8Array;
}

function requireSafeLength(length: number): void {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new PPXError("impossible-length");
  }
}

export class StrictByteReader implements ByteReader {
  readonly #bytes: Uint8Array;
  #offset = 0;

  constructor(bytes: Uint8Array, maximumLength = bytes.byteLength) {
    requireSafeLength(maximumLength);
    if (bytes.byteLength > maximumLength) {
      throw new PPXError("oversize-before-allocation");
    }
    this.#bytes = bytes;
  }

  readBytes(length: number): Uint8Array {
    requireSafeLength(length);
    if (length > this.remaining()) {
      throw new PPXError("impossible-length");
    }
    const start = this.#offset;
    this.#offset += length;
    return this.#bytes.slice(start, this.#offset);
  }

  readUint8(): number {
    return this.readBytes(1)[0] as number;
  }

  readUint16BE(): number {
    const bytes = this.readBytes(2);
    return ((bytes[0] as number) << 8) | (bytes[1] as number);
  }

  readUint32BE(): number {
    const bytes = this.readBytes(4);
    return (
      ((bytes[0] as number) * 0x1_000000 +
        (bytes[1] as number) * 0x1_0000 +
        (bytes[2] as number) * 0x100 +
        (bytes[3] as number)) >>>
      0
    );
  }

  readUint64BE(): bigint {
    const bytes = this.readBytes(8);
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    return value;
  }

  remaining(): number {
    return this.#bytes.byteLength - this.#offset;
  }

  requireEnd(): void {
    if (this.remaining() !== 0) throw new PPXError("trailing-bytes");
  }
}

export class StrictByteWriter implements ByteWriter {
  readonly #bytes: Uint8Array;
  #offset = 0;

  constructor(maximumLength: number) {
    requireSafeLength(maximumLength);
    this.#bytes = new Uint8Array(maximumLength);
  }

  writeBytes(bytes: Uint8Array): void {
    if (bytes.byteLength > this.remaining()) {
      throw new PPXError("impossible-length");
    }
    this.#bytes.set(bytes, this.#offset);
    this.#offset += bytes.byteLength;
  }

  writeUint8(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
      throw new PPXError("impossible-length");
    }
    this.writeBytes(Uint8Array.of(value));
  }

  writeUint16BE(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new PPXError("impossible-length");
    }
    this.writeBytes(Uint8Array.of(value >>> 8, value));
  }

  writeUint32BE(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
      throw new PPXError("impossible-length");
    }
    this.writeBytes(
      Uint8Array.of(value >>> 24, value >>> 16, value >>> 8, value),
    );
  }

  writeUint64BE(value: bigint): void {
    if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
      throw new PPXError("impossible-length");
    }
    const bytes = new Uint8Array(8);
    let remaining = value;
    for (let index = bytes.length - 1; index >= 0; index -= 1) {
      bytes[index] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }
    this.writeBytes(bytes);
  }

  remaining(): number {
    return this.#bytes.byteLength - this.#offset;
  }

  toBytes(): Uint8Array {
    return this.#bytes.slice(0, this.#offset);
  }
}
