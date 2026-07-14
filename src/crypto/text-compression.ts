import { PPXError } from "../protocol/types";
import { zeroize } from "./zeroize";

export function supportsGzipStreams(): boolean {
  try {
    new CompressionStream("gzip");
    new DecompressionStream("gzip");
    return true;
  } catch {
    return false;
  }
}

async function collectBytes(
  readable: ReadableStream<Uint8Array>,
  maximumOutputBytes: number,
): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumOutputBytes) {
        zeroize(value, ...chunks);
        chunks.length = 0;
        await reader.cancel("output limit exceeded");
        throw new PPXError("oversize-before-allocation");
      }
      chunks.push(value);
    }
    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  } finally {
    zeroize(...chunks);
    reader.releaseLock();
  }
}

async function transformBytes(
  input: Uint8Array,
  transform: CompressionStream | DecompressionStream,
  maximumOutputBytes: number,
): Promise<Uint8Array> {
  const ownedInput = input.slice();
  const writer = transform.writable.getWriter();
  const writing = (async () => {
    await writer.write(ownedInput);
    await writer.close();
  })();
  try {
    const output = await collectBytes(transform.readable, maximumOutputBytes);
    await writing;
    return output;
  } catch (error) {
    await writer.abort(error).catch(() => undefined);
    await writing.catch(() => undefined);
    throw error;
  } finally {
    zeroize(ownedInput);
  }
}

export function gzipBytes(input: Uint8Array): Promise<Uint8Array> {
  return transformBytes(input, new CompressionStream("gzip"), 264_000);
}

export function gunzipBytesBounded(
  input: Uint8Array,
  maximumOutputBytes: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maximumOutputBytes) || maximumOutputBytes < 0) {
    throw new PPXError("impossible-length");
  }
  return transformBytes(
    input,
    new DecompressionStream("gzip"),
    maximumOutputBytes,
  );
}
