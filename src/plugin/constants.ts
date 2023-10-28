/**
 * Maximum size of gaps tolerated between proto message field numbers when generating decoders
 */
export const N_MAX_PROTO_FIELD_NUMBER_GAP = 12;

/**
 * By default, any field that is present in both the request and response (i.e., they have
 * identical names and types) will be omitted from the response
 */
export const A_EXCEPTIONAL_RETURNS = [];
