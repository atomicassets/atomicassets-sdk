# @atomichub/atomicassets

[![npm version](https://img.shields.io/npm/v/@atomichub/atomicassets.svg)](https://www.npmjs.com/package/@atomichub/atomicassets)
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

## What's new in 2.0.4

- Explorer path segments and query keys are percent-encoded. An asset id, collection, schema, template or account name carrying `/`, `?` or `#` used to escape its place in the URL and send the request somewhere else; a data-option key carrying `&` or `=` could append query parameters of its own. Both the query and the long-query POST fallback are covered.

## What's new in 2.0.3

- Constructing `ExplorerApi` or `RpcApi` no longer starts a network request, and the same holds for the action generator `ExplorerApi.action` resolves to. The contract config is fetched on first use, shared between concurrent callers, and refetched on the next use after a failure, so an outage while these clients are constructed cannot crash a Node process with an unhandled rejection or leave a client permanently stuck on a failed fetch. Retries are not rate limited by the SDK; a caller polling through an outage owns its own backoff. The RPC row objects (assets, templates, schemas, collections, offers) still fetch eagerly when constructed.
- `ExplorerApi.action` is now a getter with the same `Promise` type. It no longer appears in `Object.keys` or a spread of the instance, and assigning to it throws instead of silently overwriting.

## What's new in 2.0.0

- Zero runtime dependencies: native `BigInt` replaces bn.js and the built-in `fetch` replaces node-fetch (a custom `fetch` can still be injected).
- Dual CJS/ESM output with bundled type declarations, plus a browser IIFE build.
- v2 contract surface: schema-field media types (`setschematyp`) and mutable template data (`createtempl2`, `settempldata`).
- `ActionBuilder`, a synchronous builder, alongside the authorized `ActionGenerator`.
- Typed table rows, action data payloads, and action names exported from the package root.
- Serialization codec with strict bounds checking and explicit error classes.
- Explorer query-parameter, enum, and response-object types are exported from the root; no deep `build/` imports needed.

## Migrating from atomicassets 1.x

- Package name: `npm install @atomichub/atomicassets` and change imports from `'atomicassets'` to `'@atomichub/atomicassets'`.
- Deep imports such as `atomicassets/build/API/Explorer/Params` are replaced by root exports: `import { AssetsApiParams } from '@atomichub/atomicassets'`.
- `max_supply` and `template_id` are numbers where the contract ABI defines them as numeric; 64-bit id fields (asset ids, offer ids) remain strings.
- `AttributeMap` entries are strictly typed as `{ key, value: [type, value] }`; use `createAttributeMap` or `toAttributeMap` instead of hand-building entries. Decoding accepts both `{key, value}` and v2 `{first, second}` pairs.
- Node.js 20 or newer is required.

## Credits and license

Fork of [atomicassets-js](https://github.com/pinknetworkx/atomicassets-js) by pink.network, updated for the v2 AtomicAssets contract. Maintained by AtomicHub.

The market-side companion package is [@atomichub/atomicmarket](https://github.com/atomicassets/atomicmarket-sdk).

MIT licensed; see [LICENSE](https://github.com/atomicassets/atomicassets-sdk/blob/main/LICENSE) for the full text including the original pink.network copyright.
