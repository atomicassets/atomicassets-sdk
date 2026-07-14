# @atomichub/atomicassets

JavaScript/TypeScript SDK for the [AtomicAssets](https://github.com/pinknetworkx/atomicassets-contract) NFT standard on Antelope (EOSIO) chains such as WAX. It reads NFT data through the AtomicAssets Explorer API or plain nodeos RPC, serializes and deserializes on-chain attribute data, and builds contract actions for signing with any transaction library. This is a maintained fork of the dormant `atomicassets` package by pink.network, updated for the v2 AtomicAssets contract.

The market-side companion package is [@atomichub/atomicmarket](https://github.com/atomicassets/atomicmarket-sdk).

## Install

```sh
npm install @atomichub/atomicassets
```

Requires Node.js >= 20, or any modern browser or bundler. The package has zero runtime dependencies and ships CJS, ESM, and a browser IIFE bundle (`build/atomicassets.global.js`, global `atomicassets`).

```ts
// ESM / TypeScript
import { ExplorerApi, RpcApi } from '@atomichub/atomicassets';

// CommonJS
const { ExplorerApi, RpcApi } = require('@atomichub/atomicassets');
```

## Quickstart

### Read NFT data (Explorer API)

The Explorer API queries a hosted [eosio-contract-api](https://github.com/pinknetworkx/eosio-contract-api) instance. The built-in `fetch` is used unless you pass your own.

```ts
import { ExplorerApi } from '@atomichub/atomicassets';

const api = new ExplorerApi('https://wax.api.atomicassets.io', 'atomicassets', {});

const asset = await api.getAsset('1099511627786');

const assets = await api.getAssets({ owner: 'someaccount1' }, 1, 20);
```

`RpcApi` provides the same data through plain nodeos `get_table_rows` calls when no indexer is available.

### Network endpoints

AtomicHub's public endpoints ship as presets, so a client for a supported network needs one call:

```ts
import { explorerApiForNetwork, rpcApiForNetwork } from '@atomichub/atomicassets';

const api = explorerApiForNetwork('wax');
const rpc = rpcApiForNetwork('wax-testnet');
```

Custom or self-hosted deployments still work through the plain constructors shown above.

### Serialize and deserialize attribute data

AtomicAssets stores attribute data in a compact binary encoding. The API classes decode it for you; for manual work the codec is exported directly.

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

### Build contract actions

`ActionBuilder` is synchronous and returns authorization-free `{account, name, data}` objects, one method per contract action. Attach authorization yourself, or use `ActionGenerator`, which wraps the same builders and returns fully-authorized `EosioActionObject` arrays.

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

The output plugs straight into signing libraries such as [WharfKit](https://wharfkit.com/):

```ts
await session.transact({
    actions: [{
        ...mint,
        authorization: [{ actor: 'creatoracct1', permission: 'active' }]
    }]
});
```

## What's new in 2.0.0

- Zero runtime dependencies: native `BigInt` replaces bn.js and the built-in `fetch` replaces node-fetch (a custom `fetch` can still be injected).
- Dual CJS/ESM output with bundled type declarations, plus a browser IIFE build.
- v2 contract surface: schema-field media types (`setschematyp`), mutable template data (`createtempl2`, `settempldata`), the sync `ActionBuilder` alongside the authorized `ActionGenerator`, and typed table rows, action data payloads, and action names exported from the package root.
- Serialization codec with strict bounds checking and explicit error classes.
- Explorer query-parameter, enum, and response-object types are exported from the root; no deep `build/` imports needed.

## Migrating from atomicassets 1.x

- Package name: `npm install @atomichub/atomicassets` and change imports from `'atomicassets'` to `'@atomichub/atomicassets'`.
- Deep imports such as `atomicassets/build/API/Explorer/Params` are replaced by root exports: `import { AssetsApiParams } from '@atomichub/atomicassets'`.
- `max_supply` and `template_id` are numbers where the contract ABI defines them as numeric; 64-bit id fields (asset ids, offer ids) remain strings.
- `AttributeMap` entries are strictly typed as `{ key, value: [type, value] }`; use `createAttributeMap` or `toAttributeMap` instead of hand-building entries. Decoding accepts both `{key, value}` and v2 `{first, second}` pairs.
- Node.js >= 20 is required.

## Credits and license

Fork of [atomicassets-js](https://github.com/pinknetworkx/atomicassets-js) by pink.network. Maintained by AtomicHub.

MIT licensed; see [LICENSE](LICENSE) for the full text including the original pink.network copyright.
