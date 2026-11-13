import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';
import vitest from '@vitest/eslint-plugin';

const policy = {
  rules: {
    'const-object-enums': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          enum: 'TYPE002: declare named values in an object as const and derive the type from its values.',
        },
      },
      create(context) {
        return {
          TSEnumDeclaration(node) {
            context.report({ node, messageId: 'enum' });
          },
          TSUnionType(node) {
            if (
              node.types.some(
                (type) =>
                  type.type === 'TSLiteralType' &&
                  typeof type.literal.value === 'string',
              )
            ) {
              context.report({ node, messageId: 'enum' });
            }
          },
          TSPropertySignature(node) {
            if (
              node.key.type === 'Identifier' &&
              ['type', 'status', 'kind'].includes(node.key.name) &&
              node.typeAnnotation?.typeAnnotation.type === 'TSLiteralType' &&
              typeof node.typeAnnotation.typeAnnotation.literal.value ===
                'string'
            ) {
              context.report({ node, messageId: 'enum' });
            }
          },
        };
      },
    },
    'validated-unknown': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          boundary:
            'CONTRACT001: unknown belongs to validated ingress, preload IPC, or error normalization. Use a validated domain type here.',
        },
      },
      create(context) {
        return {
          TSUnknownKeyword(node) {
            context.report({ node, messageId: 'boundary' });
          },
        };
      },
    },
  },
};
export default tseslint.config(
  {
    ignores: [
      '.agents/skills/pstack/**',
      'node_modules/**',
      '.vite/**',
      'out/**',
      'reports/**',
      '.stryker-tmp/**',
      'coverage/**',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  {
    files: ['**/*.mjs', '**/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        structuredClone: 'readonly',
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { policy },
    rules: {
      'policy/const-object-enums': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': [
        'error',
        { ignoreVoid: false, checkThenables: true },
      ],
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 12,
        },
      ],
      '@typescript-eslint/no-require-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message:
            'ARCH003: use static imports so the dependency graph remains verifiable.',
        },
        {
          selector:
            "TSAsExpression:not([typeAnnotation.typeName.name='const'])",
          message:
            'TYPE001: validate with a schema or narrow the value; casts require a reviewed local exception.',
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/renderer/**/*.{ts,tsx}'],
    rules: { 'policy/validated-unknown': 'error' },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'Date',
        'performance',
        'fetch',
        'process',
        'Buffer',
        'setTimeout',
        'setInterval',
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'DOMAIN001: pass generated values into the domain.',
        },
      ],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks, 'jsx-a11y': a11y },
    rules: {
      ...hooks.configs.recommended.rules,
      ...a11y.configs.recommended.rules,
      'no-restricted-globals': [
        'error',
        'process',
        'Buffer',
        'require',
        'Audio',
        'fetch',
        'WebSocket',
      ],
    },
  },
  { files: ['src/main/main.ts'], rules: { 'no-console': 'off' } },
  {
    files: ['tests/**/*.ts'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
    },
  },
);
