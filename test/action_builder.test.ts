import { expect } from 'chai';

import {
    ActionBuilder, ActionGenerator, ATOMIC_ATTRIBUTE, AtomicAssetsActionName, AtomicAssetsActionNames, AtomicAssetsActions,
    AttributeMap, AuthorSwapsTableRow, createAttributeMap, EosioAuthorizationObject, EosioSimpleAction,
    mergeSchemaFormatTypes, MutableTemplatesTableRow, SchemaTypesTableRow, toAttributeMap
} from '../src';

describe('ActionBuilder', () => {
    const contract = 'atomicassets';
    const builder = new ActionBuilder(contract);
    const generator = new ActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];

    const immutable_data: AttributeMap = [{key: 'name', value: ['string', 'Founder Card']}];
    const mutable_data: AttributeMap = [{key: 'level', value: ['uint64', '1']}];

    it('builds a single authorization-free action', () => {
        const action: EosioSimpleAction = builder.transfer('sender', 'recipient', ['1099511627776'], 'memo');

        expect(action).to.deep.equal({
            account: contract,
            name: 'transfer',
            data: {from: 'sender', to: 'recipient', asset_ids: ['1099511627776'], memo: 'memo'}
        });
    });

    it('builds createtempl2 with the ABI uint32 max_supply as a number', () => {
        const action = builder.createtempl2('creator', 'col', 'schema', true, false, 1000, immutable_data, mutable_data);

        expect(action.data.max_supply).to.equal(1000);
    });

    it('normalizes setschematyp info exactly like the generator', () => {
        const action = builder.setschematyp('editor', 'col', 'schema', [{name: 'img', mediatype: 'image/png'}]);

        expect(action.data.schema_format_type).to.deep.equal([{name: 'img', mediatype: 'image/png', info: ''}]);
    });

    it('covers the contract-authority actions', () => {
        expect(builder.admincoledit([{name: 'socials', type: 'string'}])).to.deep.equal({
            account: contract, name: 'admincoledit', data: {collection_format_extension: [{name: 'socials', type: 'string'}]}
        });
        expect(builder.init()).to.deep.equal({account: contract, name: 'init', data: {}});
        expect(builder.setversion('2.0.0')).to.deep.equal({account: contract, name: 'setversion', data: {new_version: '2.0.0'}});
    });

    it('ActionGenerator emits the builder action plus authorization for every action', async () => {
        const cases: Array<[EosioSimpleAction, Promise<import('../src').EosioActionObject[]>]> = [
            [builder.acceptauswap('col'), generator.acceptauswap(authorization, 'col')],
            [builder.burnasset('owner', '1'), generator.burnasset(authorization, 'owner', '1')],
            [
                builder.createcol('author', 'col', true, ['a'], ['n'], 0.05, immutable_data),
                generator.createcol(authorization, 'author', 'col', true, ['a'], ['n'], 0.05, immutable_data)
            ],
            [
                builder.createtempl('creator', 'col', 'schema', true, true, 10, immutable_data),
                generator.createtempl(authorization, 'creator', 'col', 'schema', true, true, 10, immutable_data)
            ],
            [
                builder.createtempl2('creator', 'col', 'schema', true, true, 10, immutable_data, mutable_data),
                generator.createtempl2(authorization, 'creator', 'col', 'schema', true, true, 10, immutable_data, mutable_data)
            ],
            [
                builder.mintasset('minter', 'col', 'schema', 1, 'owner', immutable_data, mutable_data, []),
                generator.mintasset(authorization, 'minter', 'col', 'schema', 1, 'owner', immutable_data, mutable_data, [])
            ],
            [builder.settempldata('editor', 'col', 42, mutable_data), generator.settempldata(authorization, 'editor', 'col', 42, mutable_data)],
            [builder.setversion('2.0.0'), generator.setversion(authorization, '2.0.0')],
            [builder.init(), generator.init(authorization)],
            [
                builder.admincoledit([{name: 'x', type: 'string'}]),
                generator.admincoledit(authorization, [{name: 'x', type: 'string'}])
            ]
        ];

        for (const [action, generated] of cases) {
            expect(await generated).to.deep.equal([{...action, authorization}]);
        }
    });

    // backasset is deprecated because v2 disables it behind a check() guard,
    // but it still executes on chains that have not migrated, so it must keep
    // working until a major version drops it. This pins its presence so a
    // later cleanup that removes it from the builder, the generator, or the
    // action-name list has to change a test that states the reason.
    it('still exposes the deprecated backasset action', () => {
        expect(builder.backasset).to.be.a('function');
        expect(generator.backasset).to.be.a('function');
        expect(AtomicAssetsActionNames).to.include.members(['backasset', 'logbackasset']);
    });

});

describe('ActionBuilder numeric guards', () => {
    const builder = new ActionBuilder('atomicassets');
    const generator = new ActionGenerator('atomicassets');
    const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];

    // NaN and Infinity are the shape worth pinning: JSON.stringify writes them
    // as null, so before the guard these built an action whose numeric field
    // had silently become null rather than either throwing or carrying the
    // value the caller passed.
    it('rejects a non-finite value on every numeric field, naming it', () => {
        expect(() => builder.createtempl('c', 'col', 'sch', true, true, NaN, [])).to.throw('max_supply');
        expect(() => builder.createtempl2('c', 'col', 'sch', true, true, Infinity, [], [])).to.throw('max_supply');
        expect(() => builder.redtemplmax('e', 'col', 1, NaN)).to.throw('new_max_supply');
        expect(() => builder.mintasset('m', 'col', 'sch', NaN, 'o', [], [], [])).to.throw('template_id');
        expect(() => builder.deltemplate('e', 'col', -Infinity)).to.throw('template_id');
        expect(() => builder.locktemplate('e', 'col', NaN)).to.throw('template_id');
        expect(() => builder.settempldata('e', 'col', NaN, [])).to.throw('template_id');
        expect(() => builder.createcol('a', 'col', true, [], [], NaN, [])).to.throw('market_fee');
        expect(() => builder.setmarketfee('col', Infinity)).to.throw('market_fee');
    });

    it('rejects a fractional or negative value where the ABI field is uint32', () => {
        expect(() => builder.createtempl('c', 'col', 'sch', true, true, 1.5, [])).to.throw('max_supply');
        expect(() => builder.createtempl('c', 'col', 'sch', true, true, -1, [])).to.throw('max_supply');
        expect(() => builder.createtempl('c', 'col', 'sch', true, true, 4294967296, [])).to.throw('max_supply');
        expect(() => builder.redtemplmax('e', 'col', 1, -1)).to.throw('new_max_supply');
    });

    // template_id is int32, and -1 is how the contract and the README both
    // spell "no template", so the signed range is the whole bound.
    it('keeps the -1 template_id sentinel and the uint32 edges', () => {
        expect(builder.mintasset('m', 'col', 'sch', -1, 'o', [], [], []).data.template_id).to.equal(-1);
        expect(builder.createtempl('c', 'col', 'sch', true, true, 0, []).data.max_supply).to.equal(0);
        expect(builder.createtempl('c', 'col', 'sch', true, true, 4294967295, []).data.max_supply).to.equal(4294967295);
        expect(() => builder.mintasset('m', 'col', 'sch', 1.5, 'o', [], [], [])).to.throw('template_id');
    });

    // market_fee is float64, so a fraction is the point of the field; only
    // finiteness is checkable here. What fee the contract accepts is the
    // chain's rule and it returns a legible error for it.
    it('passes a fractional market_fee through untouched', () => {
        expect(builder.createcol('a', 'col', true, [], [], 0.05, []).data.market_fee).to.equal(0.05);
        expect(builder.setmarketfee('col', 5).data.market_fee).to.equal(5);
    });

    it('guards the generator through the same builder', async () => {
        let message = '';

        try {
            await generator.createtempl(authorization, 'c', 'col', 'sch', true, true, NaN, []);
        } catch (error) {
            message = (error as Error).message;
        }

        expect(message).to.contain('max_supply');
    });
});

describe('createAttributeMap and ATOMIC_ATTRIBUTE', () => {
    it('maps schema type aliases to the canonical ABI variant names', () => {
        expect(ATOMIC_ATTRIBUTE['fixed8']).to.equal('uint8');
        expect(ATOMIC_ATTRIBUTE['float']).to.equal('float32');
        expect(ATOMIC_ATTRIBUTE['double']).to.equal('float64');
        expect(ATOMIC_ATTRIBUTE['ipfs']).to.equal('string');
        expect(ATOMIC_ATTRIBUTE['bool']).to.equal('uint8');
        expect(ATOMIC_ATTRIBUTE['uint64[]']).to.equal('UINT64_VEC');
        expect(ATOMIC_ATTRIBUTE['string[]']).to.equal('STRING_VEC');
    });

    it('builds an AttributeMap without a schema', () => {
        const map = createAttributeMap(
            {name: 'Founder Card', rating: 5, img: 'QmS6AaitSdut3Te4fagW6jgfyKL73A1NBSSt3K38vQP9xf'},
            {name: 'string', rating: 'fixed8', img: 'ipfs'}
        );

        expect(map).to.deep.equal([
            {key: 'name', value: ['string', 'Founder Card']},
            {key: 'rating', value: ['uint8', 5]},
            {key: 'img', value: ['string', 'QmS6AaitSdut3Te4fagW6jgfyKL73A1NBSSt3K38vQP9xf']}
        ]);
    });

    it('throws for a missing or unknown type', () => {
        expect(() => createAttributeMap({a: 1}, {})).to.throw('no type given');
        expect(() => createAttributeMap({a: 1}, {a: 'nosuchtype'})).to.throw('invalid type');
    });

    it('toAttributeMap is exported and builds from a schema format', () => {
        expect(toAttributeMap({name: 'Founder Card'}, [{name: 'name', type: 'string'}]))
            .to.deep.equal([{key: 'name', value: ['string', 'Founder Card']}]);
    });
});

describe('Contract table and action-name exports', () => {
    it('types the v2 table rows (compile-check)', () => {
        const swap: AuthorSwapsTableRow = {
            collection_name: 'col', current_author: 'a', new_author: 'b', acceptance_date: 1234567890
        };
        const mutables: MutableTemplatesTableRow = {template_id: 1, schema_name: 'schema', mutable_serialized_data: [4, 10, 65]};
        const types: SchemaTypesTableRow = {
            schema_name: 'schema', format_type: [{name: 'img', mediatype: 'image/png', info: ''}]
        };

        expect(swap.acceptance_date).to.be.a('number');
        expect(mutables.mutable_serialized_data).to.deep.equal([4, 10, 65]);
        expect(types.format_type[0].mediatype).to.equal('image/png');
    });

    it('exports every v1+v2 action name', () => {
        expect(AtomicAssetsActions.settempldata).to.equal('settempldata');
        expect(AtomicAssetsActions.transfer).to.equal('transfer');
        expect(Object.keys(AtomicAssetsActions)).to.have.length(AtomicAssetsActionNames.length);
        expect(AtomicAssetsActionNames).to.include.members([
            'createtempl', 'createtempl2', 'settempldata', 'setschematyp', 'createauswap', 'setlastpayer',
            'admincoledit', 'init', 'setversion', 'logmint', 'logtransfer', 'transfer'
        ]);

        const name: AtomicAssetsActionName = 'createtempl2';
        expect(name).to.equal('createtempl2');
    });
});

describe('mergeSchemaFormatTypes', () => {
    const format = [
        {name: 'name', type: 'string'},
        {name: 'img', type: 'ipfs'},
        {name: 'intro_video', type: 'string'},
        {name: 'level', type: 'uint64'}
    ];

    it('prefers explicit schematypes entries over the name heuristic', () => {
        const merged = mergeSchemaFormatTypes(format, [{name: 'img', mediatype: 'model/gltf-binary', info: '3d'}]);

        expect(merged.find((f) => f.name === 'img')).to.deep.equal(
            {name: 'img', type: 'ipfs', mediatype: 'model/gltf-binary', info: '3d'}
        );
    });

    it('falls back to the field-name heuristic', () => {
        const merged = mergeSchemaFormatTypes(format, []);

        expect(merged).to.deep.equal([
            {name: 'name', type: 'string', mediatype: 'name', info: null},
            {name: 'img', type: 'ipfs', mediatype: 'image', info: null},
            {name: 'intro_video', type: 'string', mediatype: 'video', info: null},
            {name: 'level', type: 'uint64', mediatype: null, info: null}
        ]);
    });
});
