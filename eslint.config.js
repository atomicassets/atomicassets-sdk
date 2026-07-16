const tseslint = require('typescript-eslint');

// Flat config for the fork's migration from TSLint. The goal here is to
// establish the typescript-eslint toolchain without reflowing the preserved
// upstream codec; rules that the frozen surface violates by design are
// relaxed rather than mass-edited (the codec must stay byte-identical).
module.exports = tseslint.config(
    {
        ignores: ['build/', 'dist/', 'lib/', 'node_modules/']
    },
    ...tseslint.configs.recommended,
    {
        rules: {
            // Frozen codec (src/Serialization/**) keeps upstream's `let` where a
            // const would do; it carried an inline tslint suppression and must
            // stay byte-identical, so the rule is off rather than edited in place.
            'prefer-const': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/no-namespace': 'off'
        }
    }
);
