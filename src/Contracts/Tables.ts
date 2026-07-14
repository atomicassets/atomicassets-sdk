import { Format, SchemaFormatType } from '../Actions/Generator';

// Row shapes of the atomicassets on-chain tables (v1 plus the v2 tables
// templates2, authorswaps and schematypes), as returned by get_table_rows
// with json=true. Field names and types follow the contract ABI; uint64
// scalars are typed string because nodeos serializes them as decimal strings
// beyond Number precision, and serialized-data byte vectors arrive as
// number[].

// on-chain table `assets` (struct assets_s)
export type AssetsTableRow = {
    asset_id: string;
    collection_name: string;
    schema_name: string;
    template_id: number;
    ram_payer: string;
    backed_tokens: string[];
    immutable_serialized_data: number[];
    mutable_serialized_data: number[];
};

// on-chain table `authorswaps` (struct author_swaps_s)
export type AuthorSwapsTableRow = {
    collection_name: string;
    current_author: string;
    new_author: string;
    acceptance_date: number;
};

// on-chain table `balances` (struct balances_s)
export type BalancesTableRow = {
    owner: string;
    quantities: string[];
};

// on-chain table `collections` (struct collections_s)
export type CollectionsTableRow = {
    collection_name: string;
    author: string;
    allow_notify: boolean;
    authorized_accounts: string[];
    notify_accounts: string[];
    market_fee: number;
    serialized_data: number[];
};

// on-chain table `config` (struct config_s)
export type ConfigTableRow = {
    asset_counter: string;
    template_counter: number;
    offer_counter: string;
    collection_format: Format[];
    supported_tokens: Array<{ sym: string, contract: string }>;
};

// on-chain table `offers` (struct offers_s)
export type OffersTableRow = {
    offer_id: string;
    sender: string;
    recipient: string;
    sender_asset_ids: string[];
    recipient_asset_ids: string[];
    memo: string;
    ram_payer: string;
};

// on-chain table `schemas` (struct schemas_s)
export type SchemasTableRow = {
    schema_name: string;
    format: Format[];
};

// on-chain table `schematypes` (struct schema_types_s)
export type SchemaTypesTableRow = {
    schema_name: string;
    format_type: SchemaFormatType[];
};

// on-chain table `templates` (struct templates_s)
export type TemplatesTableRow = {
    template_id: number;
    schema_name: string;
    transferable: boolean;
    burnable: boolean;
    max_supply: number;
    issued_supply: number;
    immutable_serialized_data: number[];
};

// on-chain table `templates2` (struct template_mutables_s)
export type Templates2TableRow = {
    template_id: number;
    schema_name: string;
    mutable_serialized_data: number[];
};

// on-chain table `tokenconfigs` (struct tokenconfigs_s)
export type TokenConfigsTableRow = {
    standard: string;
    version: string;
};
