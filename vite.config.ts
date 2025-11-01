import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [svelte()],
    base: "./",
    build: {
        chunkSizeWarningLimit: 1024,
        assetsInlineLimit: 32768, // Larger limit to inline wasm files
        sourcemap: true,
        outDir: "./dist/",
    },
});
