import { expect } from 'chai';

import RpcApi from '../src/API/Rpc';
import { ObjectSchema, serialize } from '../src';

// Stubbed-fetch coverage of the v2 RPC read paths: the templates/templates2
// join and the schematypes lookup. No network involved.

const schemaFormat = [{name: 'name', type: 'string'}, {name: 'level', type: 'uint64'}];
const codec = ObjectSchema(schemaFormat);

const immutableBytes = Array.from(serialize({name: 'Founder Card'}, codec));
const mutableBytes = Array.from(serialize({level: '7'}, codec));

const tables: { [table: string]: any[] } = {
    config: [{asset_counter: '0', offer_counter: '0', collection_format: []}],
    schemas: [{schema_name: 'myschema', format: schemaFormat}],
    templates: [{
        template_id: 1, schema_name: 'myschema', transferable: true, burnable: true,
        max_supply: 0, issued_supply: 1, immutable_serialized_data: immutableBytes
    }],
    templates2: [{template_id: 1, schema_name: 'myschema', mutable_serialized_data: mutableBytes}],
    schematypes: [{schema_name: 'myschema', format_type: [{name: 'name', mediatype: 'text/plain', info: 'title'}]}]
};

function fakeFetch(_url?: any, init?: any): Promise<any> {
    const body = JSON.parse(init.body);
    const rows = tables[body.table] ?? [];

    return Promise.resolve({
        ok: true,
        json: async () => ({rows, more: false})
    });
}

describe('RPC v2 tables', () => {
    const api = new RpcApi('http://localhost', 'atomicassets', {fetch: fakeFetch as any, rateLimit: 64});

    it('joins templates2 mutable data into the template', async () => {
        const template = await api.getTemplate('mycollection', '1');

        expect(await template.immutableData()).to.deep.equal({name: 'Founder Card'});
        expect(await template.mutableData()).to.deep.equal({level: '7'});
        expect(await template.data()).to.deep.equal({name: 'Founder Card', level: '7'});
    });

    it('exposes empty mutable data for a template without a templates2 row', async () => {
        const emptyTables: { [table: string]: any[] } = {...tables, templates2: []};
        const emptyApi = new RpcApi('http://localhost', 'atomicassets', {
            fetch: ((_url?: any, init?: any) => {
                const body = JSON.parse(init.body);

                return Promise.resolve({ok: true, json: async () => ({rows: emptyTables[body.table] ?? [], more: false})});
            }) as any,
            rateLimit: 64
        });

        const template = await emptyApi.getTemplate('mycollection', '1');

        expect(await template.mutableData()).to.deep.equal({});
        expect(await template.data()).to.deep.equal({name: 'Founder Card'});
    });

    it('reads schematypes through RpcSchema.formatTypes', async () => {
        const schema = await api.getSchema('mycollection', 'myschema');

        expect(await schema.formatTypes()).to.deep.equal([{name: 'name', mediatype: 'text/plain', info: 'title'}]);
    });
});
