export async function register() {
  // Polyfill localStorage when running in a Node.js environment where the
  // --localstorage-file flag produced a broken implementation.
  if (
    typeof localStorage === "undefined" ||
    typeof localStorage?.getItem !== "function"
  ) {
    const mem: Record<string, string> = {};
    (global as Record<string, unknown>).localStorage = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        Object.keys(mem).forEach((k) => delete mem[k]);
      },
      key: (i: number) => Object.keys(mem)[i] ?? null,
      get length() {
        return Object.keys(mem).length;
      },
    };
  }
}
