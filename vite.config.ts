import { svelte } from "@sveltejs/vite-plugin-svelte";
import { type PluginOption, defineConfig } from "vite";
import { JSDOM } from "jsdom";

const createSingleFilePlugin: PluginOption = {
    name: "create-single-file",
    enforce: "post",
    generateBundle: (_, bundle) => {
        let htmlFileName: string | null = null;
        let scriptFileName: string | null = null;
        let cssFileName: string | null = null;
        let workerFileName: string | null = null;

        const imageExtensions = [".png", ".svg", ".ico"] as const;
        type ImageExtensionName = (typeof imageExtensions)[number];
        const imageFileNames: [string, ImageExtensionName][] = [];

        for (const fileName in bundle) {
            if (fileName.endsWith(".html")) {
                if (htmlFileName !== null) {
                    throw Error("Expected only one html file");
                }
                htmlFileName = fileName;
            }

            if (fileName.endsWith(".js")) {
                if (bundle[fileName].type === "asset") {
                    if (workerFileName !== null) {
                        throw Error("Expected only one worker script file");
                    }
                    workerFileName = fileName;
                } else {
                    if (scriptFileName !== null) {
                        throw Error("Expected only one script file");
                    }
                    scriptFileName = fileName;
                }
            }

            if (fileName.endsWith(".css")) {
                if (cssFileName !== null) {
                    throw Error("Expected only one css file");
                }
                cssFileName = fileName;
            }

            for (const ext of imageExtensions) {
                if (fileName.endsWith(ext)) {
                    imageFileNames.push([fileName, ext]);
                    break;
                }
            }
        }

        if (htmlFileName === null) {
            throw Error("Expected to have a html file");
        }
        if (scriptFileName === null) {
            throw Error("Expected to have a script file");
        }
        if (cssFileName === null) {
            throw Error("Expected to have a css file");
        }
        if (workerFileName === null) {
            throw Error("Expected to have a worker script file");
        }

        const htmlFile = bundle[htmlFileName];
        const scriptFile = bundle[scriptFileName];
        const cssFile = bundle[cssFileName];
        const workerFile = bundle[workerFileName];
        if (
            htmlFile.type !== "asset" ||
            scriptFile.type !== "chunk" ||
            cssFile.type !== "asset" ||
            workerFile.type !== "asset"
        ) {
            throw Error("Unexpected bundled type");
        }

        if (typeof cssFile.source !== "string" || typeof workerFile.source !== "string") {
            throw Error("Expected file source to be a string");
        }

        const html = new JSDOM(htmlFile.source);
        const doc = html.window.document;

        // Inline script tag
        // All attributes are removed (e.g. crossorigin, type="module"), the code should work with a plain script tag
        // Also append the worker script contents at the start
        {
            const scriptTags = doc.getElementsByTagName("script");
            if (scriptTags.length !== 1) {
                throw Error("Expected exactly one script tag");
            }
            const scriptTag = scriptTags[0];
            const newScript = doc.createElement("script");

            // This variable name is used in the code
            const workerScriptDeclaration = `var workerScriptSource = ${JSON.stringify(workerFile.source)};\n`;

            newScript.textContent = workerScriptDeclaration + scriptFile.code;

            scriptTag.remove();
            doc.body.appendChild(newScript);

            delete bundle[scriptFileName];
            delete bundle[workerFileName];
        }

        // Inline css
        // Find the tag that comes from the local css file
        {
            const linkTags = doc.getElementsByTagName("link");

            let foundCssFile = false;
            for (const tag of linkTags) {
                if (tag.rel === "stylesheet" && tag.href.endsWith(cssFileName)) {
                    tag.remove();

                    const styleTag = doc.createElement("style");
                    styleTag.textContent = cssFile.source;
                    doc.head.appendChild(styleTag);

                    foundCssFile = true;
                    delete bundle[cssFileName];
                    break;
                }
            }

            if (!foundCssFile) {
                throw Error("Could not find css file");
            }
        }

        // Inline icons
        {
            const linkTags = doc.getElementsByTagName("link");

            const mimeTypes: Record<ImageExtensionName, string> = {
                ".png": "image/png",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon", // For favicon only
            };

            for (const tag of linkTags) {
                if (tag.rel === "icon") {
                    // Find image in the list of images, remove from the list if found

                    for (let i = 0; i < imageFileNames.length; ++i) {
                        const [imageFileName, ext] = imageFileNames[i];

                        if (tag.href.endsWith(imageFileName)) {
                            const file = bundle[imageFileName];
                            if (file.type !== "asset" || typeof file.source === "string") {
                                throw Error("Image file must be an asset, and must binary");
                            }

                            const base64 = Buffer.from(file.source).toString("base64");
                            const dataUrl = `data:${mimeTypes[ext]};base64,${base64}`;

                            tag.href = dataUrl;

                            delete bundle[imageFileName];
                            imageFileNames.splice(i, 1);
                            break;
                        }
                    }
                }
            }
        }

        htmlFile.source = html.serialize();
    },
};

export default defineConfig(env => {
    const createSingleFile = env.mode === "singlefile";

    return {
        plugins: [svelte(), createSingleFile ? createSingleFilePlugin : null],
        base: "./",
        build: {
            chunkSizeWarningLimit: 1024,
            assetsInlineLimit: () => true, // Inline everything
            sourcemap: !createSingleFile, // Disable source maps for single file builds - since it combines multiple files, source maps won't work
            outDir: "./dist/",

            // Create the least amount of files
            cssCodeSplit: false,
            rollupOptions: {
                output: {
                    inlineDynamicImports: true,
                },
            },
        },
    };
});
