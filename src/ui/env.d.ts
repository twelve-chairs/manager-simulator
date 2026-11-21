/// <reference types="vite/client" />

/** The version the build stamped (see scripts/version.ts and vite.config.ts). */
declare const __APP_VERSION__: string;

/** The situation bundle compiled from content/situations at build time (see vite.config.ts). */
declare module 'virtual:situations' {
  const bundle: unknown;
  export default bundle;
}
