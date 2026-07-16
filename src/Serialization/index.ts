import { ISchema } from '../Schema';
import MappingSchema from '../Schema/MappingSchema';
import { concat_byte_arrays, hex_decode, varint_encode } from './Binary';
import SerializationState from './State';

// Serialized data reaches consumers in three shapes: a hex string over SHIP
// snapshots (optionally with Postgres bytea's \x prefix), a plain byte array
// over live deltas and get_table_rows JSON, and a Uint8Array from code that
// already normalized.
export type ByteInput = Uint8Array | number[] | string;

export function toByteArray(data: ByteInput): Uint8Array {
    if (typeof data === 'string') {
        return hex_decode(data.startsWith('\\x') ? data.substring(2) : data);
    }

    if (data instanceof Uint8Array) {
        return data;
    }

    return new Uint8Array(data);
}

export function serialize(object: any, schema: ISchema): Uint8Array {
    const data = schema.serialize(object);

    // remove terminating 0 byte because it is unnecessary
    if (schema instanceof MappingSchema) {
        return data.slice(0, data.length - 1);
    }

    return data;
}

// The return is typed for the dominant case (a MappingSchema root decoding
// to a plain object). A bare ValueSchema/VectorSchema root yields a
// scalar/array instead; such callers know their shape and can assert it.
export function deserialize(data: ByteInput, schema: ISchema): { [key: string]: any } {
    let bytes = toByteArray(data);

    if (schema instanceof MappingSchema) {
        bytes = concat_byte_arrays([bytes, varint_encode(0)]);
    }

    const state = new SerializationState(bytes, 0);

    return schema.deserialize(state);
}
