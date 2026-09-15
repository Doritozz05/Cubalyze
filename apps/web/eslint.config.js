import { reactConfig } from "@cubalyze/config-eslint";

export default [
  ...reactConfig,
  {
    ignores: ["dist/**", "scripts/**", "postcss.config.js", "tailwind.config.js"]
  }
];
