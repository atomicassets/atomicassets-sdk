import ExplorerActionGenerator from '../../Actions/Explorer';
import ApiError from '../../Errors/ApiError';
import {
    IAccountCollectionStats,
    IAccountStats,
    IAsset,
    IAssetStats,
    ICollection,
    ICollectionStats,
    IConfig,
    ILog, IOffer,
    IApiSchema,
    ISchemaStats,
    ITemplate,
    ITemplateStats, ITransfer
} from './Objects';
import {
    AccountApiParams,
    AssetsApiParams,
    CollectionApiParams, GreylistParams, HideOffersParams,
    OfferApiParams,
    SchemaApiParams,
    TemplateApiParams,
    TransferApiParams
} from './Params';

type Fetch = (input?: Request | string, init?: RequestInit) => Promise<Response>;
type ApiArgs = { fetch?: Fetch };

export type DataOptions = Array<{key: string, value: any, type?: string}>;

// Asset ids, collection/schema/template names and account names reach the path
// straight from the caller. Left raw, a value carrying `/`, `?` or `#` escapes
// its own segment and rewrites the request target, so every one is encoded
// where the path is assembled rather than in either fetch branch.
function encodeSegment(value: string): string {
    return encodeURIComponent(value);
}

function buildDataOptions(options: {[key: string]: any}, data: DataOptions): {[key: string]: any} {
    const dataFields: {[key: string]: string} = {};

    for (const row of data) {
        const dataType = row.type ?? 'data';

        if (typeof row.value === 'number') {
            dataFields[dataType + ':number.' + row.key] = String(row.value);
        } else if (typeof row.value === 'boolean') {
            dataFields[dataType + ':bool.' + row.key] = row.value ? 'true' : 'false';
        } else {
            dataFields[dataType + '.' + row.key] = row.value;
        }
    }

    return Object.assign({}, options, dataFields);
}

export default class ExplorerApi {
    // Created lazily on first access instead of in the constructor: a
    // constructor that starts network I/O hands out a promise nobody is
    // guaranteed to await, and on current Node an unawaited rejection kills
    // the process. Cached so concurrent accesses share one fetch, cleared on
    // failure so a cached rejection cannot poison the instance forever.
    private _action?: Promise<ExplorerActionGenerator>;

    private readonly endpoint: string;
    private readonly namespace: string;

    private readonly fetchBuiltin: Fetch;

    constructor(endpoint: string, namespace: string, args: ApiArgs) {
        this.endpoint = endpoint;
        this.namespace = namespace;

        if (args.fetch) {
            this.fetchBuiltin = args.fetch;
        } else {
            // Bound because browser fetch is a Window-branded method: called
            // bare (this === undefined) it throws Illegal invocation.
            this.fetchBuiltin = <Fetch>globalThis.fetch.bind(globalThis);
        }
    }

    get action(): Promise<ExplorerActionGenerator> {
        if (!this._action) {
            const pending = (async () => {
                return new ExplorerActionGenerator((await this.getConfig()).contract, this);
            })();

            // Clears the cache so the next access retries, and doubles as the
            // guaranteed handler that keeps an unawaited access from ever
            // rejecting unhandled.
            pending.catch(() => {
                if (this._action === pending) {
                    this._action = undefined;
                }
            });

            this._action = pending;
        }

        return this._action;
    }

    async getConfig(): Promise<IConfig> {
        return await this.fetchEndpoint<IConfig>('/v1/config', {});
    }

    async getAssets(options: AssetsApiParams = {}, page: number = 1, limit: number = 100, data: DataOptions = []): Promise<IAsset[]> {
        return await this.fetchEndpoint('/v1/assets', {page, limit, ...buildDataOptions(options, data)});
    }

    async countAssets(options: AssetsApiParams, data: DataOptions = []): Promise<number> {
        return await this.countEndpoint('/v1/assets', buildDataOptions(options, data));
    }

    async getAsset(id: string): Promise<IAsset> {
        return await this.fetchEndpoint('/v1/assets/' + encodeSegment(id), {});
    }

    async getAssetStats(id: string): Promise<IAssetStats> {
        return await this.fetchEndpoint('/v1/assets/' + encodeSegment(id) + '/stats', {});
    }

    async getAssetLogs(id: string, page: number = 1, limit: number = 100, order: string = 'desc'): Promise<ILog[]> {
        return await this.fetchEndpoint('/v1/assets/' + encodeSegment(id) + '/logs', {page, limit, order});
    }

    async getCollections(options: CollectionApiParams = {}, page: number = 1, limit: number = 100): Promise<ICollection[]> {
        return await this.fetchEndpoint('/v1/collections', {page, limit, ...options});
    }

    async countCollections(options: CollectionApiParams = {}): Promise<number> {
        return await this.countEndpoint('/v1/collections', options);
    }

    async getCollection(name: string): Promise<ICollection> {
        return await this.fetchEndpoint('/v1/collections/' + encodeSegment(name), {});
    }

    async getCollectionStats(name: string): Promise<ICollectionStats> {
        return await this.fetchEndpoint('/v1/collections/' + encodeSegment(name) + '/stats', {});
    }

    async getCollectionLogs(name: string, page: number = 1, limit: number = 100, order: string = 'desc'): Promise<ILog[]> {
        return await this.fetchEndpoint('/v1/collections/' + encodeSegment(name) + '/logs', {page, limit, order});
    }

    async getSchemas(options: SchemaApiParams = {}, page: number = 1, limit: number = 100): Promise<IApiSchema[]> {
        return await this.fetchEndpoint('/v1/schemas', {page, limit, ...options});
    }

    async countSchemas(options: SchemaApiParams = {}): Promise<number> {
        return await this.countEndpoint('/v1/schemas', options);
    }

    async getSchema(collection: string, name: string): Promise<IApiSchema> {
        return await this.fetchEndpoint('/v1/schemas/' + encodeSegment(collection) + '/' + encodeSegment(name), {});
    }

    async getSchemaStats(collection: string, name: string): Promise<ISchemaStats> {
        return await this.fetchEndpoint('/v1/schemas/' + encodeSegment(collection) + '/' + encodeSegment(name) + '/stats', {});
    }

    async getSchemaLogs(collection: string, name: string, page: number = 1, limit: number = 100, order: string = 'desc'): Promise<ILog[]> {
        return await this.fetchEndpoint('/v1/schemas/' + encodeSegment(collection) + '/' + encodeSegment(name) + '/logs', {page, limit, order});
    }

    async getTemplates(options: TemplateApiParams = {}, page: number = 1, limit: number = 100, data: DataOptions = []): Promise<ITemplate[]> {
        return await this.fetchEndpoint('/v1/templates', {page, limit, ...buildDataOptions(options, data)});
    }

    async countTemplates(options: TemplateApiParams = {}, data: DataOptions = []): Promise<number> {
        return await this.countEndpoint('/v1/templates', buildDataOptions(options, data));
    }

    async getTemplate(collection: string, id: string): Promise<ITemplate> {
        return await this.fetchEndpoint('/v1/templates/' + encodeSegment(collection) + '/' + encodeSegment(id), {});
    }

    async getTemplateStats(collection: string, name: string): Promise<ITemplateStats> {
        return await this.fetchEndpoint('/v1/templates/' + encodeSegment(collection) + '/' + encodeSegment(name) + '/stats', {});
    }

    async getTemplateLogs(collection: string, id: string, page: number = 1, limit: number = 100, order: string = 'desc'): Promise<ILog[]> {
        return await this.fetchEndpoint('/v1/templates/' + encodeSegment(collection) + '/' + encodeSegment(id) + '/logs', {page, limit, order});
    }

    async getTransfers(options: TransferApiParams = {}, page: number = 1, limit: number = 100): Promise<ITransfer[]> {
        return await this.fetchEndpoint('/v1/transfers', {page, limit, ...options});
    }

    async countTransfers(options: TransferApiParams = {}): Promise<number> {
        return await this.countEndpoint('/v1/transfers', options);
    }

    async getOffers(options: OfferApiParams = {}, page: number = 1, limit: number = 100): Promise<IOffer[]> {
        return await this.fetchEndpoint('/v1/offers', {page, limit, ...options});
    }

    async countOffers(options: OfferApiParams = {}): Promise<number> {
        return await this.countEndpoint('/v1/offers', options);
    }

    async getOffer(id: string): Promise<IOffer> {
        return await this.fetchEndpoint('/v1/offers/' + encodeSegment(id), {});
    }

    async getAccounts(options: AccountApiParams = {}, page: number = 1, limit: number = 100): Promise<Array<{account: string, assets: string}>> {
        return await this.fetchEndpoint('/v1/accounts', {page, limit, ...options});
    }

    async getBurns(options: AccountApiParams = {}, page: number = 1, limit: number = 100): Promise<Array<{account: string, assets: string}>> {
        return await this.fetchEndpoint('/v1/burns', {page, limit, ...options});
    }

    async countAccounts(options: AccountApiParams = {}): Promise<number> {
        return await this.countEndpoint('/v1/accounts', options);
    }

    async getAccount(account: string, options: GreylistParams & HideOffersParams = {}): Promise<IAccountStats> {
        return await this.fetchEndpoint('/v1/accounts/' + encodeSegment(account), options);
    }

    async getAccountCollection(account: string, collection: string): Promise<IAccountCollectionStats> {
        return await this.fetchEndpoint('/v1/accounts/' + encodeSegment(account) + '/' + encodeSegment(collection), {});
    }

    async getAccountBurns(account: string, options: GreylistParams & HideOffersParams = {}): Promise<IAccountStats> {
        return await this.fetchEndpoint('/v1/burns/' + encodeSegment(account), options);
    }

    async fetchEndpoint<T>(path: string, args: any): Promise<T> {
        let response, json;

        const f = this.fetchBuiltin;
        const queryString = Object.keys(args).map((key) => {
            let value = args[key];

            if (value === true) {
                value = 'true';
            }

            if (value === false) {
                value = 'false';
            }

            // The key side is caller-supplied too: buildDataOptions splices
            // row.key and row.type into it, so an unencoded `&` or `=` there
            // would smuggle extra parameters into the query.
            return encodeURIComponent(key) + '=' + encodeURIComponent(value);
        }).join('&');

        try {
            if ( queryString.length < 1000 ) {
                response = await f(this.endpoint + '/' + this.namespace + path + (queryString.length > 0 ? '?' + queryString : ''));
            }
            else {
                response = await f(
                    this.endpoint + '/' + this.namespace + path,
                    {
                        headers: {
                            'accept': '*.*',
                            'content-type': 'application/json'
                        },
                        method: 'POST',
                        body: JSON.stringify(args)
                    }
                );
            }

            json = await response.json();
        } catch (e: any) {
            throw new ApiError(e.message, 500);
        }

        if (response.status !== 200) {
            throw new ApiError(json.message, response.status);
        }

        if (!json.success) {
            throw new ApiError(json.message, response.status);
        }

        return json.data;
    }

    async countEndpoint(path: string, args: any): Promise<number> {
        const res = await this.fetchEndpoint<string>(path + '/_count', args);

        return parseInt(res, 10);
    }
}
