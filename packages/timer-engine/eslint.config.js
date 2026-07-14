import { baseConfig } from "@cubeforge/config-eslint";

export default [
  ...baseConfig,
  {
    ignores: ["dist/"]
  }
];
