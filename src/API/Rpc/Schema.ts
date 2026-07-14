import { SchemaFormatType } from '../../Actions/Generator';
import { ISchema, ObjectSchema, SchemaObject } from '../../Schema';
import { ISchemaRow } from './RpcCache';
import RpcCollection from './Collection';
import RpcApi from './index';

export default class RpcSchema {
    readonly collection: string;
    readonly name: string;

    private readonly _data: Promise<ISchemaRow>;
    private readonly _collection: Promise<RpcCollection>;

    private _formatTypes: Promise<SchemaFormatType[]> | null = null;

    constructor(private readonly api: RpcApi, collection: string, name: string, data?: ISchemaRow, cache: boolean = true) {
        this.collection = collection;
        this.name = name;

        this._data = new Promise(async (resolve, reject) => {
            if (data) {
                resolve(data);
            } else {
                try {
                    resolve(await api.queue.fetchSchema(collection, name, cache));
                } catch (e) {
                    reject(e);
                }
            }
        });

        this._collection = new Promise(async (resolve, reject) => {
            try {
                resolve(new RpcCollection(api, collection, undefined, cache));
            } catch (e) {
                reject(e);
            }
        });
    }

    async format(): Promise<ISchema> {
        return ObjectSchema((await this._data).format);
    }

    async rawFormat(): Promise<SchemaObject[]> {
        return (await this._data).format;
    }

    // v2 per-field media-type hints (schematypes table, set via setschematyp);
    // empty for schemas without a types row.
    async formatTypes(): Promise<SchemaFormatType[]> {
        if (!this._formatTypes) {
            this._formatTypes = this.api.queue.fetchSchemaFormatTypes(this.collection, this.name);
        }

        return await this._formatTypes;
    }

    async toObject(): Promise<object> {
        return {
            collection_name: this.collection,
            schema_name: this.name,
            format: await this.rawFormat()
        };
    }
}
