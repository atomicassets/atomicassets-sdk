import { expect } from 'chai';

import RpcApi from '../src/API/Rpc';
import { AUTHOR_SWAP_TIME_DELTA, ILightCollection } from '../src';

// Stubbed-fetch coverage of the authorswaps read: the request it sends, the
// row it resolves, and the null it resolves when the table holds no row. No
// network involved.

const swapRow = {
    collection_name: 'mycollection',
    current_author: 'currentauthr',
    new_author: 'newauthor111',
    acceptance_date: 1787249952
};

// Records every request body so a test can assert what went to the node.
function stubbedApi(rows: any[], requests: any[]): RpcApi {
    const fetch = (_url?: any, init?: any): Promise<any> => {
        requests.push(JSON.parse(init.body));

        return Promise.resolve({ok: true, json: async () => ({rows, more: false})});
    };

    return new RpcApi('http://localhost', 'atomicassets', {fetch: fetch as any, rateLimit: 64});
}

describe('RPC authorswaps', () => {
    it('resolves the authorswaps row of a collection', async () => {
        const requests: any[] = [];

        expect(await stubbedApi([swapRow], requests).getAuthorSwap('mycollection')).to.deep.equal(swapRow);
    });

    it('scopes the read to the contract account and bounds it to the collection', async () => {
        const requests: any[] = [];

        await stubbedApi([swapRow], requests).getAuthorSwap('mycollection');

        expect(requests.length).to.equal(1);
        expect(requests[0].code).to.equal('atomicassets');
        expect(requests[0].scope).to.equal('atomicassets');
        expect(requests[0].table).to.equal('authorswaps');
        expect(requests[0].lower_bound).to.equal('mycollection');
        expect(requests[0].upper_bound).to.equal('mycollection');
    });

    it('resolves null when the table holds no row', async () => {
        const requests: any[] = [];

        expect(await stubbedApi([], requests).getAuthorSwap('mycollection')).to.equal(null);
    });

    it('reads the table again on every call, so an erased row cannot stay cached', async () => {
        const requests: any[] = [];
        const api = stubbedApi([swapRow], requests);

        await api.getAuthorSwap('mycollection');
        await api.getAuthorSwap('mycollection');

        expect(requests.length).to.equal(2);
    });
});

// tsconfig.test.json type-checks this tree, so the fixtures below fail the
// build if ILightCollection stops accepting the field in any shape the API
// sends it: a string while a row exists, null once accept or reject erases it,
// and absent altogether from a 1.x server that never learned the field.
describe('Collection author-swap fields', () => {
    it('accepts the string, null and absent shapes the API sends', () => {
        const legacy: ILightCollection = {
            contract: 'atomicassets',
            collection_name: 'mycollection',
            name: 'My Collection',
            img: '',
            author: 'currentauthr',
            allow_notify: true,
            authorized_accounts: ['currentauthr'],
            notify_accounts: [],
            market_fee: 0,
            data: {},
            created_at_block: '421427220',
            created_at_time: '1786645150000'
        };

        const live: ILightCollection = {
            ...legacy, new_author_name: 'newauthor111', new_author_date: '1787249952000'
        };

        const settled: ILightCollection = {...legacy, new_author_name: null, new_author_date: null};

        expect([live.new_author_name, live.new_author_date]).to.deep.equal(['newauthor111', '1787249952000']);
        expect([settled.new_author_name, settled.new_author_date]).to.deep.equal([null, null]);
        expect([legacy.new_author_name, legacy.new_author_date]).to.deep.equal([undefined, undefined]);
    });
});

describe('Author swap window', () => {
    it('exports the contract acceptance window in seconds', () => {
        expect(AUTHOR_SWAP_TIME_DELTA).to.equal(604800);
        expect(AUTHOR_SWAP_TIME_DELTA).to.equal(7 * 24 * 60 * 60);
    });
});
