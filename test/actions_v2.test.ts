import { expect } from 'chai';

import { ActionGenerator, AttributeMap, EosioAuthorizationObject } from '../src';

describe('Assets v2 Action Helpers', () => {
    const contract = 'atomicassets';
    const generator = new ActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];

    const immutable_data: AttributeMap = [{key: 'name', value: ['string', 'Founder Card']}];
    const mutable_data: AttributeMap = [{key: 'level', value: ['uint64', '1']}];

    it('createtempl2 emits the correct on-chain shape', async () => {
        const actions = await generator.createtempl2(
            authorization, 'creator', 'mycollection', 'myschema',
            true, false, 1000, immutable_data, mutable_data
        );

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'createtempl2',
            authorization,
            data: {
                authorized_creator: 'creator',
                collection_name: 'mycollection',
                schema_name: 'myschema',
                transferable: true,
                burnable: false,
                max_supply: 1000,
                immutable_data,
                mutable_data
            }
        }]);
    });

    it('settempldata emits new_mutable_data under editor/collection/template', async () => {
        const new_mutable_data: AttributeMap = [{key: 'level', value: ['uint64', '5']}];

        const actions = await generator.settempldata(
            authorization, 'editor', 'mycollection', 42, new_mutable_data
        );

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'settempldata',
            authorization,
            data: {
                authorized_editor: 'editor',
                collection_name: 'mycollection',
                template_id: 42,
                new_mutable_data
            }
        }]);
    });

    it('setschematyp normalizes schema_format_type entries', async () => {
        const actions = await generator.setschematyp(
            authorization, 'editor', 'mycollection', 'myschema',
            [
                {name: 'img', mediatype: 'image/png', info: 'cover'},
                {name: 'video', mediatype: 'video/mp4'}
            ]
        );

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'setschematyp',
            authorization,
            data: {
                authorized_editor: 'editor',
                collection_name: 'mycollection',
                schema_name: 'myschema',
                schema_format_type: [
                    {name: 'img', mediatype: 'image/png', info: 'cover'},
                    {name: 'video', mediatype: 'video/mp4', info: ''}
                ]
            }
        }]);
    });

    it('setschematyp defaults info to empty string when omitted', async () => {
        const [action] = await generator.setschematyp(
            authorization, 'editor', 'mycollection', 'myschema',
            [{name: 'audio', mediatype: 'audio/mpeg'}]
        );

        expect(action.data.schema_format_type[0].info).to.equal('');
    });

    it('deltemplate emits editor/collection/template', async () => {
        const actions = await generator.deltemplate(authorization, 'editor', 'mycollection', 42);

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'deltemplate',
            authorization,
            data: {authorized_editor: 'editor', collection_name: 'mycollection', template_id: 42}
        }]);
    });

    it('redtemplmax emits the new max supply', async () => {
        const actions = await generator.redtemplmax(authorization, 'editor', 'mycollection', 42, 500);

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'redtemplmax',
            authorization,
            data: {authorized_editor: 'editor', collection_name: 'mycollection', template_id: 42, new_max_supply: 500}
        }]);
    });

    it('createauswap emits collection/new_author/owner', async () => {
        const actions = await generator.createauswap(authorization, 'mycollection', 'newauthor', true);

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'createauswap',
            authorization,
            data: {collection_name: 'mycollection', new_author: 'newauthor', owner: true}
        }]);
    });

    it('acceptauswap emits the collection name', async () => {
        const actions = await generator.acceptauswap(authorization, 'mycollection');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'acceptauswap',
            authorization,
            data: {collection_name: 'mycollection'}
        }]);
    });

    it('rejectauswap emits the collection name', async () => {
        const actions = await generator.rejectauswap(authorization, 'mycollection');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'rejectauswap',
            authorization,
            data: {collection_name: 'mycollection'}
        }]);
    });

    it('setrampayer emits new payer and stringified asset id', async () => {
        const actions = await generator.setrampayer(authorization, 'newpayer', '1099511627776');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'setrampayer',
            authorization,
            data: {new_payer: 'newpayer', asset_id: '1099511627776'}
        }]);
    });

    it('setlastpayer emits owner and collection', async () => {
        const actions = await generator.setlastpayer(authorization, 'assetowner', 'mycollection');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'setlastpayer',
            authorization,
            data: {owner: 'assetowner', collection_name: 'mycollection'}
        }]);
    });
});
