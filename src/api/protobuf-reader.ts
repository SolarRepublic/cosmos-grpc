/* eslint-disable prefer-const */

import type {NestedArrayable} from '@blake.regalia/belt';
import type {SlimCoin} from '@solar-republic/types';

import {buffer_to_text} from '@blake.regalia/belt';

export type DecodedProtobufFieldPrimitive<w_inject=never> = w_inject | number | string | Uint8Array;

export type DecodedProtobufField<w_inject=never> = NestedArrayable<DecodedProtobufFieldPrimitive<w_inject>>;

export type DecodedProtobufMessage<w_inject=never> = DecodedProtobufField<w_inject>[];


/**
 * Hints control the handling of decoded fields
 */
export const enum ProtoHint {
	/**
	 * No hint, use default behavior
	 */
	NONE=0,

	/**
	 * Indicates that field is not repeated, returns the last value under that field instead of an array
	 */
	SINGULAR=1,

	/**
	 * Indicates that the varint could exceed precision of `number` so it should be converted into a string for ES compatibility
	 */
	BIGINT=2,

	/**
	 * Shortcut for `ProtoHint.SINGULAR | ProtoHint.BIGINT`
	 */
	SINGULAR_BIGINT=3,  // SINGULAR | BIGINT

	/**
	 * Indicates that the varint should be converted into a string
	 */
	STRING=4,

	/**
	 * Shortcut for `ProtoHint.SINGULAR | ProtoHint.STRING`
	 */
	SINGULAR_STRING=5,  // SINGULAR | STRING
}


// type HintsApplied<
// 	a_hints extends ProtoHint[],
// > = {
// 	[i_key in keyof a_hints & number]: [
// 		DecodedProtobufFieldPrimitive[],  // unknown
// 		DecodedProtobufFieldPrimitive,  // singular
// 		string[],  // bigint
// 		string[],  // string
// 		string,  // singular bigint
// 		string,  // singular bigint
// 	][a_hints[i_key]];
// }[keyof a_hints & number];

// type test = HintsApplied<[0, 1, 2, 3, 4, 5]>;

/**
 * Decodes a protobuf buffer without requiring a schema. By default, every field is assumed to be repeatable,
 * and thus is returned as an array of values (without a schema, the decoder has no way of knowing if there
 * will be more values for any given field).
 * 
 * However, 'hints' can be provided to control the handling of decoded fields: see {@link ProtoHint}
 * 
 * @returns an Array of decoded fields, where the field's number corresponds to its position in the (possibly sparse) Array.
 * 
 * For example:
 * ```protobuf
 * message Info {
 *   uint32 foo = 1;
 *   repeated string bar = 2;
 *   uint64 baz = 5;
 *   string high = 1025;
 * }
 * ```
 *  becomes:
 * ```
 * [empty, foo, bar, ..empty x 2, baz]
 * ```
 * where `foo`, `bar` and `baz` are all Arrays,
 *  e.g., `foo[0]` contains the single item for the `foo` field.
 * 
 * Decoding an instance of the `Info` message example above with hints might look like this:
 * ```
 * // notice the two empty elements in the middle denoted by `,,`
 * const [, foo, bar, ,, baz] = decode_protobuf<
 * 	[never, number, string[], ,, string]
 * >(atu8_msg, [ProtoHint.SINGULAR, ProtoHing.STRING, ,, ProtoHint.SINGULAR_BIGINT])
 * ```
 * 
 * Notice the use of `never` for position 0. This is required to maintain consistency with the 1-based index
 * used by protobuf fields, ensuring that arbitrarily high indexes can be accessed using their matching id.
 * 
 * ```
 * const a_arbitrary = decode_protobuf(atu8_msg);
 * 
 * a_arbitrary[1025];  // <-- [string]
 * ```
 */
export const decode_protobuf = <
	w_intent extends DecodedProtobufMessage<void>=DecodedProtobufMessage,
	w_return extends DecodedProtobufMessage<void>=w_intent extends any[]
		? w_intent extends [never, ...any[]]? w_intent: never
		: w_intent,
>(atu8_data: Uint8Array, a_hints?: NestedArrayable<ProtoHint>[]): w_return => {
	// decode a varint from the next position in the input
	let varint = <
		w_format extends string | number=number,
	>(xc_hint?: ProtoHint): w_format => {
		let xn_out = 0;
		let xi_shift = -7;

		// until terminal byte is encountered (or exceed the bounds of the buffer and throw)
		for(;;) {
			// read the byte
			let xb_read = atu8_data[ib_read++];

			// OR into place
			xn_out |= (xb_read & 0x7f) << (xi_shift += 7);

			// terminal byte
			if(!(xb_read & 0x80)) return (ProtoHint.BIGINT & xc_hint!? xn_out+'': xn_out) as w_format;
		}
	};

	// read position in bytes
	let ib_read = 0;

	// 1-based protobuf field index
	let i_field = 1;

	// outputs of decoded fields
	let a_out: DecodedProtobufField[] = [];

	// while bytes remain in input buffer
	for(; ib_read<atu8_data.length;) {
		// decode field & type
		let xn_field_and_type = varint();
		let xn_field = xn_field_and_type >> 3;
		let xn_type = xn_field_and_type & 0x07;

		// invalid field index (precedes previous or lowest) or not the expected field type
		if(xn_field < i_field || xn_type > 2) {
			return atu8_data as unknown as w_return;
		}

		// ref provided hint, if any
		let xc_hint_local = a_hints?.[i_field-1] as ProtoHint;

		// length-delimited
		let w_value = [
			// varint
			varint,

			// i64
			// @ts-expect-error paren-less param
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			_ => 'i64',

			// len (string, bytes, embedded, etc.)
			// eslint-disable-next-line @typescript-eslint/no-loop-func
			(w_hint?: ProtoHint) => {
				// decode len prefix
				let nb_read = varint();

				// init start position
				let ib_start = ib_read;

				// advance read pointer byte len bytes to end position
				ib_read += nb_read;

				// decode that portion of the buffer
				const w_read = decode_protobuf(
					atu8_data.subarray(ib_start, ib_read),
					((w_hint as number) > 0? []: w_hint) as ProtoHint[]
				);

				// apply hint, expecting non-protobuf messages to be returned as raw bytes
				return ProtoHint.STRING & (w_hint as number)? buffer_to_text(w_read as unknown as Uint8Array): w_read;
			},
		][xn_type](xc_hint_local);

		// hint is that field is not repeated; set directly instead of pushing to result slot array
		if(xc_hint_local & ProtoHint.SINGULAR) {
			a_out[i_field=xn_field] = w_value;
		}
		// field can possibly repeat; add to slot array
		else {
			((a_out[i_field=xn_field] ??= []) as DecodedProtobufField[]).push(w_value as DecodedProtobufField);
		}
	}

	return a_out as w_return;
};


export const decode_protobuf_r0 = <
	w_return extends DecodedProtobufField,
>(
	atu8_payload: Uint8Array,
	a_hints?: ProtoHint[]
): w_return => decode_protobuf<DecodedProtobufMessage>(atu8_payload, a_hints)[0] as w_return;


export const decode_protobuf_r0_0 = <
	w_return extends DecodedProtobufField,
>(
	atu8_payload: Uint8Array,
	a_hints?: ProtoHint[]
): w_return => decode_protobuf<DecodedProtobufField[][]>(atu8_payload, a_hints)[0][0] as w_return;


export const decode_coin = <
	s_denom extends string=string,
>(
	atu8_payload: Uint8Array,
	[, s_denom, s_amount]=decode_protobuf<
		[never, string, string]
	>(atu8_payload, [ProtoHint.SINGULAR_STRING, ProtoHint.SINGULAR_STRING])
): SlimCoin<s_denom> => [s_amount, s_denom as s_denom] as SlimCoin<s_denom>;


/**
 * Reduces a parsed google.protobuf.Timestamp into whole milliseconds
 */
export const reduce_temporal = (
	[sg_seconds, xn_nanos]: [string, number]
): number => (+sg_seconds * 1e3) + ((xn_nanos / 1e6) | 0);

