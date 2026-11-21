# dezzyne.com

Official website for Dezzyne, LLC.

## Stack

- **Static Site Generator:** [Zola](https://www.getzola.org/) (`0.23.6`)
- **Interactive Graphics:** Rust + WebAssembly, TypeScript (`esbuild` + `tsc`)
- **Hosting & Forms:** Netlify (deployed from `stable` via GitHub Actions)

## Local Development

```bash
yarn build
zola serve
```
