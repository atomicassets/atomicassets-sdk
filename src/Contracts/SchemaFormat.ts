import { Format, SchemaFormatType } from '../Actions/Generator';

export type MergedSchemaFormat = Array<Format & { mediatype: string | null, info: string | null }>;

// Derives a per-field mediatype/info for a schema format, preferring the
// explicit v2 schematypes entries (set via setschematyp) and falling back to
// a field-name/type heuristic. Every renderer of schema formats needs the
// identical rule or media fields display inconsistently, so it lives here
// rather than in each consumer.
export function mergeSchemaFormatTypes(format: Format[], types: SchemaFormatType[]): MergedSchemaFormat {
    return format.map((field) => {
        const type = types.find((x) => x.name === field.name);

        const checkName = (match: string): boolean =>
            field.name.toLowerCase().startsWith(match) || field.name.toLowerCase().endsWith(match);

        let derivedType: string | null = null;

        if (field.name === 'name') {
            derivedType = 'name';
        }

        if (checkName('image') || checkName('img') || field.type === 'image') {
            derivedType = 'image';
        }

        if (checkName('video')) {
            derivedType = 'video';
        }

        if (checkName('audio')) {
            derivedType = 'audio';
        }

        return {
            ...field,
            mediatype: type?.mediatype || derivedType,
            info: type?.info || null
        };
    });
}
