import { reactConfig } from "@cubeforge/config-eslint";

export default [
  ...reactConfig,
  {
    ignores: ["dist/**", "postcss.config.js", "tailwind.config.js"]
  }
];
