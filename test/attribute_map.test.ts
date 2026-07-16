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

    it('converts the v2 {first, second} pair shape', () => {
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
