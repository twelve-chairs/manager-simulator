/// <reference types="vite/client" />

/** The situation bundle compiled from content/situations at build time (see vite.config.ts). */
declare module 'virtual:situations' {
  const bundle: unknown;
  export default bundle;
}
