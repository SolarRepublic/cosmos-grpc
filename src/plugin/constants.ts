/**
 * Maximum size of gaps tolerated between proto message field numbers when generating decoders
 */
export const N_MAX_PROTO_FIELD_NUMBER_GAP = 12;

export const SR_IMPORT_TYPES_PROTO = '#/_types/';

export const XC_HINT_UNKNOWN = 0;
export const XC_HINT_SINGULAR = 1;
export const XC_HINT_BIGINT = 2;
export const XC_HINT_STRING = 4;
export const XC_HINT_BOOLEAN = 0; // 8;  // should not be used, booleans will become 0 | 1
export const XC_HINT_NUMBER = 0; // 16;  // should not be used, is default
export const XC_HINT_BYTES = 0; // 32;  // should not be used, is default

export const XC_HINT_SINGULAR_BIGINT = XC_HINT_SINGULAR | XC_HINT_BIGINT;
export const XC_HINT_SINGULAR_NUMBER = XC_HINT_SINGULAR | XC_HINT_NUMBER;
export const XC_HINT_SINGULAR_STRING = XC_HINT_SINGULAR | XC_HINT_STRING;

/**
 * By default, any field that is present in both the request and response (i.e., they have
 * identical names and types) will be omitted from the response
 */
export const A_EXCEPTIONAL_RETURNS = [];
