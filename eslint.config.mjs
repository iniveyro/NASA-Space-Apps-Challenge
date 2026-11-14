import { readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architecture boundaries (see AGENTS.md):
 * - src/app may import a feature only through its public API: "@/features/<name>".
 * - A feature may import another feature only through its public API.
 * - src/shared never imports features or app code.
 * - Features and routes never hard-code colors; they use design-system tokens.
 */
const FEATURES = readdirSync(new URL("./src/features", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const deepFeatureImport = (allowedFeature) => ({
  regex: allowedFeature ? `^@/features/(?!${allowedFeature}/)[^/]+/.+` : "^@/features/[^/]+/.+",
  message: "Import other features only through their public API: '@/features/<name>' (index.ts).",
});

const relativeCrossFeature = (feature) => {
  const others = FEATURES.filter((name) => name !== feature);
  return others.length
    ? [{ regex: `^(\\.\\./)+(${others.join("|")})(/|$)`, message: "Do not reach into another feature with relative paths. Use '@/features/<name>'." }]
    : [];
};

const noRawColors = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
      message: "Raw hex colors are not allowed here. Use a design token (theme.css) via a Tailwind class or readToken().",
    },
    {
      selector: "Literal[value=/-\\[(?:#|rgba?\\(|hsla?\\(|oklch\\()/]",
      message: "Arbitrary color values are not allowed. Use a design token class (e.g. bg-status-ok-surface).",
    },
    {
      selector: "TemplateElement[value.raw=/-\\[(?:#|rgba?\\(|hsla?\\(|oklch\\()/]",
      message: "Arbitrary color values are not allowed. Use a design token class (e.g. bg-status-ok-surface).",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**", "data/**", "scripts/**"]),
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [deepFeatureImport(null)] }],
      ...noRawColors,
    },
  },
  ...FEATURES.map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            deepFeatureImport(feature),
            ...relativeCrossFeature(feature),
            { regex: "^@/app(/|$)", message: "Features must not import route code from src/app." },
          ],
        },
      ],
      ...noRawColors,
    },
  })),
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: "^@/(features|app)(/|$)", message: "src/shared must stay feature-agnostic: never import features or app code." },
            { regex: "^(\\.\\./)+(features|app)(/|$)", message: "src/shared must stay feature-agnostic: never import features or app code." },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
