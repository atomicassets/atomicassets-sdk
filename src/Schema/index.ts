import SchemaError from '../Errors/SchemaError';
import SerializationState from '../Serialization/State';
import MappingSchema from './MappingSchema';
import ValueSchema from './ValueSchema';
import VectorSchema from './VectorSchema';

export interface ISchema {
    serialize(data: any): Uint8Array;

    // Yields whatever the node type decodes: a plain object for mappings,
    // a scalar for values, an array for vectors.
    deserialize(state: SerializationState): any;
}

export type SchemaObject = { name: string, type: string, parent?: number, mediatype?: string };
export type MappingAttribute = { name: string, value: ISchema };

type ObjectLookup = { [id: number]: SchemaObject[] };

function buildObjectSchema(objectID: number, lookup: ObjectLookup): ISchema {
    const attributes: MappingAttribute[] = [];
    let fields = lookup[objectID];

    if (typeof fields === 'undefined') {
        fields = [];
    }

    delete lookup[objectID];

    for (const field of fields) {
        attributes.push({name: field.name, value: buildValueSchema(field.type, lookup)});
    }

    return new MappingSchema(attributes);
}

function buildValueSchema(type: string, lookup: ObjectLookup): ISchema {
    if (type.endsWith('[]')) {
        return new VectorSchema(buildValueSchema(type.substring(0, type.length - 2), lookup));
    }

    // not supported by the contract currently
    if (type.startsWith('object{') && type.endsWith('}')) {
        const objectID = parseInt(type.substring(7, type.length - 1), 10);

        if (isNaN(objectID)) {
            throw new SchemaError(`invalid type '${type}'`);
        }

        return buildObjectSchema(objectID, lookup);
    }

    return new ValueSchema(type);
}

export function ObjectSchema(schema: SchemaObject[]): ISchema {
    const objectLookup: ObjectLookup = {};

    for (const schemaObject of schema) {
        const objectID = typeof schemaObject.parent === 'undefined' ? 0 : schemaObject.parent;

        if (typeof objectLookup[objectID] === 'undefined') {
            objectLookup[objectID] = [];
        }

        objectLookup[objectID].push(schemaObject);
    }

    return buildObjectSchema(0, objectLookup);
}

const objectSchemaCache = new Map<string, ISchema>();
const OBJECT_SCHEMA_CACHE_MAX_ENTRIES = 500;

// Memoizing ObjectSchema for hot paths that rebuild the same schema per row
// (e.g. fillers deserializing many deltas against one format). ISchema nodes
// are stateless (decode state lives in SerializationState), so instances are
// safe to share. The cache is keyed by the JSON of the format array and is
// bounded to 500 entries, evicting the oldest entry on overflow.
export function CachedObjectSchema(schema: SchemaObject[]): ISchema {
    const key = JSON.stringify(schema);

    let cached = objectSchemaCache.get(key);

    if (!cached) {
        cached = ObjectSchema(schema);

        if (objectSchemaCache.size >= OBJECT_SCHEMA_CACHE_MAX_ENTRIES) {
            const oldestKey = objectSchemaCache.keys().next().value;

            if (oldestKey !== undefined) {
                objectSchemaCache.delete(oldestKey);
            }
        }

        objectSchemaCache.set(key, cached);
    }

    return cached;
}
