/**
 * Vite supports `?raw` imports (the file's text as a string) at build/test time,
 * but `tsc` needs an ambient declaration for them. The i18n messages-parity test
 * uses this to scan the raw JSON text for duplicate keys — `JSON.parse` silently
 * keeps the last occurrence, so the parsed object cannot reveal them.
 */
declare module '*?raw' {
  const content: string;
  export default content;
}
