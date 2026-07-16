import SerializationState from '../State';
import FixedParser from './FixedParser';

export default class FixedIntegerParser extends FixedParser {
    deserialize(state: SerializationState): number | string {
        const data: Uint8Array = super.deserialize(state).reverse();
        let n = 0n;

        for (const byte of data) {
            n = n << 8n;
            n = n + BigInt(byte);
        }

        if (this.size <= 6) {
            return Number(n);
        }

        return n.toString();
    }

    serialize(data: any): Uint8Array {
        let n = BigInt(data);
        const buffer: number[] = [];

        for (let i = 0; i < this.size; i++) {
            buffer.push(Number(n & 0xFFn));
            n = n >> 8n;
        }

        return super.serialize(new Uint8Array(buffer));
    }
}
