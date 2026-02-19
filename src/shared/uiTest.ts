export const isUiTest = (() => {
  const env = ((import.meta as any).env ?? {}) as Record<string, string>;
  return env.MODE === "test" || env.VITE_UI_TEST === "1";
})();
