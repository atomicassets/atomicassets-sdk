import { expect } from 'chai';

import RpcApi from '../src/API/Rpc';

// hits a live third-party endpoint; opt in explicitly so the default suite stays hermetic
const describeLive = process.env.TEST_LIVE_API ? describe : describe.skip;

describeLive('RPC API', () => {
    const api = new RpcApi('https://wax.pink.gg', 'atomicassets', {
        rateLimit: 4
    });

    const exampleAsset = {
        owner: 'pink.gg',
        id: '1099511628276'
    };

    it('fetch asset ' + exampleAsset.id, async () => {
        const asset = await api.getAsset(exampleAsset.owner, exampleAsset.id);

        const result = await asset.toObject();
        expect(result).to.deep.equal(result);
    }).timeout(10000);

    it('test caching', async () => {
        const asset = await api.getAsset(exampleAsset.owner, exampleAsset.id);

        const result = await asset.toObject();

        expect(result).to.deep.equal(result);
    }).timeout(10000);

    it('fetch offers ', async () => {
        const offers = await api.getAccountOffers(exampleAsset.owner);

        const result = await Promise.all(offers.map(async (offer) => await offer.toObject()));

        expect(result).to.deep.equal(result);
    }).timeout(20000);

    it('fetch assets ', async () => {
        const assets = await api.getAccountAssets(exampleAsset.owner);

        const result = await Promise.all(assets.map(async (asset) => await asset.toObject()));

        expect(result).to.deep.equal(result);
    }).timeout(120000);

    it('fetch collection inventory ', async () => {
        const assets = await api.getCollectionInventory('gpk.topps', 'lc4l.wam');

        const result = await Promise.all(assets.map(asset => asset.toObject()));
        expect(result).to.deep.equal([]);
    }).timeout(120000);
});
