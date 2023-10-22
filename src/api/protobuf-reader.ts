/* eslint-disable prefer-const */

import type {SlimCoin} from './types';

import {buffer_to_text} from '@blake.regalia/belt';

export type Field = boolean | number | bigint | string | DecodedProtobuf;

type Message = Field[][];

export type DecodedProtobuf = Uint8Array | Message;


/**
 * No hint, use default behavior
 */
export const XC_HINT_UNKNOWN = 0;

/**
 * Indicates that field is not repeated, returns the last value under that field instead of an array
 */
export const XC_HINT_SINGULAR = 1;

/**
 * Indicates that the varint should be converted into a string
 */
export const XC_HINT_BIGINT = 2;

/**
 * Indicates that the bytes should be utf8-decoded
 */
export const XC_HINT_STRING = 4;

/**
 * Shortcut for `XC_HINT_SINGULAR & XC_HINT_STRING`
 */
export const XC_HINT_SINGULAR_BIGINT = (XC_HINT_SINGULAR & XC_HINT_BIGINT) as 3;

/**
 * Shortcut for `XC_HINT_SINGULAR & XC_HINT_STRING`
 */
export const XC_HINT_SINGULAR_STRING = (XC_HINT_SINGULAR & XC_HINT_STRING) as 5;


/**
 * Specifies how a field should be decoded before it is returned
 */
export type ProtoHint =
	| typeof XC_HINT_UNKNOWN
	| typeof XC_HINT_SINGULAR
	| typeof XC_HINT_BIGINT
	| typeof XC_HINT_STRING
	| typeof XC_HINT_SINGULAR_STRING;

type ProtoHints = (ProtoHints | ProtoHint)[];

/**
 * Decodes a protobuf buffer without requiring a schema. By default, every field is assumed to be repeatable,
 * and thus is returned as an array of values (without a schema, the decoder has no way of knowing if there
 * will be more values for any given field).
 * 
 * However, 'hints' can be provided to control the handling of decoded fields:
 *  - {@link XC_HINT_SINGULAR}
 *  - {@link XC_HINT_BIGINT}
 *  - {@link XC_HINT_STRING}
 * 
 * @returns an Array of decoded fields, where the field's number corresponds to its position in the (possibly sparse) Array.
 * 
 * For example:
 * ```protobuf
 * message Info {
 *   uint32 foo = 1;
 *   repeated string bar = 2;
 *   uint64 baz = 5;
 * }
 * ```
 *  becomes:
 * ```
 * [foo, bar, ..empty x 2, baz]
 * ```
 * where `foo`, `bar` and `baz` are all Arrays,
 *  e.g., `foo[0]` contains the single item for the `foo` field.
 * 
 * Decoding an instance of the `Info` message example above with hints might look like this:
 * ```
 * // notice the two empty elements denoted by `,,`
 * const [foo, bar, ,, baz] = decode_protobuf<
 * 	[number, string[], ,, string]
 * >(atu8_msg, [XC_HINT_SINGULAR, XC_HINT_STRING, ,, XC_HINT_SINGULAR_BIGINT])
 * ```
 */
export const decode_protobuf = <
	w_return extends DecodedProtobuf | Field[],
>(atu8_data: Uint8Array, a_hints?: ProtoHints): w_return => {
	let varint = <
		w_format extends string | number=number,
	>(xc_hint?: ProtoHint): w_format => {
		let xn_out = 0;
		let xi_shift = -7;

		for(;;) {
			// read the byte
			let xb_read = atu8_data[ib_read++];

			// OR into place
			xn_out |= (xb_read & 0x7f) << (xi_shift += 7);

			// terminal byte
			if(!(xb_read & 0x80)) return (XC_HINT_BIGINT & xc_hint!? xn_out+'': xn_out) as w_format;
		}
	};

	let ib_read = 0;

	let i_field = 0;
	let a_out: Message | Field[] = [];

	for(; ib_read<atu8_data.length;) {
		let xn_field_and_type = varint();
		let xn_field = (xn_field_and_type >> 3) - 1;
		let xn_type = xn_field_and_type & 0x07;

		// not the expected field index or expected type
		if(xn_field < i_field || xn_field > i_field + 1 || xn_type > 2) {
			return atu8_data as w_return;
		}

		// original
		// (a_out[i_field = xn_field] || (a_out[i_field] = [])).push([

		let xc_hint_local = a_hints?.[i_field] as ProtoHint & ProtoHints;

		// length-delimited
		let w_value = [
			// varint
			varint,

			// i64
			// @ts-expect-error paren-less param
			_ => 'i64',

			// len (string, bytes, embedded, etc.)
			// eslint-disable-next-line @typescript-eslint/no-loop-func
			(w_hint?: ProtoHint | ProtoHints) => {
				let nb_read = varint();
				let ib_start = ib_read;
				ib_read += nb_read;

				const w_read = decode_protobuf(
					atu8_data.subarray(ib_start, ib_read),
					((w_hint as ProtoHint) > 0? []: w_hint) as ProtoHints
				);

				return XC_HINT_STRING & (w_hint as number)? buffer_to_text(w_read as Uint8Array): w_read;
			},
		][xn_type](xc_hint_local);

		if(xc_hint_local & XC_HINT_SINGULAR) {
			a_out[i_field=xn_field] = w_value;
		}
		else {
			((a_out[i_field=xn_field] || (a_out[i_field] = [])) as Field[]).push(w_value as Field);
		}
	}

	return a_out as w_return;
};


export const decode_protobuf_r0 = <
	w_return extends DecodedProtobuf,
>(
	atu8_payload: Uint8Array,
	a_hints?: ProtoHints
): w_return => decode_protobuf<Message>(atu8_payload, a_hints)[0] as w_return;


export const decode_protobuf_r0_0 = <
	w_return extends DecodedProtobuf,
>(
	atu8_payload: Uint8Array,
	a_hints?: ProtoHints
): w_return => decode_protobuf<Message>(atu8_payload, a_hints)[0][0] as w_return;

// export const decode_timestamp = (atu8_payload: Uint8Array, [[xt_seconds]]=decode_protobuf(atu8_payload)) => xt_seconds;

export const decode_coin = <
	s_denom extends string=string,
>(
	atu8_payload: Uint8Array,
	[[s_denom], [s_amount]]=decode_protobuf<
		[string, string]
	>(atu8_payload, [XC_HINT_SINGULAR_STRING, XC_HINT_SINGULAR_STRING])
): SlimCoin<s_denom> => [s_amount, s_denom] as SlimCoin<s_denom>;


/**
 * Reduces a parsed google.protobuf.Timestamp into whole milliseconds
 */
export const reduce_temporal = (
	[xn_seconds, xn_nanos]: [number, number]
): number => (xn_seconds * 1e3) + ((xn_nanos / 1e6) | 0);
