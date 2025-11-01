// @ts-check

import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type { import("@sveltejs/vite-plugin-svelte").SvelteConfig } */
const config = {
    preprocess: vitePreprocess({ script: true }),

    compilerOptions: {
        warningFilter: warning => !warning.code.startsWith("a11y"),
    },
};

export default config;
