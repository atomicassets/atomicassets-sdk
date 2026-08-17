# @atomichub/atomicassets

[![npm version](https://img.shields.io/npm/v/@atomichub/atomicassets.svg)](https://www.npmjs.com/package/@atomichub/atomicassets)
[![CI](https://github.com/atomicassets/atomicassets-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/atomicassets/atomicassets-sdk/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@atomichub/atomicassets.svg)](https://github.com/atomicassets/atomicassets-sdk/blob/main/LICENSE)

Read and write [AtomicAssets](https://github.com/atomicassets/atomicassets-contract) NFTs from JavaScript or TypeScript.

AtomicAssets is the NFT standard used on WAX and other Antelope chains. Its on-chain data is not plain JSON: attributes are packed into a binary format against a per-collection schema, and ids exceed what a JavaScript number can hold safely. This SDK handles that for you, so fetching someone's NFTs is one call that returns typed objects with the attributes already decoded.

If you are building a wallet, a marketplace, a game inventory, or anything that shows or moves NFTs on these chains, this is the client library for it.

## Install

```sh
npm install @atomichub/atomicassets
```

On Node.js the package requires version 20 or newer. Browsers and bundlers are supported through the ESM and IIFE builds. The package has zero runtime dependencies and ships CJS, ESM, and a browser IIFE bundle (`build/atomicassets.global.js`, global `atomicassets`).

## Quickstart

Show the NFTs an account owns:

```ts
import { explorerApiForNetwork } from '@atomichub/atomicassets';

const api = explorerApiForNetwork('wax');

const assets = await api.getAssets({ owner: 'someaccount1' }, 1, 20);

for (const asset of assets) {
    console.log(asset.name, asset.collection.collection_name, asset.data['img']);
}
```

There is nothing to configure first. `explorerApiForNetwork` points at AtomicHub's public endpoint for the network you name, and `asset.data` already holds the merged, decoded attributes.

Examples below continue from this one and reuse `api`. They use top-level `await`, which needs an ES module; under CommonJS, wrap them in an `async` function.

Responses are typed, so `asset.name` and `asset.collection` autocomplete and are checked at build time. `asset.data` is the exception: its keys come from whatever schema the collection defined, so it stays an open map you index by name.

## Picking a client

Two ways to read the same data:

| Client | Use it when | Backed by |
| --- | --- | --- |
| `ExplorerApi` | You want to filter, sort, paginate, or search. This is the usual choice. | A hosted [atomicassets-api](https://github.com/atomicassets/atomicassets-api) indexer |
| `RpcApi` | You want to read contract tables directly, with no indexer in the path. | A plain nodeos node |

`ExplorerApi` can answer questions the chain itself cannot, such as "the 20 most recently minted assets in this collection", because an indexer has already organized the data. `RpcApi` trades that away for reading straight from a node.

## Reading NFT data

```ts
import { AssetsSort, OrderParam } from '@atomichub/atomicassets';

// One asset by id
const asset = await api.getAsset('1099511627786');

// A collection's assets, newest mint first
const newest = await api.getAssets(
    { collection_name: 'mycollection', sort: AssetsSort.Minted, order: OrderParam.Desc },
    1,
    50
);

// Templates, collections, and an account summary
const templates = await api.getTemplates({ collection_name: 'mycollection' });
const collection = await api.getCollection('mycollection');
const account = await api.getAccount('someaccount1');
```

`countAssets`, `countTemplates`, and the other `count*` methods return totals for the same filters, which is what you want for pagination. Transfers, offers, burns, and per-asset logs have their own methods on the same client.

### Supported networks

`wax`, `wax-testnet`, `vaulta`, `xpr`, `xpr-testnet`, `jungle4`.

Self-hosted or custom deployments use the constructors instead:

```ts
import { ExplorerApi, RpcApi } from '@atomichub/atomicassets';

const api = new ExplorerApi('https://wax.api.atomicassets.io', 'atomicassets', {});
const rpc = new RpcApi('https://wax.greymass.com', 'atomicassets', {});
```

## Sending transactions

Reading needs no signing. When you want to mint, transfer, or burn, this SDK builds the action objects and hands them to whatever signing library you already use. It does not sign or broadcast anything itself.

```ts
import { ActionBuilder } from '@atomichub/atomicassets';

const builder = new ActionBuilder('atomicassets');

const send = builder.transfer(
    'someaccount1',        // from
    'otheraccount',        // to
    ['1099511627786'],     // asset_ids
    'gg'                   // memo
);
```

That plugs straight into a signing library such as [WharfKit](https://wharfkit.com/):

```ts
await session.transact({
    actions: [{
        ...send,
        authorization: [{ actor: 'someaccount1', permission: 'active' }]
    }]
});
```

`ActionBuilder` is synchronous and returns authorization-free `{account, name, data}` objects, one method per contract action. If you would rather have authorization attached for you, `ActionGenerator` wraps the same builders and returns fully-authorized `EosioActionObject` arrays.

### Contract versions

This package targets AtomicAssets v2, and the chains are migrating to it. v2 is a superset of v1, so every action v1 already had is spelled identically and works either way. The difference shows up only at the edges of the surface, where a chain that has not migrated yet will not accept all of it.

Read the version from the contract's own `tokenconfigs` table to know where a chain stands. The wax and jungle4 testnets serve v2 and its 47 actions, while the mainnets are still on v1's 35: wax and eos report 1.2.3, xpr reports 1.3.1. Of the networks listed above, that puts `wax-testnet` and `jungle4` on v2, and `wax`, `vaulta`, `xpr` and `xpr-testnet` on v1 until they migrate.

Ten builders target actions v2 introduced: `acceptauswap`, `createauswap`, `rejectauswap`, `createtempl2`, `deltemplate`, `redtemplmax`, `settempldata`, `setschematyp`, `setlastpayer` and `setrampayer`. A chain that has not migrated has no such action and rejects the transaction as unknown, so check the version before sending one of these at a mainnet endpoint.

Native token backing runs the other way, as a removal rather than an addition. v2 disables it, so `backasset` is deprecated and aborts there, and `mintasset` aborts on a non-empty `tokens_to_back`. Both still execute on a chain that has not migrated, which means a call that works is a chain that has not arrived yet, not a supported path to build on.

`init`, `admincoledit`, `setversion` and `addconftoken` are contract administration, each guarded by `require_auth(get_self())`. The builders emit them for a caller that holds that authority, but no ordinary account can execute them.

### Editing data replaces it

`setcoldata`, `setassetdata`, `settempldata` and `setschematyp` each take the map you pass as the complete new value. The contract serializes exactly what it is handed over the existing row, so any attribute you leave out is dropped rather than kept, and `settempldata` with an empty map erases the row. No contract check compares your map against what was stored, so a read-modify-write that forgets to merge destroys the omitted attributes and still reports success. Read the current data, merge your change into it, and send the whole map.

### Minting

Minting takes more arguments because the contract does, and attribute data has to be typed on the way in:

```ts
import { ActionBuilder, createAttributeMap } from '@atomichub/atomicassets';

const builder = new ActionBuilder('atomicassets');

const immutableData = createAttributeMap(
    { name: 'Dragon', level: 12 },
    { name: 'string', level: 'uint16' }
);

const mint = builder.mintasset(
    'creatoracct1',   // authorized_minter
    'mycollection',   // collection_name
    'myschema',       // schema_name
    -1,               // template_id (-1 for none)
    'receiveracct',   // new_asset_owner
    immutableData,    // immutable_data
    [],               // mutable_data
    []                // tokens_to_back
);
```

`createAttributeMap` is what keeps you from hand-building the contract's attribute pairs and getting the types wrong.

`tokens_to_back` is empty above deliberately. Native backing is deprecated, and v2 aborts a mint that supplies any; see [Contract versions](#contract-versions).

### What the builders validate

Almost nothing, deliberately. A builder emits the action data you hand it, and the chain is what decides whether a name exists, an account is authorized, or a fee is allowed; its errors say which.

The exception is the numeric parameters, whose bad values are the only input that neither throws nor survives the trip. Action data reaches a signing library as JSON, and `NaN` and `Infinity` have no JSON form, so `max_supply: NaN` arrives as `"max_supply": null` with the mistake already erased. Each numeric parameter is therefore checked against the ABI type of the field it fills, and the error names that field: `template_id` must be an int32, which keeps `-1` available as the "no template" sentinel; `max_supply` and `new_max_supply` must be uint32, so a fractional or negative supply is refused here rather than on chain; `market_fee` is a float64, so only its finiteness is checkable.

What the contract additionally requires of a value, such as the market fee a collection may charge, stays the chain's to enforce, and it returns a legible error for it. Bound anything else you read from a response before you trust it.

## Working with attribute data directly

Most code never needs this. The API clients decode attributes for you, and `asset.data` is the result. The codec is exported for the cases where you are handling raw contract data yourself:

```ts
import { ObjectSchema, serialize, deserialize } from '@atomichub/atomicassets';

const schema = ObjectSchema([
    { name: 'name', type: 'string' },
    { name: 'level', type: 'uint16' },
    { name: 'tags', type: 'string[]' }
]);

const encoded = serialize({ name: 'Dragon', level: 12, tags: ['fire'] }, schema);
const decoded = deserialize(encoded, schema);
// decoded deep-equals the input object
```

## What's new in 2.1.0

Validates the builders' numeric parameters and deprecates native asset backing.

### Breaking changes

- Numeric parameters on `ActionBuilder` and `ActionGenerator` are checked against the ABI type of the field they fill and throw naming that field. A `NaN` or `Infinity` used to reach the action data as `null`, and a fractional or negative `max_supply` used to reach the chain intact. `template_id` still accepts `-1`, the contract's no-template sentinel, because the ABI type is signed. (#16)

### Deprecations

- `backasset` is deprecated on both the builder and the generator, and `mintasset` carries the same deprecation on its `tokens_to_back` parameter. AtomicAssets v2 disables native backing behind a `check()` guard, so both abort there while still executing on a chain that has not migrated. (#16)

### Other changes

- Value ranges the contract itself enforces stay unchecked, so no guard is stricter than the chain. (#16)
- `transfer` names its first two parameters `from` and `to`, after the ABI fields they become. The parameters are positional, so no call changes. (#16)
- Ten builders that target actions AtomicAssets v2 introduced, and the four that require the contract's own authority, are marked in the README. (#16)
- The ESM build tree-shakes. Importing only `ActionBuilder` no longer drags in the base58 coder, the parser table, or the action-name map, taking a browser bundle that imports only the builder from 14,663 to 9,272 minified bytes. (#16)

## What's new in 2.0.4

### Bug fixes

- The Explorer client percent-encodes caller-supplied path ids and custom data-filter keys, across the sixteen path-building methods and the query-string builder. An asset id, collection, schema, template, offer, or account name carrying `/`, `?`, `#`, `&`, or `=` used to escape its own segment and reshape the request, on the GET path and the long-query POST fallback alike. Hostile input now stays a value. (#14)

### Other changes

- Typed data filters travel as `data%3Anumber.field` rather than `data:number.field`. The API's query parser percent-decodes keys before matching, so the server sees the same key. The plain `data.field` form is unchanged. (#14)

## What's new in 2.0.3

### Bug fixes

- Constructing `ExplorerApi` or `RpcApi` no longer starts a network request, and neither does the action generator that `ExplorerApi.action` resolves to. The contract config is fetched on first use, shared between concurrent callers, and refetched on the next use after a failure, so an outage while these clients are constructed cannot crash a Node process with an unhandled rejection or leave a client permanently stuck on a failed fetch. Retries are not rate limited by the SDK, so a caller polling through an outage owns its own backoff. (#13)

### Other changes

- `ExplorerApi.action` is now a read-only getter with the same `Promise` type. Assigning to it throws instead of silently overwriting, and it no longer appears in `Object.keys` or in a spread of the instance. Rejection values are unchanged, including `RpcApi`'s raw-string invalid config rejection. (#13)
- The RPC row objects (`assets`, `templates`, `schemas`, `collections`, `offers`) are outside this change and still fetch eagerly when constructed. (#13)

## What's new in 2.0.2

### Breaking changes

- The exported table row type `Templates2TableRow` is renamed `MutableTemplatesTableRow`, named for what the row carries (a template's mutable data) rather than the on-chain table suffix. The shape is unchanged, so only imports of the old name need updating. The old name is removed rather than aliased. `ad18bb0`

## What's new in 2.0.1

A documentation release that carries the reworked README to the npm package page, with no code changes.

### Other changes

- npm publishing runs through GitHub's trusted publisher rather than a stored token, so releases are tag-driven, environment-gated, and carry provenance with no long-lived publish secret. (#9)
- The README leads with what the library is for and a zero-config quickstart, separates the choice between the indexed and RPC clients from the method reference, and leads the transaction section with `transfer` rather than `mintasset`. It states that the SDK builds actions and never signs or broadcasts. Both contract links now point at the maintained repositories rather than the archived ones. (#10)

## What's new in 2.0.0

Publishes the AtomicHub fork of `atomicassets-js` as `@atomichub/atomicassets`, updated for the v2 AtomicAssets contract.

### Breaking changes

- The package name is `@atomichub/atomicassets`. Install it under that name and change imports from `'atomicassets'`. (#1)
- Deep imports such as `atomicassets/build/API/Explorer/Params` are replaced by root exports, for example `import { AssetsApiParams } from '@atomichub/atomicassets'`. (#1)
- `max_supply` and `template_id` are numbers where the contract ABI defines them as numeric. The 64-bit id fields, asset ids and offer ids, remain strings. (#1)
- `AttributeMap` entries are strictly typed as `{ key, value: [type, value] }`. Build them with `createAttributeMap` or `toAttributeMap` rather than by hand. Decoding also accepts `{first, second}`: no contract version emits that shape, but CDT 4.1 and newer abigen does for the pair struct before the release build patches it back to `key`/`value`. (#1)
- Node.js 20 or newer is required. (#1)

### Features

- Zero runtime dependencies. Native `BigInt` replaces bn.js and the built-in `fetch` replaces node-fetch, and a custom `fetch` can still be injected. (#1)
- Ships dual CJS and ESM output with bundled type declarations, plus a browser IIFE build. (#1)
- Covers the v2 contract surface: schema-field media types (`setschematyp`) and mutable template data (`createtempl2`, `settempldata`). (#1)
- Adds `ActionBuilder`, a synchronous builder, alongside the authorized `ActionGenerator`. (#1)
- Exports typed table rows, action data payloads and action names from the package root. (#1)
- Adds a serialization codec with strict bounds checking and explicit error classes. Codec output is byte-for-byte equivalent to the v1 big-integer implementation. (#1)
- Explorer query-parameter, enum, and response-object types exported from the root, so no deep `build/` imports are needed. (#1)

### Bug fixes

- `IApiSchema` carries an optional `types` array, which `/v1/schemas` and `/v1/schemas/{collection}/{schema}` always send. Consumers of `getSchemas` and `getSchema` no longer cast past a type that denied the field existed. It is optional because a schema nested in another response never carries it, and a 1.x server does not send it at all. (#6)

### Other changes

- `sideEffects: false` in `package.json`, so consumers of this pure library get tree-shaking. (#5)
- A root `NOTICE` file carries the Apache-2.0 attribution for the vendored IEEE 754 float parser, whose license header esbuild strips on the way into `build/`. It is added to the files whitelist, since npm does not include `NOTICE` by default. (#5)

## Migrating from atomicassets 1.x

- Package name: `npm install @atomichub/atomicassets` and change imports from `'atomicassets'` to `'@atomichub/atomicassets'`.
- Deep imports such as `atomicassets/build/API/Explorer/Params` are replaced by root exports: `import { AssetsApiParams } from '@atomichub/atomicassets'`.
- `max_supply` and `template_id` are numbers where the contract ABI defines them as numeric; 64-bit id fields (asset ids, offer ids) remain strings.
- `AttributeMap` entries are strictly typed as `{ key, value: [type, value] }`; use `createAttributeMap` or `toAttributeMap` instead of hand-building entries. Decoding also accepts `{first, second}`, which is not a contract version's shape but what CDT 4.1 and newer abigen emits for the pair struct before the release build patches it back to `key`/`value`.
- Node.js 20 or newer is required.

## Credits and license

Fork of [atomicassets-js](https://github.com/pinknetworkx/atomicassets-js) by pink.network, updated for the v2 AtomicAssets contract; see [Contract versions](#contract-versions) for where each chain stands in the migration to it. Maintained by AtomicHub.

The market-side companion package is [@atomichub/atomicmarket](https://github.com/atomicassets/atomicmarket-sdk).

MIT licensed; see [LICENSE](https://github.com/atomicassets/atomicassets-sdk/blob/main/LICENSE) for the full text including the original pink.network copyright.
