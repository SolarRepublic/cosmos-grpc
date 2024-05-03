import type {O} from 'ts-toolbelt';

import type {PropagateUndefined} from './types';
import type {Nilable} from '@blake.regalia/belt';
import type {SlimCoin} from '@solar-republic/types';

import {ATU8_NIL, __UNDEFINED, bytes, dataview, text_to_bytes} from '@blake.regalia/belt';

type NodeValue = number | bigint | number[] | Uint8Array;

type Encoder<
	w_node extends NodeValue=NodeValue,
> = (atu8_out: Uint8Array, ib_write: number, w_value: w_node) => any;

type BufNode = [
	write: Encoder<any>,
	value: NodeValue,
	length: number,
	next?: BufNode | null,
];

type WireType = 0 | 1 | 2 | 5;

// type Nester = (k_writer: ProtoWriter, ...a_args: any[]) => ProtoWriter;

export interface ProtoWriterScalar {
	v(xn_value?: Nilable<boolean | number>, i_field?: number): this;
	g(xg_value?: Nilable<bigint | `${bigint}` | ''>, i_field?: number): this;
	i(x_value?: Nilable<number>, i_field?: number): this;
	b(atu8_bytes?: Nilable<Uint8Array | number[]>, i_field?: number): this;
	s(s_data?: Nilable<string>, i_field?: number): this;
}

export interface ProtoWriter extends ProtoWriterScalar {
	V(a_values?: Nilable<Array<Parameters<ProtoWriterScalar['v']>[0]>>, i_field?: number): this;
	G(a_values?: Nilable<Array<Parameters<ProtoWriterScalar['g']>[0]>>, i_field?: number): this;
	I(a_values?: Nilable<Array<Parameters<ProtoWriterScalar['i']>[0]>>, i_field?: number): this;
	B(a_buffers?: Nilable<Array<Parameters<ProtoWriterScalar['b']>[0]>>, i_field?: number): this;
	S(a_data?: Nilable<Array<Parameters<ProtoWriterScalar['s']>[0]>>, i_field?: number): this;
	// n<f_nester extends Nester>(xn_wire_sub: WireType, i_field: number, f_call: f_nester, ...a_args: L.Tail<Parameters<f_nester>>): ProtoWriter;
	get o(): Uint8Array;
}

export type ProtoWriterMethod = O.SelectKeys<ProtoWriter, Function>;

const encode_varint32: Encoder<number> = (atu8_out, ib_write, n_value) => {
	while(n_value > 127) {
		atu8_out[ib_write++] = (n_value & 0x7f) | 0x80;
		n_value >>>= 7;
	}

	atu8_out[ib_write] = n_value;
};

const encode_biguint: Encoder<bigint> = (atu8_out, ib_write, xg_value) => {
	while(xg_value > 127n) {
		atu8_out[ib_write++] = Number(xg_value & 0x7fn) | 0x80;
		xg_value >>= 7n;
	}

	atu8_out[ib_write] = Number(xg_value);
};

const encode_bytes: Encoder<Uint8Array> = (atu8_out, ib_write, atu8_data) => atu8_out.set(atu8_data, ib_write);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Protobuf = (): ProtoWriter => {
	// @ts-expect-error low-optimization
	// eslint-disable-next-line prefer-const
	let a_head: BufNode = [];
	// eslint-disable-next-line prefer-const
	let a_tail: BufNode = a_head;

	// output buffer byte count
	let cb_buffer = 0;

	// auto-incrementing field index
	let i_auto = 1;

	// write a varint to the output
	const varint = (xn_value: number) => push([
		encode_varint32,
		xn_value,
		xn_value < 0x80? 1
			: xn_value < 0x4000? 2
				: xn_value < 0x200000? 3
					: xn_value < 0x10000000? 4
						: 5,
	]);

	// write the (field | wire type) byte
	const field = (i_field: number, xn_wire: WireType=2) => ((i_auto=i_field+1, varint((i_field << 3) | xn_wire)));

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const push = (a_node: BufNode) => {
		// add to cumulative length
		cb_buffer += a_node[2];

		// set pointer to next node in linked list
		a_tail[3] = a_node;

		// advance floating tail
		a_tail = a_node;

		// for chaining
		return g_self;
	};

	// map an array of items to a repeated field type
	const map_self = <
		si_key extends keyof ProtoWriterScalar,
	>(si_key: si_key) => (
		a_items?: NonNullable<Parameters<ProtoWriterScalar[si_key]>[0]>[],
		i_field=i_auto
	) => ((
		a_items?.map(w_item => g_self[si_key](w_item as never, i_field)),
		g_self
	));

	const g_self: ProtoWriter = {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		v: (xn_value, i_field=i_auto++) => xn_value && +xn_value? (field(i_field, 0), varint(xn_value as number)): g_self,

		g: (xg_value, i_field=i_auto++) => {
			if(!xg_value) return g_self;

			// normalize possible string
			xg_value = BigInt(xg_value);

			// count how many bytes are needed to store this biguint
			let nb_biguint = 1;
			let xg_copy = xg_value;
			while(xg_copy > 127n) {
				nb_biguint++;
				xg_copy >>= 7n;
			}

			return 0n === xg_value? g_self: (field(i_field, 0), push([
				encode_biguint,
				xg_value,
				nb_biguint,
			]));
		},

		i: (x_value, i_field=i_auto++, atu8_data=bytes(8), dv_view=dataview(atu8_data.buffer)) => x_value
			? (field(i_field, 5), dv_view.setFloat64(0, x_value), push([encode_bytes, atu8_data, 8]))
			: g_self,

		b: (atu8_bytes, i_field=i_auto++) => {
			if(!atu8_bytes?.length) return g_self;

			const nb_bytes = atu8_bytes.length;

			return (
				field(i_field),
				varint(nb_bytes),
				push([
					encode_bytes,
					atu8_bytes,
					nb_bytes,
				])
			);
		},

		s: (s_data, i_field=i_auto++) => s_data? g_self.b(text_to_bytes(s_data), i_field): g_self,

		V: map_self('v'),
		G: map_self('g'),
		I: map_self('i'),
		B: map_self('b'),
		S: map_self('s'),

		// eslint-disable-next-line @typescript-eslint/naming-convention
		// n: (i_field, xn_wire_sub, f_call, ...a_args) => g_self.b(f_call(Protobuf(xn_wire_sub), ...a_args).o(), i_field),

		get o(): Uint8Array {
			// eslint-disable-next-line prefer-const
			let atu8_out = bytes(cb_buffer);

			// write offset
			let ib_write = 0;

			// node pointer
			let a_node = a_head[3];

			// iterate thru linked list
			while(a_node) {
				const [f_encode, w_value, nb_length, a_next] = a_node;

				// commit node to output
				f_encode(atu8_out, ib_write, w_value);

				// advance write head by internal length
				ib_write += nb_length;

				// traverse linked list
				a_node = a_next;
			}

			return atu8_out;
		},
	};

	return g_self;
};

export const map = <
	w_item,
	w_out,
>(a_items: Nilable<w_item[]>, f_call: (w_item: w_item) => w_out) => a_items?.map(w => f_call(w)) as NonNullable<w_out>[] | undefined;

export const apply_opt = <
	w_item,
	w_out,
>(w_item: w_item | undefined, f_call: (w_item: w_item) => w_out): w_out | undefined => w_item? f_call(w_item): __UNDEFINED;

export const temporal = (xn_milliseconds: Nilable<number>): Uint8Array => xn_milliseconds? Protobuf()
	.v((xn_milliseconds / 1e3) | 0)
	.v((xn_milliseconds % 1e3) * 1e6)
	.o: ATU8_NIL;

export const any = (si_type: string, atu8_value: Uint8Array): Uint8Array => Protobuf()
	.s(si_type)
	.b(atu8_value)
	.o;

export const coin = <
	a_coin extends SlimCoin | undefined | null,
>(a_coin: a_coin): Uint8Array | PropagateUndefined<a_coin> => (
	a_coin
		? Protobuf()
			.s(a_coin[1])
			.s(a_coin[0])
			.o
		: __UNDEFINED
) as Uint8Array | PropagateUndefined<a_coin>;

export const coins = (a_coins: Nilable<SlimCoin[]>): Uint8Array[] | undefined => map(a_coins, coin);

export const slimify_coin = (g_coin?: {
	denom?: string | undefined;
	amount?: string | undefined;
}) => g_coin? [g_coin.amount!, g_coin.denom!] as SlimCoin: __UNDEFINED;

