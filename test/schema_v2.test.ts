import { expect } from 'chai';

import { ITemplate, SchemaObject } from '../src';
import { ObjectSchema } from '../src/Schema';
import { deserialize, serialize } from '../src/Serialization';

describe('v2 schema fields are additive and decode-safe', () => {
    it('ObjectSchema ignores mediatype: identical serializer with and without it', () => {
        const withoutMediatype: SchemaObject[] = [
            {name: 'name', type: 'string'},
            {name: 'img', type: 'ipfs'},
            {name: 'level', type: 'uint64'}
        ];

        const withMediatype: SchemaObject[] = [
            {name: 'name', type: 'string', mediatype: 'text/plain'},
            {name: 'img', type: 'ipfs', mediatype: 'image/png'},
            {name: 'level', type: 'uint64', mediatype: 'text/plain'}
        ];

        const object = {
            name: 'Founder Card',
            img: 'QmS6AaitSdut3Te4fagW6jgfyKL73A1NBSSt3K38vQP9xf',
            level: '7'
        };

        const bytesWithout = serialize(object, ObjectSchema(withoutMediatype));
        const bytesWith = serialize(object, ObjectSchema(withMediatype));

        expect(bytesWith).to.deep.equal(bytesWithout);
    });

    it('uint64 round-trips to its decimal string form', () => {
        const schema = ObjectSchema([{name: 'level', type: 'uint64'}]);

        // Serialize from a native number and from a string; both must decode to
        // the decimal string form the ECA consumer persists.
        expect(deserialize(serialize({level: 7}, schema), schema)).to.deep.equal({level: '7'});
        expect(deserialize(serialize({level: '7'}, schema), schema)).to.deep.equal({level: '7'});
    });

    it('ITemplate carries optional mutable_data (compile-only)', () => {
        // A template response without mutable_data type-checks and reads undefined.
        const template: ITemplate = {
            contract: 'atomicassets',
            collection: {} as ITemplate['collection'],
            schema: {} as ITemplate['schema'],
            template_id: '1',
            max_supply: '0',
            is_transferable: true,
            is_burnable: true,
            issued_supply: '0',
            immutable_data: {},
            created_at_block: '0',
            created_at_time: '0'
        };

        expect(template.mutable_data).to.equal(undefined);
    });
});
