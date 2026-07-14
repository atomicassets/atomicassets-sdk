import { AttributeMap, DecodedAttributeMap, Format, SchemaFormatType } from '../Actions/Generator';

// Data payload of every atomicassets contract action (v1 plus v2), straight
// from the contract ABI. Write-action attribute maps use the strict
// {key, value} entry shape the serializer accepts; log-notification payloads
// use the decode-tolerant shape since they are read back from chain history.

// action `acceptauswap`
export type AcceptAuSwapActionData = {
    collection_name: string;
};

// action `acceptoffer`
export type AcceptOfferActionData = {
    offer_id: string;
};

// action `addcolauth`
export type AddColAuthActionData = {
    collection_name: string;
    account_to_add: string;
};

// action `addconftoken`
export type AddConfTokenActionData = {
    token_contract: string;
    token_symbol: string;
};

// action `addnotifyacc`
export type AddNotifyAccActionData = {
    collection_name: string;
    account_to_add: string;
};

// action `admincoledit`
export type AdminColEditActionData = {
    collection_format_extension: Format[];
};

// action `announcedepo`
export type AnnounceDepoActionData = {
    owner: string;
    symbol_to_announce: string;
};

// action `backasset`
export type BackAssetActionData = {
    payer: string;
    asset_owner: string;
    asset_id: string;
    token_to_back: string;
};

// action `burnasset`
export type BurnAssetActionData = {
    asset_owner: string;
    asset_id: string;
};

// action `canceloffer`
export type CancelOfferActionData = {
    offer_id: string;
};

// action `createauswap`
export type CreateAuSwapActionData = {
    collection_name: string;
    new_author: string;
    owner: boolean;
};

// action `createcol`
export type CreateColActionData = {
    author: string;
    collection_name: string;
    allow_notify: boolean;
    authorized_accounts: string[];
    notify_accounts: string[];
    market_fee: number;
    data: AttributeMap;
};

// action `createoffer`
export type CreateOfferActionData = {
    sender: string;
    recipient: string;
    sender_asset_ids: string[];
    recipient_asset_ids: string[];
    memo: string;
};

// action `createschema`
export type CreateSchemaActionData = {
    authorized_creator: string;
    collection_name: string;
    schema_name: string;
    schema_format: Format[];
};

// action `createtempl`
export type CreateTemplActionData = {
    authorized_creator: string;
    collection_name: string;
    schema_name: string;
    transferable: boolean;
    burnable: boolean;
    max_supply: number;
    immutable_data: AttributeMap;
};

// action `createtempl2`
export type CreateTempl2ActionData = {
    authorized_creator: string;
    collection_name: string;
    schema_name: string;
    transferable: boolean;
    burnable: boolean;
    max_supply: number;
    immutable_data: AttributeMap;
    mutable_data: AttributeMap;
};

// action `declineoffer`
export type DeclineOfferActionData = {
    offer_id: string;
};

// action `deltemplate`
export type DelTemplateActionData = {
    authorized_editor: string;
    collection_name: string;
    template_id: number;
};

// action `extendschema`
export type ExtendSchemaActionData = {
    authorized_editor: string;
    collection_name: string;
    schema_name: string;
    schema_format_extension: Format[];
};

// action `forbidnotify`
export type ForbidNotifyActionData = {
    collection_name: string;
};

// action `init`
export type InitActionData = Record<string, never>;

// action `locktemplate`
export type LockTemplateActionData = {
    authorized_editor: string;
    collection_name: string;
    template_id: number;
};

// action `logbackasset`
export type LogBackAssetActionData = {
    asset_owner: string;
    asset_id: string;
    backed_token: string;
};

// action `logburnasset`
export type LogBurnAssetActionData = {
    asset_owner: string;
    asset_id: string;
    collection_name: string;
    schema_name: string;
    template_id: number;
    backed_tokens: string[];
    old_immutable_data: DecodedAttributeMap;
    old_mutable_data: DecodedAttributeMap;
    asset_ram_payer: string;
};

// action `logmint`
export type LogMintActionData = {
    asset_id: string;
    authorized_minter: string;
    collection_name: string;
    schema_name: string;
    template_id: number;
    new_asset_owner: string;
    immutable_data: DecodedAttributeMap;
    mutable_data: DecodedAttributeMap;
    backed_tokens: string[];
    immutable_template_data: DecodedAttributeMap;
};

// action `lognewoffer`
export type LogNewOfferActionData = {
    offer_id: string;
    sender: string;
    recipient: string;
    sender_asset_ids: string[];
    recipient_asset_ids: string[];
    memo: string;
};

// action `lognewtempl`
export type LogNewTemplActionData = {
    template_id: number;
    authorized_creator: string;
    collection_name: string;
    schema_name: string;
    transferable: boolean;
    burnable: boolean;
    max_supply: number;
    immutable_data: DecodedAttributeMap;
};

// action `logrampayer`
export type LogRamPayerActionData = {
    asset_owner: string;
    asset_id: string;
    old_ram_payer: string;
    new_ram_payer: string;
};

// action `logsetdata`
export type LogSetDataActionData = {
    asset_owner: string;
    asset_id: string;
    old_data: DecodedAttributeMap;
    new_data: DecodedAttributeMap;
};

// action `logsetdatatl`
export type LogSetDataTlActionData = {
    collection_name: string;
    schema_name: string;
    template_id: number;
    old_data: DecodedAttributeMap;
    new_data: DecodedAttributeMap;
};

// action `logtransfer`
export type LogTransferActionData = {
    collection_name: string;
    from: string;
    to: string;
    asset_ids: string[];
    memo: string;
};

// action `mintasset`
export type MintAssetActionData = {
    authorized_minter: string;
    collection_name: string;
    schema_name: string;
    template_id: number;
    new_asset_owner: string;
    immutable_data: AttributeMap;
    mutable_data: AttributeMap;
    tokens_to_back: string[];
};

// action `payofferram`
export type PayOfferRamActionData = {
    payer: string;
    offer_id: string;
};

// action `redtemplmax`
export type RedTemplMaxActionData = {
    authorized_editor: string;
    collection_name: string;
    template_id: number;
    new_max_supply: number;
};

// action `rejectauswap`
export type RejectAuSwapActionData = {
    collection_name: string;
};

// action `remcolauth`
export type RemColAuthActionData = {
    collection_name: string;
    account_to_remove: string;
};

// action `remnotifyacc`
export type RemNotifyAccActionData = {
    collection_name: string;
    account_to_remove: string;
};

// action `setassetdata`
export type SetAssetDataActionData = {
    authorized_editor: string;
    asset_owner: string;
    asset_id: string;
    new_mutable_data: AttributeMap;
};

// action `setcoldata`
export type SetColDataActionData = {
    collection_name: string;
    data: AttributeMap;
};

// action `setlastpayer`
export type SetLastPayerActionData = {
    owner: string;
    collection_name: string;
};

// action `setmarketfee`
export type SetMarketFeeActionData = {
    collection_name: string;
    market_fee: number;
};

// action `setrampayer`
export type SetRamPayerActionData = {
    new_payer: string;
    asset_id: string;
};

// action `setschematyp`
export type SetSchemaTypActionData = {
    authorized_editor: string;
    collection_name: string;
    schema_name: string;
    schema_format_type: SchemaFormatType[];
};

// action `settempldata`
export type SetTemplDataActionData = {
    authorized_editor: string;
    collection_name: string;
    template_id: number;
    new_mutable_data: AttributeMap;
};

// action `setversion`
export type SetVersionActionData = {
    new_version: string;
};

// action `transfer`
export type TransferActionData = {
    from: string;
    to: string;
    asset_ids: string[];
    memo: string;
};

// action `withdraw`
export type WithdrawActionData = {
    owner: string;
    token_to_withdraw: string;
};
