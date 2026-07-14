import { expect } from 'chai';
import ExplorerApi from '../src/API/Explorer';

// hits a live third-party endpoint; opt in explicitly so the default suite stays hermetic
const describeLive = process.env.TEST_LIVE_API ? describe : describe.skip;

describeLive('Explorer API', () => {
    const api = new ExplorerApi('https://test.wax.api.atomicassets.io', 'atomicassets', {});

    const exampleAsset = {
        owner: 'testuser2222',
        id: '1099511627784'
    };

    it('fetch asset ' + exampleAsset.id, async () => {
        const assets = await api.getAssets({
            owner: exampleAsset.owner
        });

        expect(assets).to.deep.equal(assets);
    }).timeout(10000);
});
