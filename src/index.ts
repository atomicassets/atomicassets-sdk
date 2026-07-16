import ExplorerActionGenerator from './Actions/Explorer';
import { ActionBuilder, ActionGenerator } from './Actions/Generator';
import RpcActionGenerator from './Actions/Rpc';
import ExplorerApi from './API/Explorer';
import RpcApi from './API/Rpc';
import { CachedObjectSchema, ISchema, ObjectSchema, SchemaObject } from './Schema';
import { ByteInput, deserialize, serialize, toByteArray } from './Serialization';
import { ParserTypes } from './Serialization/Types';

export {
    RpcApi, ExplorerApi, ObjectSchema, CachedObjectSchema, deserialize, serialize, toByteArray, ParserTypes,
    RpcActionGenerator, ExplorerActionGenerator, ActionGenerator, ActionBuilder
};

// Serialization schema interface plus the canonical schema-format entry type
// (carries the optional v2 mediatype hint), and the input shapes
// deserialize/toByteArray normalize.
export { ISchema, SchemaObject, ByteInput };

// Action-generator shapes, including the v2 setschematyp media-type entry,
// plus the schema-less attribute-map helpers.
export {
    AttributeMap, AttributeMapEntry, DecodedAttributeMap,
    EosioActionObject, EosioAuthorizationObject, EosioSimpleAction, Format, SchemaFormatType,
    ATOMIC_ATTRIBUTE, convertAttributeMapToObject, createAttributeMap, toAttributeMap
} from './Actions/Generator';

// AtomicHub public endpoint presets and preconfigured client factories.
export { AtomicHubNetwork, NETWORK_ENDPOINTS, explorerApiForNetwork, rpcApiForNetwork } from './Networks';

// Error classes, exported so consumers can instanceof-match failures.
export { default as ApiError } from './Errors/ApiError';
export { default as DeserializationError } from './Errors/DeserializationError';
export { default as ExplorerError } from './Errors/ExplorerError';
export { default as RpcError } from './Errors/RpcError';
export { default as SchemaError } from './Errors/SchemaError';
export { default as SerializationError } from './Errors/SerializationError';

// API response object types. The API-object schema interface is IApiSchema
// (renamed from ISchema to resolve the collision with the serialization
// ISchema exported above).
export * from './API/Explorer/Objects';

// Explorer query-parameter and enum types (sort orders, api params). Exported
// from the package root so consumers no longer reach into deep build/ paths.
export * from './API/Explorer/Params';
export * from './API/Explorer/Enums';
export { DataOptions } from './API/Explorer';

// RPC table-row shapes as the RPC layer caches them (byte vectors already
// normalized to Uint8Array).
export {
    IAssetRow, ICollectionRow, IConfigRow, IOfferRow, ISchemaRow, ITemplateRow, SchemaFormat
} from './API/Rpc/RpcCache';

// Contract-level types straight from the v2 ABI: raw table rows, action data
// payloads, action names, and the schema-format mediatype merge rule.
export * from './Contracts/Tables';
export * from './Contracts/ActionData';
export * from './Contracts/ActionNames';
export * from './Contracts/SchemaFormat';
