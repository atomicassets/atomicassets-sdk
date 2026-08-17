import { expect } from 'chai';

import ExplorerApi from '../src/API/Explorer';

// Stubbed-fetch coverage of the request target the Explorer client builds.
// Ids, names and data-option keys arrive from the caller, so each one has to
// stay inside the path segment or query parameter it was put in no matter what
// characters it carries. The stub records the exact final URL; no network
// involved.

type FetchCall = { url: string, init?: any };

function mockApi(calls: FetchCall[], data: any = {}): ExplorerApi {
    const fetchMock = async (input: any, init?: any): Promise<any> => {
        calls.push({url: String(input), init});

        return {status: 200, json: async () => ({success: true, data})};
    };

    return new ExplorerApi('https://test.api', 'atomicassets', {fetch: fetchMock as any});
}

describe('Explorer API URL construction', () => {
    it('a benign id passes through the path unchanged', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(calls);

        await api.getAsset('1099511627784');

        expect(calls[0].url).to.equal('https://test.api/atomicassets/v1/assets/1099511627784');
    });

    it('benign two-segment lookups keep both names unchanged', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(calls);

        await api.getSchema('mycollection', 'myschema');
        await api.getAccountCollection('testuser2222', 'mycollection');

        expect(calls[0].url).to.equal('https://test.api/atomicassets/v1/schemas/mycollection/myschema');
        expect(calls[1].url).to.equal('https://test.api/atomicassets/v1/accounts/testuser2222/mycollection');
    });

    it('a hostile id cannot escape its own path segment', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(calls);

        await api.getAssetStats('1/2 ?&#x');

        expect(calls[0].url).to.equal('https://test.api/atomicassets/v1/assets/1%2F2%20%3F%26%23x/stats');
    });

    it('hostile names in a two-segment lookup are encoded segment by segment', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(calls, []);

        await api.getSchemaLogs('1/2 ?&#x', 'a/b#c');

        expect(calls[0].url).to.equal(
            'https://test.api/atomicassets/v1/schemas/1%2F2%20%3F%26%23x/a%2Fb%23c/logs?page=1&limit=100&order=desc'
        );
    });

    it('a data option key cannot smuggle extra query parameters', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(calls, []);

        await api.getAssets({}, 1, 100, [{key: 'rarity', value: 'rare'}]);
        await api.getAssets({}, 1, 100, [{key: 'rarity&admin=1', value: 'rare'}]);

        // The readable common case survives the encoding: `.` is unreserved.
        expect(calls[0].url).to.equal('https://test.api/atomicassets/v1/assets?page=1&limit=100&data.rarity=rare');
        expect(calls[1].url).to.equal('https://test.api/atomicassets/v1/assets?page=1&limit=100&data.rarity%26admin%3D1=rare');
    });

    it('the POST fallback past 1000 query characters encodes the path too', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(calls);

        // Long enough that fetchEndpoint drops the query string and moves the
        // arguments into a POST body, which is the branch that builds the URL
        // a second time.
        const whitelist = 'somecollect,'.repeat(100);

        await api.getAccount('1/2 ?&#x', {collection_whitelist: whitelist});

        expect(calls[0].url).to.equal('https://test.api/atomicassets/v1/accounts/1%2F2%20%3F%26%23x');
        expect(calls[0].init.method).to.equal('POST');
        expect(JSON.parse(calls[0].init.body)).to.deep.equal({collection_whitelist: whitelist});
    });
});

// Returns the error a call rejects with, or undefined when it resolves. The
// guard has to fire inside the path builder, so a passing case here never
// reaches the fetch stub.
async function rejection(call: () => Promise<unknown>): Promise<Error | undefined> {
    try {
        await call();
    } catch (e: any) {
        return e;
    }

    return undefined;
}

describe('Explorer API path segment guard', () => {
    it('an empty id or a dot segment rejects and sends nothing', async () => {
        for (const id of ['', '.', '..']) {
            const calls: FetchCall[] = [];
            const api = mockApi(calls);

            const error = await rejection(() => api.getAsset(id));

            expect(error, id).to.be.instanceOf(Error);
            expect(String(error?.message), id).to.contain('asset id');
            expect(String(error?.message), id).to.contain('is not a valid path segment');
            expect(String(error?.message), id).to.contain(JSON.stringify(id));
            expect(calls.length, id).to.equal(0);
        }
    });

    it('a missing id rejects and sends nothing', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(calls);

        for (const value of [undefined, null]) {
            const error = await rejection(() => api.getAsset(value as unknown as string));
            expect(error).to.be.instanceOf(Error);
            expect(String(error?.message)).to.equal('asset id is required');
        }

        expect(calls.length).to.equal(0);
    });

    it('a dotted name is not a dot segment and reaches the request unchanged', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(calls);

        await api.getAccount('mycoll.wam');
        await api.getCollection('alice.gg');

        expect(calls[0].url).to.equal('https://test.api/atomicassets/v1/accounts/mycoll.wam');
        expect(calls[1].url).to.equal('https://test.api/atomicassets/v1/collections/alice.gg');
    });

    it('every caller-supplied path segment is guarded', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(calls, []);

        // One entry per caller-supplied segment, hand-maintained: a method
        // added later needs its own entries here, and a listed argument
        // position that skips the guard fails.
        const segments: Array<[string, () => Promise<unknown>]> = [
            ['getAsset id', () => api.getAsset('..')],
            ['getAssetStats id', () => api.getAssetStats('..')],
            ['getAssetLogs id', () => api.getAssetLogs('..')],
            ['getCollection name', () => api.getCollection('..')],
            ['getCollectionStats name', () => api.getCollectionStats('..')],
            ['getCollectionLogs name', () => api.getCollectionLogs('..')],
            ['getSchema collection', () => api.getSchema('..', 'myschema')],
            ['getSchema name', () => api.getSchema('mycollection', '..')],
            ['getSchemaStats collection', () => api.getSchemaStats('..', 'myschema')],
            ['getSchemaStats name', () => api.getSchemaStats('mycollection', '..')],
            ['getSchemaLogs collection', () => api.getSchemaLogs('..', 'myschema')],
            ['getSchemaLogs name', () => api.getSchemaLogs('mycollection', '..')],
            ['getTemplate collection', () => api.getTemplate('..', '1')],
            ['getTemplate id', () => api.getTemplate('mycollection', '..')],
            ['getTemplateStats collection', () => api.getTemplateStats('..', '1')],
            ['getTemplateStats id', () => api.getTemplateStats('mycollection', '..')],
            ['getTemplateLogs collection', () => api.getTemplateLogs('..', '1')],
            ['getTemplateLogs id', () => api.getTemplateLogs('mycollection', '..')],
            ['getOffer id', () => api.getOffer('..')],
            ['getAccount account', () => api.getAccount('..')],
            ['getAccountCollection account', () => api.getAccountCollection('..', 'mycollection')],
            ['getAccountCollection collection', () => api.getAccountCollection('testuser2222', '..')],
            ['getAccountBurns account', () => api.getAccountBurns('..')]
        ];

        for (const [name, call] of segments) {
            const error = await rejection(call);

            expect(error, name).to.be.instanceOf(Error);
            expect(String(error?.message), name).to.contain('is not a valid path segment');
        }

        expect(calls.length).to.equal(0);
    });
});
