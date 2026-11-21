declare module "node:fs" {
    export function mkdirSync(
        directoryPath: string,
        options: { readonly recursive: boolean }
    ): void;
    export function rmSync(
        targetPath: string,
        options: { readonly recursive: boolean; readonly force: boolean }
    ): void;
    export function writeFileSync(
        filePath: string,
        content: string,
        encoding: "utf8"
    ): void;
}

declare module "node:path" {
    export function dirname(filePath: string): string;
}

declare module "node:process" {
    export const argv: readonly string[];
}
