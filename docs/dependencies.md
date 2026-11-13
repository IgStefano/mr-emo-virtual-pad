# Toolchain notes

Dependency versions are exact and locked. Node 24 is the tooling baseline;
TypeScript 6 matches the current Vitest lint plugin peer range. ESLint 9 is pinned
because jsx-a11y currently declares compatibility through 9; npm marks this ESLint
line unsupported. Revisit the pair together rather than bypassing peer checks.

At initialization, npm audit reports moderate development-tool advisories through
minimatch (Stryker and typescript-eslint) and qs (typed-rest-client under Stryker).
The qs version is pinned upstream; npm update cannot replace it within that
constraint. No force downgrade or unverified cross-major override was applied.
These are not renderer dependencies. Recheck upstream fixes on toolchain updates;
`npm audit --omit=dev` checks the production dependency tree separately.

The CI packaging matrix has not run from this workspace. Native packaging,
signing/notarization, physical audio and SQLite runtime compatibility remain
separate gates. See verification.md for the evidence recipe.
