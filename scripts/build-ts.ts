import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { argv } from "node:process";
import {
    build,
    context,
    type BuildContext,
    type BuildOptions,
    type BuildResult,
    type OutputFile,
    type Plugin,
    type PluginBuild,
} from "esbuild";

const ENTRY_GLOBS: string[] = ["ts/*.ts", "ts/skyboxes/*.ts"];
const SKYBOX_OUTPUT_DIR: string = "static/wasm/skyboxes";
const TS_IMPORT_SPECIFIER_PATTERN: RegExp =
    /((?:["'`])(?:\.\/|\.\.\/)[^"'`\s;]+)\.ts(?=["'`])/g;

function writeRewrittenOutputs(buildResult: BuildResult): void {
    const generatedFiles: OutputFile[] = buildResult.outputFiles ?? [];
    for (
        let fileIndex: number = 0;
        fileIndex < generatedFiles.length;
        fileIndex++
    ) {
        const outputFile: OutputFile = generatedFiles[fileIndex];
        const rewrittenSource: string = outputFile.text.replace(
            TS_IMPORT_SPECIFIER_PATTERN,
            "$1.js"
        );
        const parentDirectory: string = dirname(outputFile.path);
        mkdirSync(parentDirectory, { recursive: true });
        writeFileSync(outputFile.path, rewrittenSource, "utf8");
    }
}

const REWRITE_TS_IMPORTS_PLUGIN: Plugin = {
    name: "rewrite-ts-imports",
    setup(pluginBuild: PluginBuild): void {
        pluginBuild.onEnd(writeRewrittenOutputs);
    },
};

const BUILD_CONFIGURATION: BuildOptions = {
    entryPoints: ENTRY_GLOBS,
    outdir: "static/wasm",
    outbase: "ts",
    bundle: false,
    write: false,
    format: "esm",
    target: "es2022",
    minify: true,
    charset: "utf8",
    legalComments: "none",
    plugins: [REWRITE_TS_IMPORTS_PLUGIN],
};

rmSync(SKYBOX_OUTPUT_DIR, { recursive: true, force: true });

const isWatchMode: boolean = argv.includes("--watch");
if (isWatchMode) {
    const watchContext: BuildContext = await context(BUILD_CONFIGURATION);
    await watchContext.watch();
} else {
    await build(BUILD_CONFIGURATION);
}
