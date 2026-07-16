import { SchemaFormat } from '../API/Rpc/RpcCache';
import SerializationError from '../Errors/SerializationError';

export type EosioAuthorizationObject = { actor: string, permission: string };
export type EosioActionObject = {
    account: string,
    name: string,
    authorization: EosioAuthorizationObject[],
    data: any
};
// An action without authorization, as produced by the sync ActionBuilder.
// Signing pipelines that attach authorization late (or per-chain) consume
// this shape directly.
export type EosioSimpleAction = {
    account: string,
    name: string,
    data: any
};

// The on-chain pair_string_ATOMIC_ATTRIBUTE struct has exactly the fields
// key/value; action inputs are kept to this shape so a serializer-rejected
// entry cannot be passed.
export type AttributeMapEntry = { key: string, value: [string, any] };
export type AttributeMap = AttributeMapEntry[];

// v2 ABIs may serialize the attribute pair as {first, second} instead of the
// classic {key, value}; the decode side accepts both shapes so callers don't
// have to normalize before converting.
export type DecodedAttributeMap = Array<
    AttributeMapEntry | { first: string, second: [string, any] }
>;

// The createschema/extendschema on-chain ABI struct: name + type only. Kept
// deliberately narrow (NOT the codec's SchemaObject, which also carries
// parent/mediatype) so those v2-only fields cannot leak into createschema
// action data, where a strict ABI serializer would reject unknown keys.
export type Format = { name: string, type: string };

// One schema field's media-type hint carried by the v2 setschematyp action.
// Distinct from the base wire format: it targets the on-chain
// schema_format_type structure, not the serialization format.
export type SchemaFormatType = { name: string, mediatype: string, info?: string };

// Maps every schema-format type alias the codec understands to the
// ATOMIC_ATTRIBUTE variant name the contract stores. The alias set mirrors
// ParserTypes (plus []-suffixed vectors); the variant names are the ABI's
// ATTRIBUTE variant list, so an attribute built through this map matches the
// identity the chain records.
export const ATOMIC_ATTRIBUTE: { [type: string]: string } = {
    int8: 'int8',
    int16: 'int16',
    int32: 'int32',
    int64: 'int64',
    uint8: 'uint8',
    uint16: 'uint16',
    uint32: 'uint32',
    uint64: 'uint64',
    fixed8: 'uint8',
    fixed16: 'uint16',
    fixed32: 'uint32',
    fixed64: 'uint64',
    float: 'float32',
    double: 'float64',
    string: 'string',
    ipfs: 'string',
    image: 'string',
    bool: 'uint8',

    'int8[]': 'INT8_VEC',
    'int16[]': 'INT16_VEC',
    'int32[]': 'INT32_VEC',
    'int64[]': 'INT64_VEC',
    'uint8[]': 'UINT8_VEC',
    'uint16[]': 'UINT16_VEC',
    'uint32[]': 'UINT32_VEC',
    'uint64[]': 'UINT64_VEC',
    'fixed8[]': 'UINT8_VEC',
    'fixed16[]': 'UINT16_VEC',
    'fixed32[]': 'UINT32_VEC',
    'fixed64[]': 'UINT64_VEC',
    'float[]': 'FLOAT_VEC',
    'double[]': 'DOUBLE_VEC',
    'string[]': 'STRING_VEC',
    'image[]': 'STRING_VEC',
    'bool[]': 'INT8_VEC'
};

// Builds an AttributeMap from plain values plus a per-key type lookup,
// without requiring a full schema. Types are schema-format aliases
// (see ATOMIC_ATTRIBUTE); the emitted variant is the canonical ABI name.
export function createAttributeMap(
    obj: { [key: string]: any }, types: { [key: string]: string }
): AttributeMap {
    const result: AttributeMap = [];

    for (const key of Object.keys(obj)) {
        const type = types[key];

        if (typeof type === 'undefined') {
            throw new SerializationError('no type given for field \'' + key + '\'');
        }

        const variant = ATOMIC_ATTRIBUTE[type];

        if (typeof variant === 'undefined') {
            throw new SerializationError('invalid type \'' + type + '\' for field \'' + key + '\'');
        }

        result.push({key, value: [variant, obj[key]]});
    }

    return result;
}

// Sync, authorization-free builders: one method per contract action, each
// returning a single {account, name, data} object. ActionGenerator wraps
// these with authorization; signing pipelines that inject authorization
// themselves use the builder directly.
export class ActionBuilder {
    constructor(readonly contract: string) {
    }

    acceptauswap(collection_name: string): EosioSimpleAction {
        return this._action('acceptauswap', {collection_name});
    }

    acceptoffer(offer_id: string): EosioSimpleAction {
        return this._action('acceptoffer', {offer_id});
    }

    addcolauth(collection_name: string, account_to_add: string): EosioSimpleAction {
        return this._action('addcolauth', {collection_name, account_to_add});
    }

    addconftoken(token_contract: string, token_symbol: string): EosioSimpleAction {
        return this._action('addconftoken', {token_contract, token_symbol});
    }

    addnotifyacc(collection_name: string, account_to_add: string): EosioSimpleAction {
        return this._action('addnotifyacc', {collection_name, account_to_add});
    }

    admincoledit(collection_format_extension: Format[]): EosioSimpleAction {
        return this._action('admincoledit', {collection_format_extension});
    }

    announcedepo(owner: string, symbol_to_announce: string): EosioSimpleAction {
        return this._action('announcedepo', {owner, symbol_to_announce});
    }

    backasset(payer: string, asset_owner: string, asset_id: string, token_to_back: string): EosioSimpleAction {
        return this._action('backasset', {payer, asset_owner, asset_id, token_to_back});
    }

    burnasset(asset_owner: string, asset_id: string): EosioSimpleAction {
        return this._action('burnasset', {asset_owner, asset_id});
    }

    canceloffer(offer_id: string): EosioSimpleAction {
        return this._action('canceloffer', {offer_id});
    }

    createauswap(collection_name: string, new_author: string, owner: boolean): EosioSimpleAction {
        return this._action('createauswap', {collection_name, new_author, owner});
    }

    createcol(
        author: string, collection_name: string, allow_notify: boolean,
        authorized_accounts: string[], notify_accounts: string[], market_fee: number, data: AttributeMap
    ): EosioSimpleAction {
        return this._action('createcol', {
            author,
            collection_name,
            allow_notify,
            authorized_accounts,
            notify_accounts,
            market_fee,
            data
        });
    }

    createoffer(
        sender: string, recipient: string, sender_asset_ids: string[], recipient_asset_ids: string[], memo: string
    ): EosioSimpleAction {
        return this._action('createoffer', {sender, recipient, sender_asset_ids, recipient_asset_ids, memo});
    }

    createtempl(
        authorized_creator: string, collection_name: string, schema_name: string,
        transferable: boolean, burnable: boolean, max_supply: number, immutable_data: AttributeMap
    ): EosioSimpleAction {
        return this._action('createtempl', {
            authorized_creator, collection_name, schema_name, transferable, burnable, max_supply, immutable_data
        });
    }

    createtempl2(
        authorized_creator: string, collection_name: string, schema_name: string,
        transferable: boolean, burnable: boolean, max_supply: number, immutable_data: AttributeMap, mutable_data: AttributeMap
    ): EosioSimpleAction {
        return this._action('createtempl2', {
            authorized_creator, collection_name, schema_name, transferable, burnable, max_supply, immutable_data, mutable_data
        });
    }

    createschema(
        authorized_creator: string, collection_name: string, schema_name: string, schema_format: Format[]
    ): EosioSimpleAction {
        return this._action('createschema', {authorized_creator, collection_name, schema_name, schema_format});
    }

    declineoffer(offer_id: string): EosioSimpleAction {
        return this._action('declineoffer', {offer_id});
    }

    deltemplate(authorized_editor: string, collection_name: string, template_id: number): EosioSimpleAction {
        return this._action('deltemplate', {authorized_editor, collection_name, template_id});
    }

    extendschema(
        authorized_editor: string, collection_name: string, schema_name: string, schema_format_extension: Format[]
    ): EosioSimpleAction {
        return this._action('extendschema', {authorized_editor, collection_name, schema_name, schema_format_extension});
    }

    forbidnotify(collection_name: string): EosioSimpleAction {
        return this._action('forbidnotify', {collection_name});
    }

    init(): EosioSimpleAction {
        return this._action('init', {});
    }

    locktemplate(authorized_editor: string, collection_name: string, template_id: number): EosioSimpleAction {
        return this._action('locktemplate', {authorized_editor, collection_name, template_id});
    }

    mintasset(
        authorized_minter: string, collection_name: string, schema_name: string, template_id: number,
        new_asset_owner: string, immutable_data: AttributeMap, mutable_data: AttributeMap, tokens_to_back: string[]
    ): EosioSimpleAction {
        return this._action('mintasset', {
            authorized_minter, collection_name, schema_name, template_id, new_asset_owner, immutable_data, mutable_data, tokens_to_back
        });
    }

    payofferram(payer: string, offer_id: string): EosioSimpleAction {
        return this._action('payofferram', {payer, offer_id});
    }

    redtemplmax(
        authorized_editor: string, collection_name: string, template_id: number, new_max_supply: number
    ): EosioSimpleAction {
        return this._action('redtemplmax', {authorized_editor, collection_name, template_id, new_max_supply});
    }

    rejectauswap(collection_name: string): EosioSimpleAction {
        return this._action('rejectauswap', {collection_name});
    }

    remcolauth(collection_name: string, account_to_remove: string): EosioSimpleAction {
        return this._action('remcolauth', {collection_name, account_to_remove});
    }

    remnotifyacc(collection_name: string, account_to_remove: string): EosioSimpleAction {
        return this._action('remnotifyacc', {collection_name, account_to_remove});
    }

    setassetdata(
        authorized_editor: string, asset_owner: string, asset_id: string, new_mutable_data: AttributeMap
    ): EosioSimpleAction {
        return this._action('setassetdata', {authorized_editor, asset_owner, asset_id, new_mutable_data});
    }

    setcoldata(collection_name: string, data: AttributeMap): EosioSimpleAction {
        return this._action('setcoldata', {collection_name, data});
    }

    setlastpayer(owner: string, collection_name: string): EosioSimpleAction {
        return this._action('setlastpayer', {owner, collection_name});
    }

    setmarketfee(collection_name: string, market_fee: number): EosioSimpleAction {
        return this._action('setmarketfee', {collection_name, market_fee});
    }

    setrampayer(new_payer: string, asset_id: string): EosioSimpleAction {
        return this._action('setrampayer', {new_payer, asset_id});
    }

    settempldata(
        authorized_editor: string, collection_name: string, template_id: number, new_mutable_data: AttributeMap
    ): EosioSimpleAction {
        return this._action('settempldata', {authorized_editor, collection_name, template_id, new_mutable_data});
    }

    setschematyp(
        authorized_editor: string, collection_name: string, schema_name: string, schema_format_type: SchemaFormatType[]
    ): EosioSimpleAction {
        const normalized = schema_format_type.map(
            ({name, mediatype, info}) => ({name, mediatype, info: info ?? ''})
        );

        return this._action('setschematyp', {
            authorized_editor, collection_name, schema_name, schema_format_type: normalized
        });
    }

    setversion(new_version: string): EosioSimpleAction {
        return this._action('setversion', {new_version});
    }

    transfer(account_from: string, account_to: string, asset_ids: string[], memo: string): EosioSimpleAction {
        return this._action('transfer', {from: account_from, to: account_to, asset_ids, memo});
    }

    withdraw(owner: string, token_to_withdraw: string): EosioSimpleAction {
        return this._action('withdraw', {owner, token_to_withdraw});
    }

    protected _action(name: string, data: any): EosioSimpleAction {
        return {account: this.contract, name, data};
    }
}

export class ActionGenerator {
    protected readonly builder: ActionBuilder;

    constructor(readonly contract: string) {
        this.builder = new ActionBuilder(contract);
    }

    async acceptauswap(authorization: EosioAuthorizationObject[], collection_name: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.acceptauswap(collection_name));
    }

    async acceptoffer(authorization: EosioAuthorizationObject[], offer_id: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.acceptoffer(offer_id));
    }

    async addcolauth(authorization: EosioAuthorizationObject[], collection_name: string, account_to_add: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.addcolauth(collection_name, account_to_add));
    }

    async addconftoken(authorization: EosioAuthorizationObject[], token_contract: string, token_symbol: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.addconftoken(token_contract, token_symbol));
    }

    async addnotifyacc(authorization: EosioAuthorizationObject[], collection_name: string, account_to_add: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.addnotifyacc(collection_name, account_to_add));
    }

    async admincoledit(authorization: EosioAuthorizationObject[], collection_format_extension: Format[]): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.admincoledit(collection_format_extension));
    }

    async announcedepo(authorization: EosioAuthorizationObject[], owner: string, symbol_to_announce: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.announcedepo(owner, symbol_to_announce));
    }

    async backasset(
        authorization: EosioAuthorizationObject[], payer: string, asset_owner: string, asset_id: string, token_to_back: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.backasset(payer, asset_owner, asset_id, token_to_back));
    }

    async burnasset(authorization: EosioAuthorizationObject[], asset_owner: string, asset_id: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.burnasset(asset_owner, asset_id));
    }

    async canceloffer(authorization: EosioAuthorizationObject[], offer_id: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.canceloffer(offer_id));
    }

    async createauswap(
        authorization: EosioAuthorizationObject[], collection_name: string, new_author: string, owner: boolean
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.createauswap(collection_name, new_author, owner));
    }

    async createcol(
        authorization: EosioAuthorizationObject[], author: string, collection_name: string, allow_notify: boolean,
        authorized_accounts: string[], notify_accounts: string[], market_fee: number, data: AttributeMap
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.createcol(
            author, collection_name, allow_notify, authorized_accounts, notify_accounts, market_fee, data
        ));
    }

    async createoffer(
        authorization: EosioAuthorizationObject[], sender: string, recipient: string,
        sender_asset_ids: string[], recipient_asset_ids: string[], memo: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.createoffer(sender, recipient, sender_asset_ids, recipient_asset_ids, memo));
    }

    async createtempl(
        authorization: EosioAuthorizationObject[], authorized_creator: string, collection_name: string, schema_name: string,
        transferable: boolean, burnable: boolean, max_supply: number, immutable_data: AttributeMap
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.createtempl(
            authorized_creator, collection_name, schema_name, transferable, burnable, max_supply, immutable_data
        ));
    }

    async createtempl2(
        authorization: EosioAuthorizationObject[], authorized_creator: string, collection_name: string, schema_name: string,
        transferable: boolean, burnable: boolean, max_supply: number, immutable_data: AttributeMap, mutable_data: AttributeMap
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.createtempl2(
            authorized_creator, collection_name, schema_name, transferable, burnable, max_supply, immutable_data, mutable_data
        ));
    }

    async createschema(
        authorization: EosioAuthorizationObject[], authorized_creator: string,
        collection_name: string, schema_name: string, schema_format: Format[]
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.createschema(authorized_creator, collection_name, schema_name, schema_format));
    }

    async declineoffer(authorization: EosioAuthorizationObject[], offer_id: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.declineoffer(offer_id));
    }

    async deltemplate(
        authorization: EosioAuthorizationObject[], authorized_editor: string, collection_name: string, template_id: number
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.deltemplate(authorized_editor, collection_name, template_id));
    }

    async extendschema(
        authorization: EosioAuthorizationObject[], authorized_editor: string,
        collection_name: string, schema_name: string, schema_format_extension: Format[]
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.extendschema(
            authorized_editor, collection_name, schema_name, schema_format_extension
        ));
    }

    async forbidnotify(authorization: EosioAuthorizationObject[], collection_name: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.forbidnotify(collection_name));
    }

    async init(authorization: EosioAuthorizationObject[]): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.init());
    }

    async locktemplate(
        authorization: EosioAuthorizationObject[], authorized_editor: string, collection_name: string, template_id: number
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.locktemplate(authorized_editor, collection_name, template_id));
    }

    async mintasset(
        authorization: EosioAuthorizationObject[], authorized_minter: string, collection_name: string, schema_name: string, template_id: number,
        new_asset_owner: string, immutable_data: AttributeMap, mutable_data: AttributeMap, tokens_to_back: string[]
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.mintasset(
            authorized_minter, collection_name, schema_name, template_id, new_asset_owner, immutable_data, mutable_data, tokens_to_back
        ));
    }

    async payofferram(authorization: EosioAuthorizationObject[], payer: string, offer_id: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.payofferram(payer, offer_id));
    }

    async redtemplmax(
        authorization: EosioAuthorizationObject[], authorized_editor: string,
        collection_name: string, template_id: number, new_max_supply: number
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.redtemplmax(authorized_editor, collection_name, template_id, new_max_supply));
    }

    async rejectauswap(authorization: EosioAuthorizationObject[], collection_name: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.rejectauswap(collection_name));
    }

    async remcolauth(authorization: EosioAuthorizationObject[], collection_name: string, account_to_remove: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.remcolauth(collection_name, account_to_remove));
    }

    async remnotifyacc(authorization: EosioAuthorizationObject[], collection_name: string, account_to_remove: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.remnotifyacc(collection_name, account_to_remove));
    }

    async setassetdata(
        authorization: EosioAuthorizationObject[], authorized_editor: string,
        asset_owner: string, asset_id: string, new_mutable_data: AttributeMap
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setassetdata(authorized_editor, asset_owner, asset_id, new_mutable_data));
    }

    async setcoldata(authorization: EosioAuthorizationObject[], collection_name: string, data: AttributeMap): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setcoldata(collection_name, data));
    }

    async setlastpayer(authorization: EosioAuthorizationObject[], owner: string, collection_name: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setlastpayer(owner, collection_name));
    }

    async setmarketfee(authorization: EosioAuthorizationObject[], collection_name: string, market_fee: number): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setmarketfee(collection_name, market_fee));
    }

    async setrampayer(authorization: EosioAuthorizationObject[], new_payer: string, asset_id: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setrampayer(new_payer, asset_id));
    }

    async settempldata(
        authorization: EosioAuthorizationObject[], authorized_editor: string,
        collection_name: string, template_id: number, new_mutable_data: AttributeMap
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.settempldata(authorized_editor, collection_name, template_id, new_mutable_data));
    }

    async setschematyp(
        authorization: EosioAuthorizationObject[], authorized_editor: string,
        collection_name: string, schema_name: string, schema_format_type: SchemaFormatType[]
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setschematyp(
            authorized_editor, collection_name, schema_name, schema_format_type
        ));
    }

    async setversion(authorization: EosioAuthorizationObject[], new_version: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setversion(new_version));
    }

    async transfer(
        authorization: EosioAuthorizationObject[], account_from: string, account_to: string, asset_ids: string[], memo: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.transfer(account_from, account_to, asset_ids, memo));
    }

    async withdraw(authorization: EosioAuthorizationObject[], owner: string, token_to_withdraw: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.withdraw(owner, token_to_withdraw));
    }

    protected _authorize(authorization: EosioAuthorizationObject[], action: EosioSimpleAction): EosioActionObject[] {
        return [{account: action.account, name: action.name, authorization, data: action.data}];
    }

    protected _pack(authorization: EosioAuthorizationObject[], name: string, data: any): EosioActionObject[] {
        return [{account: this.contract, name, authorization, data}];
    }
}

export function toAttributeMap(obj: any, schema: SchemaFormat): AttributeMap {
    const types: { [id: string]: string } = {};
    const result: AttributeMap = [];

    for (const row of schema) {
        types[row.name] = row.type;
    }

    const keys = Object.keys(obj);
    for (const key of keys) {
        if (typeof types[key] === 'undefined') {
            throw new SerializationError('field not defined in schema');
        }

        result.push({key, value: [types[key], obj[key]]});
    }

    return result;
}

// Converts an on-chain AttributeMap (either entry shape) into a plain
// key/value object. uint64/int64 values are stringified to avoid precision
// loss; uint64/int64 vector values are stringified element-wise. Every other
// variant passes through as decoded (numbers, number arrays, strings).
export function convertAttributeMapToObject(data: DecodedAttributeMap): { [key: string]: any } {
    const result: { [key: string]: any } = {};

    for (const row of data) {
        const key = 'key' in row ? row.key : row.first;
        const value = 'value' in row ? row.value : row.second;

        // key is an attacker-controlled on-chain attribute name; use defineProperty so a
        // key named e.g. __proto__ or constructor sets an own property instead of
        // invoking a prototype setter.
        if (['uint64', 'int64'].indexOf(value[0]) >= 0) {
            Object.defineProperty(result, key, { value: String(value[1]), enumerable: true, writable: true, configurable: true });
        } else if (['INT64_VEC', 'UINT64_VEC'].indexOf(value[0]) >= 0) {
            Object.defineProperty(result, key, {
                value: (value[1] as number[]).map((entry) => String(entry)),
                enumerable: true,
                writable: true,
                configurable: true,
            });
        } else {
            Object.defineProperty(result, key, { value: value[1], enumerable: true, writable: true, configurable: true });
        }
    }

    return result;
}
