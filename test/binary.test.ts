import { expect } from 'chai';

import {
    base58_decode,
    base58_encode,
    byte_vector_to_int,
    hex_decode,
    hex_encode,
    int_to_byte_vector,
    integer_sign, integer_unsign,
    varint_decode,
    varint_encode,
    zigzag_decode,
    zigzag_encode
} from '../src/Serialization/Binary';
import { prepare } from '../src/Serialization/State';

describe('Binary', () => {
    it('sign integer', () => {
        expect(Number(integer_sign(BigInt(-534), 2))).to.equal(65002);
        expect(Number(integer_sign(BigInt(534), 2))).to.equal(534);
        expect(Number(integer_sign(BigInt(0), 2))).to.equal(0);
    });

    it('unsign integer', () => {
        expect(Number(integer_unsign(BigInt(65002), 2))).to.equal(-534);
        expect(Number(integer_unsign(BigInt(534), 2))).to.equal(534);
        expect(Number(integer_unsign(BigInt(0), 2))).to.equal(0);
    });

    it('unsign integer at the sign-bit and range boundaries', () => {
        expect(Number(integer_unsign(BigInt(128), 1))).to.equal(-128);
        expect(Number(integer_unsign(BigInt(127), 1))).to.equal(127);
        expect(Number(integer_unsign(BigInt(255), 1))).to.equal(-1);
        expect(() => integer_unsign(BigInt(256), 1)).to.throw('too big');
    });

    it('pack integer below 127', () => {
        expect(varint_encode(BigInt(5))).to.deep.equal(new Uint8Array([0b00000101]));
    });

    it('unpack integer below 127', () => {
        const data = new Uint8Array([0b00000101]);

        expect(Number(varint_decode(prepare(data)))).to.equal(5);
    });

    it('pack 2 bytes', () => {
        expect(varint_encode(BigInt(230))).to.deep.equal(new Uint8Array([0b11100110, 0b00000001]));
    });

    it('unpack 2 bytes', () => {
        const data = new Uint8Array([0b11100110, 0b00000001]);

        expect(Number(varint_decode(prepare(data)))).to.equal(230);
    });

    it('pack max integer', () => {
        expect(varint_encode(BigInt(4294867286))).to.deep.equal(new Uint8Array([0b11010110, 0b11110010, 0b11111001, 0b11111111, 0b00001111]));
    });

    it('unpack max integer', () => {
        const data = new Uint8Array([0b11010110, 0b11110010, 0b11111001, 0b11111111, 0b00001111]);

        expect(Number(varint_decode(prepare(data)))).to.equal(4294867286);
    });

    it('base58 encode', () => {
        expect(base58_encode(hex_decode('122037b8d00f5a5b37181c8fa8a05f7446b2ea06a0bbaaba3f1e95e4e97726a5e67c'))).to.equal('QmS6AaitSdut3Te4fagW6jgfyKL73A1NBSSt3K38vQP9xf');
    });

    it('base58 decode', () => {
        expect(hex_encode(base58_decode('QmS6AaitSdut3Te4fagW6jgfyKL73A1NBSSt3K38vQP9xf'))).to.equal('122037b8d00f5a5b37181c8fa8a05f7446b2ea06a0bbaaba3f1e95e4e97726a5e67c');
    });

    it('vector <-> int', () => {
        expect(byte_vector_to_int(int_to_byte_vector(1000))).to.equal(1000);
    });

    it('zigzag encode', () => {
        expect(Number(zigzag_encode(6))).to.equal(12);
        expect(Number(zigzag_encode(1))).to.equal(2);
        expect(Number(zigzag_encode(-1))).to.equal(1);
        expect(Number(zigzag_encode(0))).to.equal(0);
    });

    it('zigzag decode', () => {
        expect(Number(zigzag_decode(12))).to.equal(6);
        expect(Number(zigzag_decode(3))).to.equal(-2);
        expect(Number(zigzag_decode(2))).to.equal(1);
        expect(Number(zigzag_decode(1))).to.equal(-1);
        expect(Number(zigzag_decode(0))).to.equal(0);
    });
});
