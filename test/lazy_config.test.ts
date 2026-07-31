import { expect } from 'chai';

import ExplorerApi from '../src/API/Explorer';
import RpcApi from '../src/API/Rpc';
import ExplorerActionGenerator from '../src/Actions/Explorer';

// Stubbed-fetch coverage of the lazy config fetch: constructing a client must
// issue no network I/O, concurrent uses must share one in-flight fetch, a
// failed fetch must not stick to the instance, and an unawaited access must
// not raise unhandledRejection. No network involved.

const rpcConfigRow = {asset_counter: '0', offer_counter: '0', collection_format: []};

function explorerConfigResponse(): any {
    return {
        status: 200,
        json: async () => ({success: true, data: {contract: 'atomicassets', collection_format: []}})
    };
}

function rpcConfigResponse(): any {
    return {
        ok: true,
        json: async () => ({rows: [rpcConfigRow], more: false})
    };
}

// unhandledRejection fires on a later event-loop turn than the rejection
// itself; two setImmediate hops leave room for it and the microtasks between.
async function flushPendingRejections(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
}

// Scopes an unhandledRejection listener to the sentinel a test's own stubbed
// fetch injects, so a rejection some unrelated async work leaks into the same
// setImmediate window cannot fail the assertion. The reason may be the
// injected Error itself, or a wrapper (ApiError) that carries its message
// forward without preserving identity.
function isInjectedFailure(reason: unknown, injected: Error): boolean {
    return reason === injected || (reason instanceof Error && reason.message === injected.message);
}

describe('Explorer API lazy config', () => {
    it('constructing the client issues no fetch', () => {
        let calls = 0;
        const fetch = async (): Promise<any> => {
            calls++;

            return explorerConfigResponse();
        };

        new ExplorerApi('http://localhost', 'atomicassets', {fetch: fetch as any});

        expect(calls).to.equal(0);
    });

    it('concurrent action accesses share one in-flight config fetch', async () => {
        let calls = 0;
        const fetch = async (): Promise<any> => {
            calls++;

            return explorerConfigResponse();
        };

        const api = new ExplorerApi('http://localhost', 'atomicassets', {fetch: fetch as any});

        const [first, second] = await Promise.all([api.action, api.action]);

        expect(first).to.equal(second);
        expect(calls).to.equal(1);
    });

    it('a failed config fetch rejects the access and the next access retries', async () => {
        let calls = 0;
        const fetch = async (): Promise<any> => {
            calls++;

            if (calls === 1) {
                throw new Error('api outage');
            }

            return explorerConfigResponse();
        };

        const api = new ExplorerApi('http://localhost', 'atomicassets', {fetch: fetch as any});

        let rejected = false;

        try {
            await api.action;
        } catch {
            rejected = true;
        }

        expect(rejected).to.equal(true);
        expect(calls).to.equal(1);

        const generator = await api.action;

        expect(generator).to.be.an('object');
        expect(calls).to.equal(2);
    });

    it('an unawaited action access with a failing fetch raises no unhandledRejection', async () => {
        const injectedError = new Error('api outage');
        const seen: unknown[] = [];
        const listener = (reason: unknown): void => {
            if (isInjectedFailure(reason, injectedError)) {
                seen.push(reason);
            }
        };

        process.on('unhandledRejection', listener);

        try {
            const fetch = async (): Promise<any> => {
                throw injectedError;
            };

            const api = new ExplorerApi('http://localhost', 'atomicassets', {fetch: fetch as any});

            expect(api.action).to.be.a('promise');

            await flushPendingRejections();

            expect(seen).to.deep.equal([]);
        } finally {
            process.removeListener('unhandledRejection', listener);
        }
    });
});

describe('Explorer action generator lazy config', () => {
    it('constructing the generator issues no fetch', () => {
        let calls = 0;
        const fetch = async (): Promise<any> => {
            calls++;

            return explorerConfigResponse();
        };

        const api = new ExplorerApi('http://localhost', 'atomicassets', {fetch: fetch as any});

        new ExplorerActionGenerator('atomicassets', api);

        expect(calls).to.equal(0);
    });

    it('an unawaited config use with a failing fetch raises no unhandledRejection', async () => {
        const injectedError = new Error('api outage');
        const seen: unknown[] = [];
        const listener = (reason: unknown): void => {
            if (isInjectedFailure(reason, injectedError)) {
                seen.push(reason);
            }
        };

        process.on('unhandledRejection', listener);

        try {
            const fetch = async (): Promise<any> => {
                throw injectedError;
            };

            const api = new ExplorerApi('http://localhost', 'atomicassets', {fetch: fetch as any});
            const generator = new ExplorerActionGenerator('atomicassets', api);

            // The accessor is private; reach it directly so nothing downstream
            // attaches a handler of its own.
            expect((generator as any).config).to.be.a('promise');

            await flushPendingRejections();

            expect(seen).to.deep.equal([]);
        } finally {
            process.removeListener('unhandledRejection', listener);
        }
    });

    it('a failed config fetch rejects the use and the next use retries', async () => {
        let calls = 0;
        const fetch = async (): Promise<any> => {
            calls++;

            if (calls === 1) {
                throw new Error('api outage');
            }

            return explorerConfigResponse();
        };

        const api = new ExplorerApi('http://localhost', 'atomicassets', {fetch: fetch as any});
        const generator = new ExplorerActionGenerator('atomicassets', api);

        let rejected = false;

        try {
            await generator.createcol([], 'authoracct', 'mycollection', true, [], [], 0.05, {});
        } catch {
            rejected = true;
        }

        expect(rejected).to.equal(true);
        expect(calls).to.equal(1);

        const actions = await generator.createcol([], 'authoracct', 'mycollection', true, [], [], 0.05, {});

        expect(actions).to.be.an('array');
        expect(calls).to.equal(2);
    });
});

describe('RPC API lazy config', () => {
    it('constructing the client issues no fetch and cannot reject unhandled', async () => {
        const injectedError = new Error('api outage');
        const seen: unknown[] = [];
        const listener = (reason: unknown): void => {
            if (isInjectedFailure(reason, injectedError)) {
                seen.push(reason);
            }
        };

        process.on('unhandledRejection', listener);

        try {
            let calls = 0;
            const fetch = async (): Promise<any> => {
                calls++;

                throw injectedError;
            };

            new RpcApi('http://localhost', 'atomicassets', {fetch: fetch as any, rateLimit: 64});

            await flushPendingRejections();

            expect(calls).to.equal(0);
            expect(seen).to.deep.equal([]);
        } finally {
            process.removeListener('unhandledRejection', listener);
        }
    });

    it('concurrent config() calls share one lazy fetch', async () => {
        let calls = 0;
        const fetch = async (): Promise<any> => {
            calls++;

            return rpcConfigResponse();
        };

        const api = new RpcApi('http://localhost', 'atomicassets', {fetch: fetch as any, rateLimit: 64});

        const [first, second] = await Promise.all([api.config(), api.config()]);

        expect(first).to.deep.equal(rpcConfigRow);
        expect(second).to.equal(first);
        expect(calls).to.equal(1);
    });

    it('a failed config fetch keeps its rejection value and the next call retries', async () => {
        let calls = 0;
        const fetch = async (): Promise<any> => {
            calls++;

            if (calls === 1) {
                return {ok: true, json: async () => ({rows: [], more: false})};
            }

            return rpcConfigResponse();
        };

        const api = new RpcApi('http://localhost', 'atomicassets', {fetch: fetch as any, rateLimit: 64});

        let rejection: unknown;

        try {
            await api.config();
        } catch (e) {
            rejection = e;
        }

        // The empty table rejects with the literal string the class has always
        // used, not an Error wrapper.
        expect(rejection).to.equal('invalid config');
        expect(calls).to.equal(1);

        const row = await api.config();

        expect(row).to.deep.equal(rpcConfigRow);
        expect(calls).to.equal(2);
    });
});
