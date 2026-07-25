import { expect } from 'chai';
import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Exercises the built artifacts and the publish whitelist so a tsup or
// package.json regression cannot ship with green unit tests. Depends on a
// fresh build (the pretest hook runs tsup).

const root = path.join(__dirname, '..');

// npm's --json report shares stdout with whatever banner or notice text npm
// decides to print, and either side can contain brackets. Matching greedily to
// the last ']' therefore swallows any trailing notice, so walk from the
// report's opening bracket to its balanced close instead.
function extractJsonArray(stream: string): string {
    const start = stream.search(/\[\s*\{/);

    if (start === -1) {
        return '';
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < stream.length; index++) {
        const character = stream[index];

        if (escaped) {
            escaped = false;
        } else if (inString) {
            if (character === '\\') {
                escaped = true;
            } else if (character === '"') {
                inString = false;
            }
        } else if (character === '"') {
            inString = true;
        } else if (character === '[' || character === '{') {
            depth++;
        } else if (character === ']' || character === '}') {
            depth--;

            if (depth === 0) {
                return stream.slice(start, index + 1);
            }
        }
    }

    return '';
}

describe('Packaging', function () {
    this.timeout(120000);

    it('the CJS bundle loads and exposes the runtime surface', () => {
        const cjs = require(path.join(root, 'build', 'index.cjs'));

        for (const name of ['deserialize', 'serialize', 'ObjectSchema', 'CachedObjectSchema', 'toByteArray',
            'ActionGenerator', 'ActionBuilder', 'RpcApi', 'ExplorerApi', 'toAttributeMap', 'createAttributeMap',
            'convertAttributeMapToObject', 'SerializationError', 'DeserializationError', 'ApiError',
            'mergeSchemaFormatTypes']) {
            expect(cjs[name], name).to.be.a('function');
        }

        expect(cjs.ATOMIC_ATTRIBUTE).to.be.an('object');
        expect(cjs.AtomicAssetsActionNames).to.include('createtempl2');
    });

    it('the ESM bundle imports under real Node ESM resolution', () => {
        const script = 'import(process.argv[1]).then((m) => {' +
            'if (typeof m.deserialize !== \'function\' || typeof m.ActionBuilder !== \'function\') process.exit(1);' +
            '}).catch(() => process.exit(1));';

        execFileSync(process.execPath, ['-e', script, path.join(root, 'build', 'index.mjs')], {cwd: root});
    });

    it('every types path declared in package.json exports exists on disk', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        const exportsMap = pkg.exports['.'];

        const typesPaths = [exportsMap.import.types, exportsMap.require.types];

        expect(typesPaths.length).to.be.greaterThan(0);

        for (const typesPath of typesPaths) {
            expect(
                fs.existsSync(path.join(root, typesPath)),
                `declared types path does not exist after build: ${typesPath}`
            ).to.equal(true);
        }
    });

    it('reads the pack report even when npm brackets a notice around it', () => {
        const report = '[\n  {\n    "files": [{"path": "package.json"}],\n    "bundled": []\n  }\n]';
        const stream = `npm warn config [ignored]\n${report}\nnpm notice publishing [@scope/name@1.0.0]\n`;

        const [parsed] = JSON.parse(extractJsonArray(stream));

        expect(parsed.files.map((file: {path: string}) => file.path)).to.deep.equal(['package.json']);
    });

    it('npm pack ships only the whitelisted files', () => {
        // --ignore-scripts keeps prepack's build output off stdout; the build
        // is already fresh via the pretest hook.
        const output = execSync('npm pack --dry-run --json --ignore-scripts', {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
        const reportJson = extractJsonArray(output);

        if (!reportJson) {
            throw new Error(`npm pack emitted no complete JSON array: ${output}`);
        }

        const [report] = JSON.parse(reportJson);
        const files: string[] = report.files.map((file: {path: string}) => file.path);

        expect(files.length).to.be.greaterThan(0);

        for (const file of files) {
            expect(
                /^(LICENSE|NOTICE|README\.md|package\.json)$|^(build|licenses)\//.test(file),
                `unexpected file in tarball: ${file}`
            ).to.equal(true);
        }
    });
});
