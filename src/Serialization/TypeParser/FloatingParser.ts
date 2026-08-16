import SerializationState from '../State';
import FixedParser from './FixedParser';

// The vendored float helper is CommonJS, and a top-level `require` of it lands
// in the single-file ESM build as a module-level call no bundler may drop, so
// it anchored the whole helper into consumers that never touch a float. Behind
// this accessor the require sits in a function body instead, where it goes away
// with the parser. Initialization is deferred, not repeated or made fallible:
// the helper is bundled into the same file, so resolving it cannot fail, and
// its module body only feature-detects typed arrays.
let fp: any = null;

function floatHelper(): any {
    if (fp === null) {
        fp = require('../../../lib/float');
    }

    return fp;
}

export default class FloatingParser extends FixedParser {
    constructor(private readonly isDouble: boolean) {
        super(isDouble ? 8 : 4);
    }

    deserialize(state: SerializationState): number {
        if (this.isDouble) {
            return floatHelper().readDoubleLE(super.deserialize(state));
        }

        return floatHelper().readFloatLE(super.deserialize(state));
    }

    serialize(data: number): Uint8Array {
        // tslint:disable-next-line:prefer-const
        let bytes: number[] = [];

        if (this.isDouble) {
            floatHelper().writeDoubleLE(bytes, data);

            return super.serialize(new Uint8Array(bytes));
        }

        floatHelper().writeFloatLE(bytes, data);

        return super.serialize(new Uint8Array(bytes));
    }
}
