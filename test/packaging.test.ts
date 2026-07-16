import { expect } from 'chai';
import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Exercises the built artifacts and the publish whitelist so a tsup or
// package.json regression cannot ship with green unit tests. Depends on a
// fresh build (the pretest hook runs tsup).

const root = path.join(__dirname, '..');

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

    it('npm pack ships only the whitelisted files', () => {
        // --ignore-scripts keeps prepack's build output off stdout; the build
        // is already fresh via the pretest hook.
        const output = execSync('npm pack --dry-run --json --ignore-scripts', {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
        // npm pack --json prints a single JSON array of objects; banner or warning
        // text on stdout can itself contain '[', so anchor on the array-of-objects
        // opening rather than parsing the whole stream.
        const jsonMatch = output.match(/\[\s*\{[\s\S]*\]/);

        if (!jsonMatch) {
            throw new Error(`npm pack emitted no JSON array: ${output}`);
        }

        const [report] = JSON.parse(jsonMatch[0]);
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
