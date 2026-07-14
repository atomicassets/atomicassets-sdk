import { expect } from 'chai';

import {
    ActionBuilder, ActionGenerator, ATOMIC_ATTRIBUTE, AtomicAssetsActionName, AtomicAssetsActionNames, AtomicAssetsActions,
    AttributeMap, AuthorSwapsTableRow, createAttributeMap, EosioAuthorizationObject, EosioSimpleAction,
    mergeSchemaFormatTypes, SchemaTypesTableRow, Templates2TableRow, toAttributeMap
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
        const mutables: Templates2TableRow = {template_id: 1, schema_name: 'schema', mutable_serialized_data: [4, 10, 65]};
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
