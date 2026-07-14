import { expect } from 'chai';

import { AtomicHubNetwork, NETWORK_ENDPOINTS, explorerApiForNetwork, rpcApiForNetwork, ExplorerApi, RpcApi } from '../src';

const NETWORKS: Array<{network: AtomicHubNetwork, host: string}> = [
    {network: 'wax', host: 'wax'},
    {network: 'wax-testnet', host: 'test.wax'},
    {network: 'vaulta', host: 'vaulta'},
    {network: 'xpr', host: 'xpr'},
    {network: 'xpr-testnet', host: 'test.xpr'},
    {network: 'jungle4', host: 'jungle4'}
];

// fetch stub so constructing clients never touches the network
const fetchStub = async (): Promise<any> => ({status: 200, json: async () => ({rows: [{}]})});

describe('Network endpoint presets', () => {
    it('covers every network with https endpoints on the public atomicassets.io host pattern', () => {
        expect(Object.keys(NETWORK_ENDPOINTS)).to.have.members(NETWORKS.map(n => n.network));

        for (const {network, host} of NETWORKS) {
            // one host per network serves both the API layer and chain RPC
            expect(NETWORK_ENDPOINTS[network].api).to.equal(`https://${host}.api.atomicassets.io`);
            expect(NETWORK_ENDPOINTS[network].rpc).to.equal(`https://${host}.api.atomicassets.io`);
        }
    });

    it('explorerApiForNetwork wires the client to the network api endpoint', () => {
        for (const {network} of NETWORKS) {
            const api = explorerApiForNetwork(network, {fetch: fetchStub as any});

            expect(api).to.be.instanceOf(ExplorerApi);
            expect((api as any).endpoint).to.equal(NETWORK_ENDPOINTS[network].api);
            expect((api as any).namespace).to.equal('atomicassets');
        }
    });

    it('rpcApiForNetwork wires the client to the network rpc endpoint', () => {
        const rpc = rpcApiForNetwork('wax', 'atomicassets', {fetch: fetchStub as any});

        expect(rpc).to.be.instanceOf(RpcApi);
        expect(rpc.endpoint).to.equal(NETWORK_ENDPOINTS['wax'].rpc);
        expect(rpc.contract).to.equal('atomicassets');
    });

    it('rpcApiForNetwork defaults the contract to atomicassets', () => {
        const rpc = rpcApiForNetwork('jungle4', undefined, {fetch: fetchStub as any});

        expect(rpc.contract).to.equal('atomicassets');
        expect(rpc.endpoint).to.equal(NETWORK_ENDPOINTS['jungle4'].rpc);
    });
});
