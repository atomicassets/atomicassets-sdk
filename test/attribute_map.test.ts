import { expect } from 'chai';

import { DecodedAttributeMap, convertAttributeMapToObject } from '../src';

describe('convertAttributeMapToObject', () => {
    it('converts the classic {key, value} entry shape', () => {
        const data: DecodedAttributeMap = [
            {key: 'name', value: ['string', 'Founder Card']},
            {key: 'rating', value: ['uint8', 5]}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            name: 'Founder Card',
            rating: 5
        });
    });

    // {first, second} is what CDT 4.1 and newer abigen emits for the pair
    // struct, not a contract version's shape; the release ABI is patched back
    // to key/value. An ABI from an unpatched build of either version decodes
    // to this spelling, so both are accepted.
    it('converts the {first, second} pair shape an unpatched ABI produces', () => {
        const data: DecodedAttributeMap = [
            {first: 'name', second: ['string', 'Founder Card']},
            {first: 'rating', second: ['uint8', 5]}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            name: 'Founder Card',
            rating: 5
        });
    });

    it('converts a mixed array of both entry shapes', () => {
        const data: DecodedAttributeMap = [
            {key: 'name', value: ['string', 'Founder Card']},
            {first: 'rating', second: ['uint8', 5]}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            name: 'Founder Card',
            rating: 5
        });
    });

    it('stringifies uint64/int64 scalar values', () => {
        const data: DecodedAttributeMap = [
            {key: 'mint', value: ['uint64', 42]},
            {first: 'balance', second: ['int64', -1]}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            mint: '42',
            balance: '-1'
        });
    });

    it('stringifies uint64/int64 values already passed as strings, avoiding precision loss', () => {
        const data: DecodedAttributeMap = [
            {key: 'mint', value: ['uint64', '18446744073709551615']}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            mint: '18446744073709551615'
        });
    });

    it('stringifies uint64/int64 vector elements', () => {
        const data: DecodedAttributeMap = [
            {key: 'mints', value: ['UINT64_VEC', [1, 2, 3]]},
            {first: 'deltas', second: ['INT64_VEC', [-1, 0, 1]]}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            mints: ['1', '2', '3'],
            deltas: ['-1', '0', '1']
        });
    });

    // A map objectified by @wharfkit/antelope carries a float32 or float64 as a
    // string, so the helper reads one back into the number the chain holds.
    it('reads a float64 value that arrives as a string as a number', () => {
        const data: DecodedAttributeMap = [
            {key: 'weight', value: ['float64', '92.13924923']}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            weight: 92.13924923
        });
    });

    it('rounds a float32 value that arrives as a string to the nearest float32', () => {
        const data: DecodedAttributeMap = [
            {key: 'ratio', value: ['float32', '1.0000001']}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            ratio: 1.0000001192092896
        });
    });

    it('reads a zero string as the number zero', () => {
        const data: DecodedAttributeMap = [
            {key: 'weight', value: ['float64', '0']},
            {key: 'ratio', value: ['float32', '0.0000']}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            weight: 0,
            ratio: 0
        });
    });

    it('leaves a float value that is already a number alone', () => {
        const data: DecodedAttributeMap = [
            {first: 'ratio', second: ['float64', 0.75]},
            {key: 'tenth', value: ['float32', 0.1]}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            ratio: 0.75,
            tenth: 0.1
        });
    });

    it('reads float vector elements as numbers', () => {
        const data: DecodedAttributeMap = [
            {key: 'weights', value: ['DOUBLE_VEC', ['1.5', 2]]},
            {first: 'ratios', second: ['FLOAT_VEC', ['1.0000001', 0.5]]}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            weights: [1.5, 2],
            ratios: [1.0000001192092896, 0.5]
        });
    });

    it('leaves a float string that is not a finite number alone', () => {
        const data: DecodedAttributeMap = [
            {key: 'weight', value: ['float64', 'abc']},
            {key: 'blank', value: ['float64', '']},
            {key: 'spaces', value: ['float32', '  ']},
            {key: 'overflow', value: ['float32', '1e39']},
            {key: 'underflow', value: ['float32', '1e-50']},
            {key: 'wideOverflow', value: ['float64', '1e400']},
            {key: 'wideUnderflow', value: ['float64', '1e-400']}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            weight: 'abc',
            blank: '',
            spaces: '  ',
            overflow: '1e39',
            underflow: '1e-50',
            wideOverflow: '1e400',
            wideUnderflow: '1e-400'
        });
    });

    it('keeps a uint64 value a decimal string', () => {
        const data: DecodedAttributeMap = [
            {key: 'mint', value: ['uint64', 7]}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            mint: '7'
        });
    });

    it('passes through other types unchanged', () => {
        const data: DecodedAttributeMap = [
            {key: 'active', value: ['bool', true]},
            {first: 'tags', second: ['string[]', ['a', 'b']]}
        ];

        expect(convertAttributeMapToObject(data)).to.deep.equal({
            active: true,
            tags: ['a', 'b']
        });
    });

    it('returns an empty object for an empty AttributeMap', () => {
        expect(convertAttributeMapToObject([])).to.deep.equal({});
    });

    it('accepts both entry shapes at the type level', () => {
        const classic: DecodedAttributeMap = [{key: 'k', value: ['string', 'v']}];
        const v2: DecodedAttributeMap = [{first: 'k', second: ['string', 'v']}];
        const mixed: DecodedAttributeMap = [
            {key: 'k', value: ['string', 'v']},
            {first: 'k2', second: ['string', 'v2']}
        ];

        expect(classic).to.have.lengthOf(1);
        expect(v2).to.have.lengthOf(1);
        expect(mixed).to.have.lengthOf(2);
    });
});
