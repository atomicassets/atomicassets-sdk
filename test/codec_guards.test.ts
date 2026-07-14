import { expect } from 'chai';

import { CachedObjectSchema, convertAttributeMapToObject, deserialize, ObjectSchema, ParserTypes, serialize, toByteArray } from '../src';
import { base58_decode, hex_encode, varint_decode } from '../src/Serialization/Binary';
import SerializationState, { prepare } from '../src/Serialization/State';

describe('Codec guards', () => {
    describe('signed integer bounds', () => {
        it('serialize rejects negatives below the type minimum', () => {
            expect(() => ParserTypes['int8'].serialize('-129')).to.throw('too small');
            expect(() => ParserTypes['int8'].serialize('-1000000')).to.throw('too small');
            expect(() => ParserTypes['int16'].serialize('-32769')).to.throw('too small');
            expect(() => ParserTypes['int64'].serialize('-9223372036854775809')).to.throw('too small');
        });

        it('serialize still accepts the exact type minimum and maximum', () => {
            const schema = ObjectSchema([{name: 'v', type: 'int8'}]);

            expect(deserialize(serialize({v: -128}, schema), schema)).to.deep.equal({v: -128});
            expect(deserialize(serialize({v: 127}, schema), schema)).to.deep.equal({v: 127});

            const schema64 = ObjectSchema([{name: 'v', type: 'int64'}]);

            expect(deserialize(serialize({v: '-9223372036854775808'}, schema64), schema64))
                .to.deep.equal({v: '-9223372036854775808'});
            expect(deserialize(serialize({v: '9223372036854775807'}, schema64), schema64))
                .to.deep.equal({v: '9223372036854775807'});
        });

        it('deserialize rejects a hostile varint decoding below the type minimum', () => {
            // zigzag(2000000 - 1 => odd) decodes to -1000000, far below int8 range.
            const hostile = ParserTypes['int32'].serialize('-1000000');
            const state = new SerializationState(hostile, 0);

            expect(() => ParserTypes['int8'].deserialize(state)).to.throw('too small');
        });
    });

    describe('varint length cap', () => {
        it('accepts the maximum legal 10-byte varint (uint64 max, int64 min)', () => {
            const schema = ObjectSchema([{name: 'v', type: 'uint64'}]);

            expect(deserialize(serialize({v: '18446744073709551615'}, schema), schema))
                .to.deep.equal({v: '18446744073709551615'});

            // int64 min zigzag-encodes to the widest legal varint.
            expect(ParserTypes['int64'].serialize('-9223372036854775808').length).to.equal(10);
        });

        it('rejects a continuation-byte run beyond the maximum varint length', () => {
            const hostile = new Uint8Array(1000).fill(0x80);

            expect(() => varint_decode(prepare(hostile))).to.throw('maximum encoded length');
        });
    });

    describe('base58 validity', () => {
        it('throws on a non-base58 character', () => {
            expect(() => base58_decode('Qm0')).to.throw('Non-base58 character');
            expect(() => base58_decode(' Qm')).to.throw('Non-base58 character');
        });

        it('still decodes the empty string to zero bytes', () => {
            expect(base58_decode('')).to.deep.equal(new Uint8Array(0));
        });

        it('surfaces malformed IPFS hashes from serialize instead of emitting empty bytes', () => {
            const schema = ObjectSchema([{name: 'img', type: 'ipfs'}]);

            expect(() => serialize({img: 'QmS6AaitSdut3Te4fagW6jgfyKL73A1NBSSt3K38vQ0000'}, schema))
                .to.throw('Non-base58 character');
        });
    });

    describe('deserialize input widening', () => {
        const schema = ObjectSchema([{name: 'name', type: 'string'}]);
        const bytes = serialize({name: 'Founder Card'}, schema);

        it('accepts Uint8Array, number[], hex string and \\x-prefixed hex string', () => {
            const hex = hex_encode(bytes);

            expect(deserialize(bytes, schema)).to.deep.equal({name: 'Founder Card'});
            expect(deserialize(Array.from(bytes), schema)).to.deep.equal({name: 'Founder Card'});
            expect(deserialize(hex, schema)).to.deep.equal({name: 'Founder Card'});
            expect(deserialize('\\x' + hex, schema)).to.deep.equal({name: 'Founder Card'});
        });

        it('toByteArray normalizes all input shapes to identical bytes', () => {
            const hex = hex_encode(bytes);

            expect(toByteArray(bytes)).to.deep.equal(bytes);
            expect(toByteArray(Array.from(bytes))).to.deep.equal(bytes);
            expect(toByteArray(hex)).to.deep.equal(bytes);
            expect(toByteArray('\\x' + hex)).to.deep.equal(bytes);
        });
    });

    describe('CachedObjectSchema', () => {
        const format = [{name: 'name', type: 'string'}, {name: 'level', type: 'uint64'}];

        it('returns the same instance for an equal format array', () => {
            expect(CachedObjectSchema(format)).to.equal(CachedObjectSchema([...format.map((f) => ({...f}))]));
        });

        it('returns distinct instances for distinct formats', () => {
            expect(CachedObjectSchema(format)).to.not.equal(CachedObjectSchema([{name: 'other', type: 'string'}]));
        });

        it('round-trips identically to ObjectSchema', () => {
            const object = {name: 'Founder Card', level: '7'};
            const cached = CachedObjectSchema(format);

            expect(deserialize(serialize(object, cached), cached)).to.deep.equal(object);
            expect(serialize(object, cached)).to.deep.equal(serialize(object, ObjectSchema(format)));
        });

        it('evicts the oldest entry once the cache exceeds 500 distinct formats', () => {
            const firstFormat = [{name: 'evict-first-0', type: 'string'}];
            const firstCached = CachedObjectSchema(firstFormat);

            // Insert 499 more distinct fresh formats so the first entry is still
            // the oldest survivor (500 total so far), then touch a "still cached"
            // one before pushing past the 500 cap.
            for (let i = 1; i < 499; i++) {
                CachedObjectSchema([{name: `evict-fill-${i}`, type: 'string'}]);
            }

            const stillCachedFormat = [{name: 'evict-still-cached', type: 'string'}];
            const stillCached = CachedObjectSchema(stillCachedFormat);

            // One more insert pushes the cache past 500, evicting the oldest entry.
            CachedObjectSchema([{name: 'evict-last', type: 'string'}]);

            // The first-inserted format should have been evicted, so a fresh build
            // yields a new, non-identical schema instance.
            expect(CachedObjectSchema(firstFormat)).to.not.equal(firstCached);

            // A format touched again inside the eviction window stays memoized.
            expect(CachedObjectSchema(stillCachedFormat)).to.equal(stillCached);
        });
    });

    describe('prototype pollution guards for on-chain field names', () => {
        it('MappingSchema deserialize writes a __proto__-named field as an own property', () => {
            const schema = ObjectSchema([{name: '__proto__', type: 'string'}]);
            // Computed key syntax creates a real own property; `{__proto__: ...}` literal
            // syntax instead sets the object's prototype, which would defeat this test.
            const input: any = {['__proto__']: 'polluted'};
            const bytes = serialize(input, schema);

            const result = deserialize(bytes, schema) as any;

            expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).to.equal(true);
            expect(result.__proto__).to.equal('polluted');
            expect(Object.getPrototypeOf(result)).to.equal(Object.prototype);
            expect((Object.prototype as any).polluted).to.equal(undefined);
            expect(({} as any).__proto__).to.equal(Object.prototype);
        });

        it('convertAttributeMapToObject writes __proto__/constructor-named keys as own properties', () => {
            const data = [
                {key: '__proto__', value: ['string', 'polluted'] as any},
                {key: 'constructor', value: ['string', 'also-polluted'] as any},
            ];

            const result = convertAttributeMapToObject(data as any) as any;

            expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).to.equal(true);
            expect(result.__proto__).to.equal('polluted');
            expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).to.equal(true);
            expect(result.constructor).to.equal('also-polluted');
            expect(Object.getPrototypeOf(result)).to.equal(Object.prototype);
            expect((Object.prototype as any).polluted).to.equal(undefined);
            expect(({} as any).__proto__).to.equal(Object.prototype);
            expect(({}).constructor).to.equal(Object);
        });
    });
});
