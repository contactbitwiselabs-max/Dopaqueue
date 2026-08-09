if (typeof document === 'undefined') {
  (globalThis as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({
      relList: { supports: () => true },
      setAttribute: () => {},
      addEventListener: (evt: string, cb: Function) => {
        if (evt === 'load') {
          setTimeout(cb, 0);
        }
      }
    }),
    head: { appendChild: () => {} },
    getElementsByTagName: () => [],
    querySelector: () => null,
  };
}

if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
}
