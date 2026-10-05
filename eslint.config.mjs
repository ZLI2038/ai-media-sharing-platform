import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The src tree intentionally preserves the original React 18 frontend source verbatim.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'src/**', 'next-env.d.ts']),
]);

export default eslintConfig;
