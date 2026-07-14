import DeserializationError from '../Errors/DeserializationError';
import SerializationError from '../Errors/SerializationError';
import BaseCoder from './Coders/Base';
import SerializationState from './State';

export function varint_encode(input: any): Uint8Array {
    const bytes: number[] = [];
    let n = BigInt(input);

    if (n < 0n) {
        throw new SerializationError('cant pack negative integer');
    }

    while (true) {
        const byte = n & 0x7Fn;

        n = n >> 7n;

        if (n === 0n) {
            bytes.push(Number(byte));

            break;
        }

        bytes.push(Number(byte) + 128);
    }

    return new Uint8Array(bytes);
}

// The widest legal varint is the 64-bit maximum zigzag value, which needs
// ceil(70 / 7) = 10 bytes. Anything longer is hostile input designed to burn
// quadratic BigInt work, so it is rejected before the loop accumulates it.
const VARINT_MAX_BYTES = 10;

export function varint_decode(state: SerializationState): bigint {
    let result = 0n;

    for (let i = 0; true; i++) {
        if (i >= VARINT_MAX_BYTES) {
            throw new DeserializationError('varint exceeds maximum encoded length');
        }

        if (state.position >= state.data.length) {
            throw new DeserializationError('failed to unpack integer');
        }

        const byte = BigInt(state.data[state.position]);
        state.position += 1;

        if (byte < 128n) {
            result = result + (byte << BigInt(7 * i));

            break;
        }

        result = result + ((byte & 0x7Fn) << BigInt(7 * i));
    }

    return result;
}

export function integer_sign(input: any, size: number): bigint {
    const n = BigInt(input);

    if (n >= 2n ** BigInt(8 * size - 1)) {
        throw new Error('cannot sign integer: too big');
    }

    if (n >= 0n) {
        return n;
    }

    return (-n ^ (2n ** BigInt(8 * size) - 1n)) + 1n;
}

// Deliberate divergence from the v1 package: both comparisons are >= where v1
// used strict >, so the exact sign-bit value maps to the correct
// two's-complement minimum (e.g. -128 for size 1) and out-of-range input
// throws instead of computing garbage. Unused by the codec's own
// encode/decode paths, so the wire format is unaffected.
export function integer_unsign(input: any, size: number): bigint {
    const n = BigInt(input);

    if (n >= 2n ** BigInt(8 * size)) {
        throw new Error('cannot unsign integer: too big');
    }

    if (n >= 2n ** BigInt(8 * size - 1)) {
        return -((n - 1n) ^ (2n ** BigInt(8 * size) - 1n));
    }

    return n;
}

export function zigzag_encode(input: any): bigint {
    const n = BigInt(input);

    if (n < 0n) {
        return (n + 1n) * -2n + 1n;
    }

    return n * 2n;
}

export function zigzag_decode(input: any): bigint {
    const n = BigInt(input);

    if (n % 2n === 0n) {
        return n / 2n;
    }

    return n / 2n * -1n - 1n;
}

const bs58 = new BaseCoder('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');

export function base58_decode(data: string): Uint8Array {
    return bs58.decode(data);
}

export function base58_encode(data: Uint8Array): string {
    return bs58.encode(data);
}

export function hex_decode(hex: string): Uint8Array {
    const bytes = hex.match(/.{1,2}/g);

    if (!bytes) {
        return new Uint8Array(0);
    }

    return new Uint8Array(bytes.map((byte) => parseInt(byte, 16)));
}

export function hex_encode(bytes: Uint8Array): string {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
}

export function concat_byte_arrays(arr: Uint8Array[]): Uint8Array {
    // concat all bytearrays into one array
    const data = new Uint8Array(arr.reduce((acc, val) => acc + val.length, 0));

    let offset = 0;
    for (const bytes of arr) {
        data.set(bytes, offset);
        offset += bytes.length;
    }

    return data;
}

export function int_to_byte_vector(n: any): Uint8Array {
    const bytes: number[] = [];
    let num = BigInt(n);

    while (num !== 0n) {
        bytes.push(Number(num & 0xFFn));
        num = num >> 8n;
    }

    return new Uint8Array(bytes);
}

export function byte_vector_to_int(bytes: Uint8Array): number {
    let num = 0n;

    for (let i = 0; i < bytes.length; i++) {
        num = num + (BigInt(bytes[i]) << BigInt(8 * i));
    }

    return Number(num);
}
