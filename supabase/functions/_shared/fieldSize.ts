/**
 * Sentinel-2 reads the ground at 10 metres per pixel. A field smaller
 * than this doesn't reliably give Sentinel Hub's Statistical API enough
 * clean native pixels to average into one trustworthy NDVI number.
 *
 * Duplicated (not imported) from src/lib/fieldSize.ts on purpose: Edge
 * Functions run on Deno and deploy as a separate unit from the Vite
 * frontend bundle, so there's no single module both sides can import
 * from without a shared-package setup this project doesn't have. Keep
 * this value in sync with src/lib/fieldSize.ts by hand if it ever
 * changes — the two existing solely so each side has an import target
 * that reads the same as the other, rather than a magic number repeated
 * inline wherever it's used.
 */
export const MIN_RELIABLE_HECTARES = 0.5;
