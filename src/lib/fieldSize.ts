/**
 * Sentinel-2 reads the ground at 10 metres per pixel. A field smaller than
 * this doesn't give Sentinel Hub's Statistical API enough clean pixels to
 * average into one reliable NDVI number — the pipeline doesn't error out,
 * it just never gets a usable reading, which looks identical to "still
 * waiting" unless something actually says why. Shared between the Add
 * Field draw-time warning and the field-detail "no imagery" messaging, so
 * they always agree on the same number.
 */
export const MIN_RELIABLE_HECTARES = 0.5;
