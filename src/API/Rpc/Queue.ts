import { SchemaFormatType } from '../../Actions/Generator';
import { IAssetRow, ICollectionRow, IOfferRow, ISchemaRow, ITemplateRow } from './RpcCache';
import RpcApi from './index';

// Raw row of the v2 templates2 table (mutable template data), joined into
// ITemplateRow before caching.
type Template2Row = { template_id: number, schema_name: string, mutable_serialized_data: number[] };

export default class RpcQueue {
    private elements: any[] = [];
    private interval: any = null;

    private preloadedCollections: {[key: string]: number} = {};

    constructor(private readonly api: RpcApi, private readonly requestLimit: number = 4) { }

    async fetchAsset(owner: string, assetID: string, useCache: boolean = true): Promise<IAssetRow> {
        return await this.fetch_single_row<IAssetRow>('assets', owner, assetID, (data?: IAssetRow) => {
            return (useCache || typeof data !== 'undefined') ? this.api.cache.getAsset(assetID, data) : null;
        });
    }

    async fetchAccountAssets(account: string): Promise<IAssetRow[]> {
        const rows = await this.fetch_all_rows<IAssetRow>('assets', account, 'asset_id');

        return rows.map((asset) => {
            return <IAssetRow>this.api.cache.getAsset(asset.asset_id, asset);
        });
    }

    async fetchTemplate(collectionName: string, templateID: string, useCache: boolean = true): Promise<ITemplateRow> {
        const cached = useCache ? this.api.cache.getTemplate(collectionName, templateID) : null;

        if (cached) {
            return cached;
        }

        const [row, mutableRow] = await Promise.all([
            this.fetch_optional_row<ITemplateRow>('templates', collectionName, templateID),
            this.fetch_optional_row<Template2Row>('templates2', collectionName, templateID)
        ]);

        if (!row) {
            throw new Error('Row not found for template ' + collectionName + ':' + templateID);
        }

        (<any>row).mutable_serialized_data = mutableRow ? mutableRow.mutable_serialized_data : [];

        return <ITemplateRow>this.api.cache.getTemplate(collectionName, templateID, row);
    }

    async fetchSchemaFormatTypes(collectionName: string, schemaName: string): Promise<SchemaFormatType[]> {
        const row = await this.fetch_optional_row<{schema_name: string, format_type: SchemaFormatType[]}>(
            'schematypes', collectionName, schemaName
        );

        return row ? row.format_type : [];
    }

    async fetchSchema(collectionName: string, schemaName: string, useCache: boolean = true): Promise<ISchemaRow> {
        return await this.fetch_single_row<ISchemaRow>('schemas', collectionName, schemaName, (data?: ISchemaRow) => {
            return (useCache || typeof data !== 'undefined') ? this.api.cache.getSchema(collectionName, schemaName, data) : null;
        });
    }

    async fetchCollection(collectionName: string, useCache: boolean = true): Promise<ICollectionRow> {
        return await this.fetch_single_row<ICollectionRow>('collections', this.api.contract, collectionName, (data?: ICollectionRow) => {
            return (useCache || typeof data !== 'undefined') ? this.api.cache.getCollection(collectionName, data) : null;
        });
    }

    async fetchCollectionSchemas(collectionName: string): Promise<ISchemaRow[]> {
        const rows = await this.fetch_all_rows<ISchemaRow>('schemas', collectionName, 'schema_name');

        return rows.map((schema) => {
            return <ISchemaRow>this.api.cache.getSchema(collectionName, schema.schema_name, schema);
        });
    }

    async fetchCollectionTemplates(collectionName: string): Promise<ITemplateRow[]> {
        const [rows, mutableRows] = await Promise.all([
            this.fetch_all_rows<ITemplateRow>('templates', collectionName, 'template_id'),
            this.fetch_all_rows<Template2Row>('templates2', collectionName, 'template_id')
        ]);

        const mutableData = new Map(mutableRows.map((row) => [String(row.template_id), row.mutable_serialized_data]));

        return rows.map((template) => {
            (<any>template).mutable_serialized_data = mutableData.get(String(template.template_id)) ?? [];

            return <ITemplateRow>this.api.cache.getTemplate(collectionName, String(template.template_id), template);
        });
    }

    async preloadCollection(collectionName: string, useCache: boolean = true): Promise<void> {
        if (!useCache || !this.preloadedCollections[collectionName] || this.preloadedCollections[collectionName] + 15 * 60 * 1000 < Date.now()) {
            await this.fetchCollectionSchemas(collectionName);
            await this.fetchCollectionTemplates(collectionName);
        }
    }

    async fetchOffer(offerID: string, useCache: boolean = true): Promise<IOfferRow> {
        return await this.fetch_single_row<IOfferRow>('offers', this.api.contract, offerID, (data?: IOfferRow) => {
            return (useCache || typeof data !== 'undefined') ? this.api.cache.getOffer(offerID, data) : null;
        });
    }

    async fetchAccountOffers(account: string): Promise<IOfferRow[]> {
        const rows: any[][] = await Promise.all([
            this.fetch_all_rows<IOfferRow>(
                'offers', this.api.contract, 'offer_sender', account, account, 2, 'name'
            ),
            this.fetch_all_rows<IOfferRow>(
                'offers', this.api.contract, 'offer_recipient', account, account, 3, 'name'
            )
        ]);

        const offers: IOfferRow[] = rows[0].concat(rows[1]);

        return offers.map((offer) => {
            return <IOfferRow>this.api.cache.getOffer(offer.offer_id, offer);
        });
    }

    private dequeue(): void {
        if (this.interval) {
            return;
        }

        this.interval = setInterval(async () => {
            if (this.elements.length > 0) {
                this.elements.shift()();
            } else {
                clearInterval(this.interval);
                this.interval = null;
            }
        }, Math.ceil(1000 / this.requestLimit));
    }

    // Like fetch_single_row but resolves null for a missing row instead of
    // rejecting; used for the v2 side tables (templates2, schematypes) whose
    // rows only exist once the corresponding v2 action has run.
    private async fetch_optional_row<T>(
        table: string, scope: string, match: any,
        indexPosition: number = 1, keyType: string = ''
    ): Promise<T | null> {
        return new Promise((resolve, reject) => {
            this.elements.push(async () => {
                try {
                    const resp = await this.api.getTableRows({
                        code: this.api.contract, table, scope,
                        limit: 1, lower_bound: match, upper_bound: match,
                        index_position: indexPosition, key_type: keyType
                    });

                    return resolve(resp.rows.length === 0 ? null : <T>resp.rows[0]);
                } catch (e) {
                    return reject(e);
                }
            });

            this.dequeue();
        });
    }

    private async fetch_single_row<T>(
        table: string, scope: string, match: any,
        cacheFn: (data?: T) => T | null,
        indexPosition: number = 1, keyType: string = ''
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            let data = cacheFn();

            if (data !== null) {
                return resolve(data);
            }

            this.elements.push(async () => {
                data = cacheFn();

                if (data !== null) {
                    return resolve(data);
                }

                try {
                    const options = {
                        code: this.api.contract, table, scope,
                        limit: 1, lower_bound: match, upper_bound: match,
                        index_position: indexPosition, key_type: keyType
                    };

                    const resp = await this.api.getTableRows(options);

                    if (resp.rows.length === 0) {
                        return reject(new Error('Row not found for ' + JSON.stringify(options)));
                    }

                    return resolve(<T>cacheFn(resp.rows[0]));
                } catch (e) {
                    return reject(e);
                }
            });

            this.dequeue();
        });
    }

    private async fetch_all_rows<T>(
        table: string, scope: string, tableKey: string,
        lowerBound: string = '', upperBound: string = '',
        indexPosition: number = 1, keyType: string = ''
    ): Promise<T[]> {
        return new Promise(async (resolve, reject) => {
            this.elements.push(async () => {
                const resp: { more: boolean, rows: any[] } = await this.api.getTableRows({
                    code: this.api.contract, scope, table,
                    lower_bound: lowerBound, upper_bound: upperBound, limit: 1000,
                    index_position: indexPosition, key_type: keyType
                });

                if (resp.more && indexPosition === 1) {
                    this.elements.unshift(async () => {
                        try {
                            const next = await this.fetch_all_rows(
                                table, scope, tableKey,
                                resp.rows[resp.rows.length - 1][tableKey],
                                upperBound, indexPosition, keyType
                            );

                            if (next.length > 0) {
                                next.shift();
                            }

                            resolve(resp.rows.concat(next));
                        } catch (e) {
                            reject(e);
                        }
                    });

                    this.dequeue();
                } else {
                    resolve(resp.rows);
                }
            });

            this.dequeue();
        });
    }
}
