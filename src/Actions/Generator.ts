import type { SchemaFormat } from '../API/Rpc/RpcCache';
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

// Some ABIs spell the attribute pair {first, second} rather than {key, value}.
// That is a toolchain artifact, not a contract version: the
// pair_string_ATOMIC_ATTRIBUTE struct is key/value in both the v1 mainnet ABI
// and the v2 release ABI. CDT 4.1 and newer emit the C++ member names
// first/second from abigen, and the contract's release build patches them back
// before the ABI ships. An ABI taken from an unpatched build of any version
// hands back the other spelling, so the decode side accepts both and callers
// do not have to normalize before converting.
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

// Bounds for the two integer widths the v2 ABI gives these builders' numeric
// fields. They are the ABI types' own ranges and nothing more: what the
// contract additionally rejects (which market_fee a collection may charge,
// what a given max_supply means for an existing template) belongs to the
// chain, which returns a legible error, and a redeploy may move it.
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const UINT32_MAX = 4294967295;

// The numeric parameters are the one place a bad value neither throws nor
// survives the trip. Action data reaches a signing library as JSON, and NaN and
// Infinity have no JSON form, so `max_supply: NaN` is written as
// `"max_supply": null` and the caller's mistake is gone before anything on
// chain can name it. A fractional or negative value for an integer field is the
// quieter version of the same problem: it serializes intact and is only caught,
// if at all, in a chain error that names neither the builder call nor the
// field. These guards throw at the call that produced the value.
function assertFinite(value: number, field: string): void {
    if (!Number.isFinite(value)) {
        throw new SerializationError(`${field} ${String(value)} is not a finite number`);
    }
}

function assertInt32(value: number, field: string): void {
    if (!Number.isInteger(value) || value < INT32_MIN || value > INT32_MAX) {
        throw new SerializationError(
            `${field} ${String(value)} is not an int32 (an integer ${INT32_MIN} to ${INT32_MAX})`
        );
    }
}

function assertUint32(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
        throw new SerializationError(
            `${field} ${String(value)} is not a uint32 (an integer 0 to ${UINT32_MAX})`
        );
    }
}

// Sync, authorization-free builders: one method per contract action, each
// returning a single {account, name, data} object. ActionGenerator wraps
// these with authorization; signing pipelines that inject authorization
// themselves use the builder directly.
//
// Every method is otherwise a pass-through, and deliberately so; the numeric
// guards above are the only checking that happens here. Names, symbols, and
// 64-bit ids stay unchecked because the chain rejects a malformed one with an
// error that says so.
//
// The method set is the AtomicAssets v2 action set, which is what this package
// targets and what the chains are migrating to. v2 is a superset of v1, so the
// actions v1 already had are spelled identically and need no thought; the
// difference only shows up where v2 added an action or retired a behavior, and
// those methods are marked below.
//
// The migration is in progress, so a chain the caller targets may not have
// arrived yet. Read the version from the contract's own `tokenconfigs` table
// to know which surface a chain is on: the wax and jungle4 testnets serve v2
// and its 47 actions, while the mainnets are still on v1's 35 (wax and eos
// report 1.2.3, xpr 1.3.1). Of the networks Networks.ts ships endpoints for,
// that puts wax-testnet and jungle4 on v2 and wax, vaulta, xpr and xpr-testnet
// on v1 until they migrate.
//
// Two kinds of marker follow from that. A "v2-only" method builds one of the
// actions v2 introduced; a chain that has not migrated has no such action and
// rejects the transaction as unknown. Native token backing is the reverse case
// and is deprecated rather than added: v2 disables it, and it still executes
// on a chain that has not migrated yet. That is noted on `backasset` and on
// `mintasset`'s tokens_to_back.
export class ActionBuilder {
    constructor(readonly contract: string) {
    }

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    acceptauswap(collection_name: string): EosioSimpleAction {
        return this._action('acceptauswap', {collection_name});
    }

    acceptoffer(offer_id: string): EosioSimpleAction {
        return this._action('acceptoffer', {offer_id});
    }

    addcolauth(collection_name: string, account_to_add: string): EosioSimpleAction {
        return this._action('addcolauth', {collection_name, account_to_add});
    }

    /**
     * @remarks Contract administration: guarded by `require_auth(get_self())`,
     * so only the contract account itself can execute it. The builder still
     * emits it, for a caller that holds that authority.
     */
    addconftoken(token_contract: string, token_symbol: string): EosioSimpleAction {
        return this._action('addconftoken', {token_contract, token_symbol});
    }

    addnotifyacc(collection_name: string, account_to_add: string): EosioSimpleAction {
        return this._action('addnotifyacc', {collection_name, account_to_add});
    }

    /**
     * @remarks Contract administration: guarded by `require_auth(get_self())`,
     * so only the contract account itself can execute it. The builder still
     * emits it, for a caller that holds that authority.
     */
    admincoledit(collection_format_extension: Format[]): EosioSimpleAction {
        return this._action('admincoledit', {collection_format_extension});
    }

    announcedepo(owner: string, symbol_to_announce: string): EosioSimpleAction {
        return this._action('announcedepo', {owner, symbol_to_announce});
    }

    // Native backing is gone from the version this package targets: v2
    // hard-disables the action behind a `check()` guard, so it aborts there.
    // It still executes on a chain that has not migrated, which is why a
    // caller may find it working and why it is deprecated rather than removed.
    // A successful call means the chain has not caught up yet, not that this
    // is a supported path to build on.
    /** @deprecated Native backing is disabled in AtomicAssets v2, where this action aborts. It still executes on chains that have not migrated. */
    backasset(payer: string, asset_owner: string, asset_id: string, token_to_back: string): EosioSimpleAction {
        return this._action('backasset', {payer, asset_owner, asset_id, token_to_back});
    }

    burnasset(asset_owner: string, asset_id: string): EosioSimpleAction {
        return this._action('burnasset', {asset_owner, asset_id});
    }

    canceloffer(offer_id: string): EosioSimpleAction {
        return this._action('canceloffer', {offer_id});
    }

    // v2-only.
    //
    // `owner` picks the authority and the delay together, and they are not
    // independent. true requires the current author's `owner` permission and
    // sets the acceptance date to now, so the new author can accept
    // immediately; false takes `active` auth and adds AUTHOR_SWAP_TIME_DELTA,
    // a week under the deployed parameters, before acceptance is possible.
    // Either way the swap hands over the collection's authorship and cannot be
    // undone once accepted, and the contract never checks
    // is_account(new_author), so a misspelled name is stored as written.
    /**
     * @remarks v2-only action. `owner: true` requires the author's owner
     * permission and permits immediate acceptance; `false` uses active auth and
     * imposes the 7-day `AUTHOR_SWAP_TIME_DELTA`. Acceptance transfers
     * collection authorship irreversibly, and `new_author` is not checked for
     * existence.
     */
    createauswap(collection_name: string, new_author: string, owner: boolean): EosioSimpleAction {
        return this._action('createauswap', {collection_name, new_author, owner});
    }

    createcol(
        author: string, collection_name: string, allow_notify: boolean,
        authorized_accounts: string[], notify_accounts: string[], market_fee: number, data: AttributeMap
    ): EosioSimpleAction {
        assertFinite(market_fee, 'market_fee');

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
        assertUint32(max_supply, 'max_supply');

        return this._action('createtempl', {
            authorized_creator, collection_name, schema_name, transferable, burnable, max_supply, immutable_data
        });
    }

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    createtempl2(
        authorized_creator: string, collection_name: string, schema_name: string,
        transferable: boolean, burnable: boolean, max_supply: number, immutable_data: AttributeMap, mutable_data: AttributeMap
    ): EosioSimpleAction {
        assertUint32(max_supply, 'max_supply');

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

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    deltemplate(authorized_editor: string, collection_name: string, template_id: number): EosioSimpleAction {
        assertInt32(template_id, 'template_id');

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

    /**
     * @remarks Contract administration: guarded by `require_auth(get_self())`,
     * so only the contract account itself can execute it. The builder still
     * emits it, for a caller that holds that authority.
     */
    init(): EosioSimpleAction {
        return this._action('init', {});
    }

    locktemplate(authorized_editor: string, collection_name: string, template_id: number): EosioSimpleAction {
        assertInt32(template_id, 'template_id');

        return this._action('locktemplate', {authorized_editor, collection_name, template_id});
    }

    // tokens_to_back carries the same deprecation as `backasset`, and it is
    // the easier of the two to walk into, because a caller steered off
    // `backasset` reaches for it next. v2 ends this action with
    // check(tokens_to_back.size() == 0), an unconditional abort, so a
    // non-empty vector fails there. A chain that has not migrated instead
    // loops the vector into internal_back_asset and spends the minter's
    // deposited balance on the backed tokens, with nothing in the result to
    // say the feature is going away. Pass [] and back nothing.
    /**
     * @remarks Native backing is deprecated. A non-empty `tokens_to_back`
     * aborts on AtomicAssets v2, and on a chain that has not migrated it still
     * backs the asset and charges the minter. Pass `[]`.
     */
    mintasset(
        authorized_minter: string, collection_name: string, schema_name: string, template_id: number,
        new_asset_owner: string, immutable_data: AttributeMap, mutable_data: AttributeMap, tokens_to_back: string[]
    ): EosioSimpleAction {
        // -1 is the contract's "no template" sentinel and the README's own
        // example, so the signed int32 range is the whole bound here.
        assertInt32(template_id, 'template_id');

        return this._action('mintasset', {
            authorized_minter, collection_name, schema_name, template_id, new_asset_owner, immutable_data, mutable_data, tokens_to_back
        });
    }

    payofferram(payer: string, offer_id: string): EosioSimpleAction {
        return this._action('payofferram', {payer, offer_id});
    }

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    redtemplmax(
        authorized_editor: string, collection_name: string, template_id: number, new_max_supply: number
    ): EosioSimpleAction {
        assertInt32(template_id, 'template_id');
        assertUint32(new_max_supply, 'new_max_supply');

        return this._action('redtemplmax', {authorized_editor, collection_name, template_id, new_max_supply});
    }

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    rejectauswap(collection_name: string): EosioSimpleAction {
        return this._action('rejectauswap', {collection_name});
    }

    remcolauth(collection_name: string, account_to_remove: string): EosioSimpleAction {
        return this._action('remcolauth', {collection_name, account_to_remove});
    }

    remnotifyacc(collection_name: string, account_to_remove: string): EosioSimpleAction {
        return this._action('remnotifyacc', {collection_name, account_to_remove});
    }

    // new_mutable_data becomes the asset's entire mutable data map. The
    // contract serializes exactly what it is handed, so an attribute left out
    // is dropped rather than preserved, and nothing on chain compares the map
    // against what was there. Read the asset's current mutable data and merge
    // into it; a read-modify-write that skips the merge destroys the omitted
    // attributes and reports success.
    /**
     * @remarks `new_mutable_data` replaces the asset's whole mutable data map.
     * Any attribute omitted is silently dropped, so merge into the current data
     * rather than sending a partial map.
     */
    setassetdata(
        authorized_editor: string, asset_owner: string, asset_id: string, new_mutable_data: AttributeMap
    ): EosioSimpleAction {
        return this._action('setassetdata', {authorized_editor, asset_owner, asset_id, new_mutable_data});
    }

    // `data` becomes the collection's entire data map. The contract serializes
    // exactly what it is handed over the existing row, so an attribute left
    // out of the map is dropped, not preserved. Read the current data and
    // merge into it; no contract check compares the two, so a
    // read-modify-write that forgets to merge destroys the omitted attributes
    // and reports success.
    /**
     * @remarks `data` replaces the collection's whole data map. Any attribute
     * omitted is silently dropped, so merge into the current data rather than
     * sending a partial map.
     */
    setcoldata(collection_name: string, data: AttributeMap): EosioSimpleAction {
        return this._action('setcoldata', {collection_name, data});
    }

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    setlastpayer(owner: string, collection_name: string): EosioSimpleAction {
        return this._action('setlastpayer', {owner, collection_name});
    }

    setmarketfee(collection_name: string, market_fee: number): EosioSimpleAction {
        assertFinite(market_fee, 'market_fee');

        return this._action('setmarketfee', {collection_name, market_fee});
    }

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    setrampayer(new_payer: string, asset_id: string): EosioSimpleAction {
        return this._action('setrampayer', {new_payer, asset_id});
    }

    // v2-only.
    //
    // new_mutable_data becomes the template's entire mutable data map, and an
    // attribute left out is dropped rather than preserved. The empty map is
    // the sharpest version of that: the contract reads it as "no mutable data"
    // and erases the templates2 row outright. Read the current data and merge
    // into it; nothing on chain distinguishes a deliberate clear from a
    // partial map sent by mistake.
    /**
     * @remarks v2-only action. `new_mutable_data` replaces the template's whole
     * mutable data map, and an empty map erases the row. Any attribute omitted
     * is silently dropped, so merge into the current data.
     */
    settempldata(
        authorized_editor: string, collection_name: string, template_id: number, new_mutable_data: AttributeMap
    ): EosioSimpleAction {
        assertInt32(template_id, 'template_id');

        return this._action('settempldata', {authorized_editor, collection_name, template_id, new_mutable_data});
    }

    // v2-only.
    //
    // schema_format_type becomes the schema's entire media-type list: the
    // contract assigns the vector over the stored one, so a field left out
    // loses the hint it had. The contract checks that each entry names a field
    // the schema format defines and that no name repeats, but it never
    // compares the vector against what was stored, so an omission is not an
    // error. Read the existing types and merge into them.
    /**
     * @remarks v2-only action. `schema_format_type` replaces the schema's whole
     * media-type list; a field omitted loses its existing hint. Merge into the
     * current types rather than sending a partial list.
     */
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

    /**
     * @remarks Contract administration: guarded by `require_auth(get_self())`,
     * so only the contract account itself can execute it. The builder still
     * emits it, for a caller that holds that authority.
     */
    setversion(new_version: string): EosioSimpleAction {
        return this._action('setversion', {new_version});
    }

    transfer(from: string, to: string, asset_ids: string[], memo: string): EosioSimpleAction {
        return this._action('transfer', {from, to, asset_ids, memo});
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

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    async acceptauswap(authorization: EosioAuthorizationObject[], collection_name: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.acceptauswap(collection_name));
    }

    async acceptoffer(authorization: EosioAuthorizationObject[], offer_id: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.acceptoffer(offer_id));
    }

    async addcolauth(authorization: EosioAuthorizationObject[], collection_name: string, account_to_add: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.addcolauth(collection_name, account_to_add));
    }

    /**
     * @remarks Contract administration: guarded by `require_auth(get_self())`,
     * so only the contract account itself can execute it. The generator still
     * emits it, for a caller that holds that authority.
     */
    async addconftoken(authorization: EosioAuthorizationObject[], token_contract: string, token_symbol: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.addconftoken(token_contract, token_symbol));
    }

    async addnotifyacc(authorization: EosioAuthorizationObject[], collection_name: string, account_to_add: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.addnotifyacc(collection_name, account_to_add));
    }

    /**
     * @remarks Contract administration: guarded by `require_auth(get_self())`,
     * so only the contract account itself can execute it. The generator still
     * emits it, for a caller that holds that authority.
     */
    async admincoledit(authorization: EosioAuthorizationObject[], collection_format_extension: Format[]): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.admincoledit(collection_format_extension));
    }

    async announcedepo(authorization: EosioAuthorizationObject[], owner: string, symbol_to_announce: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.announcedepo(owner, symbol_to_announce));
    }

    // Native backing is gone from the version this package targets: v2
    // hard-disables the action behind a `check()` guard, so it aborts there.
    // It still executes on a chain that has not migrated, which is why a
    // caller may find it working and why it is deprecated rather than removed.
    // A successful call means the chain has not caught up yet, not that this
    // is a supported path to build on.
    /** @deprecated Native backing is disabled in AtomicAssets v2, where this action aborts. It still executes on chains that have not migrated. */
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

    // v2-only.
    //
    // `owner` picks the authority and the delay together, and they are not
    // independent. true requires the current author's `owner` permission and
    // sets the acceptance date to now, so the new author can accept
    // immediately; false takes `active` auth and adds AUTHOR_SWAP_TIME_DELTA,
    // a week under the deployed parameters, before acceptance is possible.
    // Either way the swap hands over the collection's authorship and cannot be
    // undone once accepted, and the contract never checks
    // is_account(new_author), so a misspelled name is stored as written.
    /**
     * @remarks v2-only action. `owner: true` requires the author's owner
     * permission and permits immediate acceptance; `false` uses active auth and
     * imposes the 7-day `AUTHOR_SWAP_TIME_DELTA`. Acceptance transfers
     * collection authorship irreversibly, and `new_author` is not checked for
     * existence.
     */
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

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
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

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
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

    /**
     * @remarks Contract administration: guarded by `require_auth(get_self())`,
     * so only the contract account itself can execute it. The generator still
     * emits it, for a caller that holds that authority.
     */
    async init(authorization: EosioAuthorizationObject[]): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.init());
    }

    async locktemplate(
        authorization: EosioAuthorizationObject[], authorized_editor: string, collection_name: string, template_id: number
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.locktemplate(authorized_editor, collection_name, template_id));
    }

    // tokens_to_back carries the same deprecation as `backasset`, and it is
    // the easier of the two to walk into, because a caller steered off
    // `backasset` reaches for it next. v2 ends this action with
    // check(tokens_to_back.size() == 0), an unconditional abort, so a
    // non-empty vector fails there. A chain that has not migrated instead
    // loops the vector into internal_back_asset and spends the minter's
    // deposited balance on the backed tokens, with nothing in the result to
    // say the feature is going away. Pass [] and back nothing.
    /**
     * @remarks Native backing is deprecated. A non-empty `tokens_to_back`
     * aborts on AtomicAssets v2, and on a chain that has not migrated it still
     * backs the asset and charges the minter. Pass `[]`.
     */
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

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    async redtemplmax(
        authorization: EosioAuthorizationObject[], authorized_editor: string,
        collection_name: string, template_id: number, new_max_supply: number
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.redtemplmax(authorized_editor, collection_name, template_id, new_max_supply));
    }

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    async rejectauswap(authorization: EosioAuthorizationObject[], collection_name: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.rejectauswap(collection_name));
    }

    async remcolauth(authorization: EosioAuthorizationObject[], collection_name: string, account_to_remove: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.remcolauth(collection_name, account_to_remove));
    }

    async remnotifyacc(authorization: EosioAuthorizationObject[], collection_name: string, account_to_remove: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.remnotifyacc(collection_name, account_to_remove));
    }

    // new_mutable_data becomes the asset's entire mutable data map. The
    // contract serializes exactly what it is handed, so an attribute left out
    // is dropped rather than preserved, and nothing on chain compares the map
    // against what was there. Read the asset's current mutable data and merge
    // into it; a read-modify-write that skips the merge destroys the omitted
    // attributes and reports success.
    /**
     * @remarks `new_mutable_data` replaces the asset's whole mutable data map.
     * Any attribute omitted is silently dropped, so merge into the current data
     * rather than sending a partial map.
     */
    async setassetdata(
        authorization: EosioAuthorizationObject[], authorized_editor: string,
        asset_owner: string, asset_id: string, new_mutable_data: AttributeMap
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setassetdata(authorized_editor, asset_owner, asset_id, new_mutable_data));
    }

    // `data` becomes the collection's entire data map. The contract serializes
    // exactly what it is handed over the existing row, so an attribute left
    // out of the map is dropped, not preserved. Read the current data and
    // merge into it; no contract check compares the two, so a
    // read-modify-write that forgets to merge destroys the omitted attributes
    // and reports success.
    /**
     * @remarks `data` replaces the collection's whole data map. Any attribute
     * omitted is silently dropped, so merge into the current data rather than
     * sending a partial map.
     */
    async setcoldata(authorization: EosioAuthorizationObject[], collection_name: string, data: AttributeMap): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setcoldata(collection_name, data));
    }

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    async setlastpayer(authorization: EosioAuthorizationObject[], owner: string, collection_name: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setlastpayer(owner, collection_name));
    }

    async setmarketfee(authorization: EosioAuthorizationObject[], collection_name: string, market_fee: number): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setmarketfee(collection_name, market_fee));
    }

    /** @remarks v2-only action: a chain that has not migrated rejects it as unknown. */
    async setrampayer(authorization: EosioAuthorizationObject[], new_payer: string, asset_id: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setrampayer(new_payer, asset_id));
    }

    // v2-only.
    //
    // new_mutable_data becomes the template's entire mutable data map, and an
    // attribute left out is dropped rather than preserved. The empty map is
    // the sharpest version of that: the contract reads it as "no mutable data"
    // and erases the templates2 row outright. Read the current data and merge
    // into it; nothing on chain distinguishes a deliberate clear from a
    // partial map sent by mistake.
    /**
     * @remarks v2-only action. `new_mutable_data` replaces the template's whole
     * mutable data map, and an empty map erases the row. Any attribute omitted
     * is silently dropped, so merge into the current data.
     */
    async settempldata(
        authorization: EosioAuthorizationObject[], authorized_editor: string,
        collection_name: string, template_id: number, new_mutable_data: AttributeMap
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.settempldata(authorized_editor, collection_name, template_id, new_mutable_data));
    }

    // v2-only.
    //
    // schema_format_type becomes the schema's entire media-type list: the
    // contract assigns the vector over the stored one, so a field left out
    // loses the hint it had. The contract checks that each entry names a field
    // the schema format defines and that no name repeats, but it never
    // compares the vector against what was stored, so an omission is not an
    // error. Read the existing types and merge into them.
    /**
     * @remarks v2-only action. `schema_format_type` replaces the schema's whole
     * media-type list; a field omitted loses its existing hint. Merge into the
     * current types rather than sending a partial list.
     */
    async setschematyp(
        authorization: EosioAuthorizationObject[], authorized_editor: string,
        collection_name: string, schema_name: string, schema_format_type: SchemaFormatType[]
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setschematyp(
            authorized_editor, collection_name, schema_name, schema_format_type
        ));
    }

    /**
     * @remarks Contract administration: guarded by `require_auth(get_self())`,
     * so only the contract account itself can execute it. The generator still
     * emits it, for a caller that holds that authority.
     */
    async setversion(authorization: EosioAuthorizationObject[], new_version: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setversion(new_version));
    }

    async transfer(
        authorization: EosioAuthorizationObject[], from: string, to: string, asset_ids: string[], memo: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.transfer(from, to, asset_ids, memo));
    }

    async withdraw(authorization: EosioAuthorizationObject[], owner: string, token_to_withdraw: string): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.withdraw(owner, token_to_withdraw));
    }

    protected _authorize(authorization: EosioAuthorizationObject[], action: EosioSimpleAction): EosioActionObject[] {
        return [{account: action.account, name: action.name, authorization, data: action.data}];
    }

    /** @deprecated Unused by the generator itself and kept only so subclasses compiled against it keep working. Removal waits for the next major. */
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

// Coerces one float32/float64 attribute value into a number. A value the
// caller already decoded to a number is returned as it is; a string is read as
// a number, and a float32 rounds to the nearest float32. That rounding gives
// the value the chain stored when the string kept full precision; a float32
// below 1 handed over as a seven-decimal string rounds to the nearest float32
// of that string, which can differ from the chain value by a few float32
// steps. A string that does not read as a finite number, the empty string
// included, or whose float32 rounding overflows or underflows, is left alone,
// so a caller sees what it passed in rather than NaN, Infinity or a silent
// zero.
function coerceFloatValue(value: any, float32: boolean): any {
    if (typeof value !== 'string' || value.trim() === '') {
        return value;
    }

    const parsed = Number(value);
    const rounded = float32 ? Math.fround(parsed) : parsed;

    // A zero result is only right when the string itself is a zero. Number()
    // already flattens a double underflow such as '1e-400' to 0, so the test
    // reads the digits ahead of the exponent rather than the parsed value.
    if (!Number.isFinite(rounded) || (rounded === 0 && /[1-9]/.test(value.split(/[eE]/)[0]))) {
        return value;
    }

    return rounded;
}

// Converts an on-chain AttributeMap (either entry shape) into a plain
// key/value object. uint64/int64 values are stringified to avoid precision
// loss; uint64/int64 vector values are stringified element-wise. float32 and
// float64 values, and their vector elements, are returned as numbers, because
// a map objectified by @wharfkit/antelope carries them as strings. Every other
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
        } else if (['float32', 'float64'].indexOf(value[0]) >= 0) {
            Object.defineProperty(result, key, {
                value: coerceFloatValue(value[1], value[0] === 'float32'),
                enumerable: true,
                writable: true,
                configurable: true,
            });
        } else if (['FLOAT_VEC', 'DOUBLE_VEC'].indexOf(value[0]) >= 0) {
            Object.defineProperty(result, key, {
                value: (value[1] as any[]).map((entry) => coerceFloatValue(entry, value[0] === 'FLOAT_VEC')),
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
