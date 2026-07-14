import { expect } from 'chai';

import ExplorerApi from '../src/API/Explorer';
import RpcApi from '../src/API/Rpc';
import ExplorerActionGenerator from '../src/Actions/Explorer';
import RpcActionGenerator from '../src/Actions/Rpc';
import { EosioAuthorizationObject } from '../src';

// Shape tests against stubbed APIs: no network, only the attribute-map
// derivation and action packing paths.

const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];

const collectionFormat = [{name: 'description', type: 'string'}];
const schemaFormat = [{name: 'name', type: 'string'}, {name: 'level', type: 'uint64'}];

describe('RpcActionGenerator', () => {
    const api = {
        contract: 'atomicassets',
        config: async () => ({asset_counter: '0', offer_counter: '0', collection_format: collectionFormat}),
        getSchema: async () => ({rawFormat: async () => schemaFormat}),
        getTemplate: async () => ({schema: async () => ({rawFormat: async () => schemaFormat})})
    };
    const generator = new RpcActionGenerator(api as unknown as RpcApi);

    it('createcol derives the data AttributeMap from the config collection format', async () => {
        const actions = await generator.createcol(
            authorization, 'author', 'col', true, ['auth'], ['notify'], 0.05, {description: 'hello'}
        );

        expect(actions).to.deep.equal([{
            account: 'atomicassets',
            name: 'createcol',
            authorization,
            data: {
                author: 'author',
                collection_name: 'col',
                allow_notify: true,
                authorized_accounts: ['auth'],
                notify_accounts: ['notify'],
                market_fee: 0.05,
                data: [{key: 'description', value: ['string', 'hello']}]
            }
        }]);
    });

    it('mintasset derives both AttributeMaps from the template schema', async () => {
        const actions = await generator.mintasset(
            authorization, 'minter', 'col', 'schema', 1, 'owner', {name: 'Founder Card'}, {level: '1'}, []
        );

        expect(actions).to.deep.equal([{
            account: 'atomicassets',
            name: 'mintasset',
            authorization,
            data: {
                authorized_minter: 'minter',
                collection_name: 'col',
                schema_name: 'schema',
                template_id: 1,
                new_asset_owner: 'owner',
                immutable_data: [{key: 'name', value: ['string', 'Founder Card']}],
                mutable_data: [{key: 'level', value: ['uint64', '1']}],
                tokens_to_back: []
            }
        }]);
    });

    it('setcoldata derives the AttributeMap from the config collection format', async () => {
        const actions = await generator.setcoldata(authorization, 'col', {description: 'updated'});

        expect(actions[0].data.data).to.deep.equal([{key: 'description', value: ['string', 'updated']}]);
    });
});

describe('ExplorerActionGenerator', () => {
    const api = {
        getConfig: async () => ({contract: 'atomicassets', collection_format: collectionFormat}),
        getSchema: async () => ({format: schemaFormat}),
        getAsset: async () => ({schema: {format: schemaFormat}})
    };
    const generator = new ExplorerActionGenerator('atomicassets', api as unknown as ExplorerApi);

    it('createcol derives the data AttributeMap from the config collection format', async () => {
        const actions = await generator.createcol(
            authorization, 'author', 'col', true, [], [], 0.05, {description: 'hello'}
        );

        expect(actions[0].name).to.equal('createcol');
        expect(actions[0].data.data).to.deep.equal([{key: 'description', value: ['string', 'hello']}]);
    });

    it('createtempl derives the immutable AttributeMap from the schema format', async () => {
        const actions = await generator.createtempl(
            authorization, 'creator', 'col', 'schema', true, false, 1000, {name: 'Founder Card'}
        );

        expect(actions[0].data.max_supply).to.equal(1000);
        expect(actions[0].data.immutable_data).to.deep.equal([{key: 'name', value: ['string', 'Founder Card']}]);
    });

    it('setassetdata derives the mutable AttributeMap from the asset schema', async () => {
        const actions = await generator.setassetdata(authorization, 'editor', 'owner', '1', {level: '5'});

        expect(actions[0].data.new_mutable_data).to.deep.equal([{key: 'level', value: ['uint64', '5']}]);
    });
});
