/// <reference types="astro/client" />

// Plain `tsc` has no Astro language plugin, so give `.astro` imports (used by the
// container render tests) a component type.
declare module '*.astro' {
  const Component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default Component;
}
