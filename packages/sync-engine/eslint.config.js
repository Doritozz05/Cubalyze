import { baseConfig } from "@cubalyze/config-eslint";

export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
