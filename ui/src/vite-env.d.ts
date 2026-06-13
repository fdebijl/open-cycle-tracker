/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Open Cycle Tracker API. Defaults to http://localhost:3000. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
