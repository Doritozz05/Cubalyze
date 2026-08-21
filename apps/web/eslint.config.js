import { reactConfig } from "@cubeforge/config-eslint";

export default [
  ...reactConfig,
  {
    ignores: ["dist/**", "scripts/**", "postcss.config.js", "tailwind.config.js"]
  }
];
