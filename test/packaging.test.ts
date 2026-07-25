import { expect } from 'chai';
import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Exercises the built artifacts and the publish whitelist so a tsup or
// package.json regression cannot ship with green unit tests. Depends on a
// fresh build (the pretest hook runs tsup).

const root = path.join(__dirname, '..');

interface PackReport {
    files: Array<{path: string}>;
}

// Returns the balanced JSON value opening at `start`, or '' if it never closes.
function balancedValueAt(stream: string, start: number): string {
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

// Neither the report's position in the stream nor its shape can be assumed.
// Build banners share stdout and print JSON of their own, so the first value is
// not necessarily the report; and the shape is npm-version dependent, an array
// of report objects up to npm 11 and an object keyed by package name from npm
// 12. CI runs the Node image's npm while the publish job upgrades to the latest
// for trusted publishing, so this test meets both shapes. Identify the report
// by the only thing stable across them, a member carrying a `files` list.
function readPackReport(stream: string): PackReport {
    for (let start = 0; start < stream.length; start++) {
        if (stream[start] !== '[' && stream[start] !== '{') {
            continue;
        }

        const json = balancedValueAt(stream, start);

        if (!json) {
            continue;
        }

        let parsed: unknown;

        try {
            parsed = JSON.parse(json);
        } catch {
            continue;
        }

        const members = Array.isArray(parsed) ? parsed : Object.values(parsed as object);
        const report = members.find((member) => Array.isArray((member as PackReport)?.files));

        if (report) {
            return report as PackReport;
        }
    }

    throw new Error(`npm pack emitted no report carrying a file list: ${stream}`);
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

    it('reads the array-shaped pack report npm 11 and earlier emit', () => {
        const stream = '[\n  {\n    "files": [{"path": "package.json"}],\n    "bundled": []\n  }\n]\n';

        expect(readPackReport(stream).files.map((file) => file.path)).to.deep.equal(['package.json']);
    });

    it('reads the object-shaped pack report npm 12 emits', () => {
        const stream = '{\n  "@scope/name": {\n    "files": [{"path": "package.json"}],\n    "bundled": []\n  }\n}\n';

        expect(readPackReport(stream).files.map((file) => file.path)).to.deep.equal(['package.json']);
    });

    it('reads the pack report even when npm brackets a notice around it', () => {
        const report = '[\n  {\n    "files": [{"path": "package.json"}],\n    "bundled": []\n  }\n]';
        const stream = `npm warn config [ignored]\n${report}\nnpm notice publishing [@scope/name@1.0.0]\n`;

        expect(readPackReport(stream).files.map((file) => file.path)).to.deep.equal(['package.json']);
    });

    it('skips a build banner that prints JSON of its own ahead of the report', () => {
        const report = '[{"files": [{"path": "package.json"}], "bundled": []}]';
        const stream = `CLI Building entry: {"index":"src/index.ts"}\nCLI tsup v8\n${report}\n`;

        expect(readPackReport(stream).files.map((file) => file.path)).to.deep.equal(['package.json']);
    });

    it('npm pack ships only the whitelisted files', () => {
        // --ignore-scripts keeps prepack's build output off stdout; the build
        // is already fresh via the pretest hook.
        const output = execSync('npm pack --dry-run --json --ignore-scripts', {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
        const files = readPackReport(output).files.map((file) => file.path);

        expect(files.length).to.be.greaterThan(0);

        for (const file of files) {
            expect(
                /^(LICENSE|NOTICE|README\.md|package\.json)$|^(build|licenses)\//.test(file),
                `unexpected file in tarball: ${file}`
            ).to.equal(true);
        }
    });
});
