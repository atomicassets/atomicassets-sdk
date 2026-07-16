import { expect } from 'chai';

import { varint_encode, integer_sign, zigzag_encode } from '../src/Serialization/Binary';

// Pins the input-coercion contract of the big-integer -> native BigInt swap.
// Native BigInt() throws on non-integer / null / undefined input, where the
// old big-integer coerced toward 0. This is a deliberate fail-fast: encoding
// malformed input as a silent zero was never correct. Valid-integer byte
// output is unchanged (covered by the serialization guard suite).
describe('Binary input coercion (BigInt fail-fast)', () => {
    it('rejects fractional input instead of coercing to zero', () => {
        expect(() => varint_encode(1.5)).to.throw();
        expect(() => zigzag_encode(1.5)).to.throw();
    });

    it('rejects null/undefined input', () => {
        expect(() => varint_encode(null)).to.throw();
        expect(() => varint_encode(undefined)).to.throw();
        expect(() => integer_sign(null, 8)).to.throw();
    });

    it('still accepts valid integer and numeric-string input', () => {
        expect(() => varint_encode(0)).to.not.throw();
        expect(() => varint_encode('4294867286')).to.not.throw();
        expect(() => integer_sign(-1, 8)).to.not.throw();
    });
});
