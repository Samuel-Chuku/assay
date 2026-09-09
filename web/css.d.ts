/**
 * Next ships declarations for `*.module.css` but not for plain `*.css`, because
 * a global stylesheet is resolved by the bundler and produces no bindings.
 * TypeScript 6 rejects a side-effect import of an undeclared module where 5.x
 * let it pass, so `import './tokens.css'` in layout.tsx needs this.
 *
 * Deliberately empty: a global stylesheet exports nothing, and typing it as
 * `any` would invite someone to import a value from it.
 */
declare module '*.css';
