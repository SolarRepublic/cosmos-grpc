import type {O} from 'ts-toolbelt';

import type {FieldDescriptorProtoWithComments} from './env';
import type {RpcImplementor} from './rpc-impl';
import type {FieldDescriptorProto} from 'google-protobuf/google/protobuf/descriptor_pb';
import type {TypeNode, Identifier, Expression} from 'typescript';

import {__UNDEFINED, snake, type Dict} from '@blake.regalia/belt';
import {default as protobuf} from 'google-protobuf/google/protobuf/descriptor_pb';

import {access, arrayLit, call, castAs, ident, ternary, type, typeRef, union} from './ts-factory';

// destructure members from protobuf
const {
	FieldDescriptorProto: {
		Type: H_FIELD_TYPES,
	},
} = protobuf;

export type TsThingBare = {
	name: string;
	type: TypeNode;

	proto_name?: string;
	proto_type?: TypeNode;

	to_wire?: Expression;
	from_wire?: (yn_expr: Expression) => Expression;

	write?: string;
	to_proto?: Expression;

	nests?: null | ((yn_data: Expression) => Expression);  // the field uses some other message for its type (for decoding)
};

export type TsThing = Required<TsThingBare> & {
	field: FieldDescriptorProtoWithComments;
	id: Identifier;
	optional: boolean;
};

const route_not_impl = (si_field: string) => {
	throw new Error(`Route not implemented for ${si_field} field type`);
};


export type FieldRouter = Record<
	FieldDescriptorProto.Type,
	(si_field: string, g_field: FieldDescriptorProto.AsObject) => TsThingBare
>;

const A_SEMANTIC_ACCOUNT = [
	'creator',
	'voter',
	'depositor',
	'granter',
	'grantee',
];

const temporal = (g_field: FieldDescriptorProto.AsObject, k_impl: RpcImplementor): Partial<TsThingBare> => {
	const s_ident = `xt_${snake(g_field.name!)}`;
	return {
		name: s_ident,
		type: type('number'),
		to_proto: call('timestamp', [ident(s_ident)]),
		write: 'b',
		proto_name: `atu8_${snake(g_field.name!)}`,
		proto_type: typeRef('Uint8Array'),
		nests: yn_data => call(ident('decode_protobuf_r0'), [yn_data], [type('number')]),
	};
};

// special overrides
const H_OVERRIDE_MIXINS: Dict<(g_field: FieldDescriptorProto.AsObject, k_impl: RpcImplementor) => Partial<TsThingBare> | undefined> = {
	// Coin
	'.cosmos.base.v1beta1.Coin'(g_field, k_impl) {
		const s_ident = `a_${snake(g_field.name!)}`;
		return {
			name: s_ident,
			type: k_impl.importType('../_core', 'SlimCoin'),
			to_proto: call('coin', [ident(s_ident)]),
			write: 'b',
			proto_name: `atu8_${snake(g_field.name!)}`,
			proto_type: typeRef('Uint8Array'),
			nests: yn_data => call(ident('decode_coin'), [yn_data], [typeRef('SlimCoin')]),
		};
	},

	// Timestamp
	'.google.protobuf.Timestamp': temporal,

	// Duration
	'.google.protobuf.Duration': temporal,

	// Any
	'.google.protobuf.Any'(g_field, k_impl) {
		const g_opts = g_field.options as {acceptsInterface?: string} | undefined;
		if(g_opts?.acceptsInterface) {
			return {
				name: `atu8_${g_field.name!}`,
				// type: union(g_opts.acceptsInterfaceList.map(si => k_impl.importType('../type/_interfaces.ts', `Any${si}`))),
				type: k_impl.importType('../type/_interfaces.ts', `Any${g_opts.acceptsInterface}`),
				write: 'b',
			};
		}

		return {};
	},
};

// field transformers
export const field_router = (k_impl: RpcImplementor): FieldRouter => ({
	[H_FIELD_TYPES.TYPE_GROUP]: route_not_impl,

	[H_FIELD_TYPES.TYPE_FLOAT]: route_not_impl,
	[H_FIELD_TYPES.TYPE_DOUBLE]: route_not_impl,

	[H_FIELD_TYPES.TYPE_FIXED32]: route_not_impl,
	[H_FIELD_TYPES.TYPE_FIXED64]: route_not_impl,

	[H_FIELD_TYPES.TYPE_SFIXED32]: route_not_impl,
	[H_FIELD_TYPES.TYPE_SFIXED64]: route_not_impl,

	[H_FIELD_TYPES.TYPE_SINT32]: route_not_impl,
	[H_FIELD_TYPES.TYPE_SINT64]: route_not_impl,

	// boolean
	[H_FIELD_TYPES.TYPE_BOOL]: si_field => ({
		name: `b_${si_field}`,
		type: type('boolean'),
	}),

	// uint32
	[H_FIELD_TYPES.TYPE_UINT32]: si_field => ({
		name: `n_${si_field}`,
		type: type('number'),
		write: 'v',
	}),

	// int32
	[H_FIELD_TYPES.TYPE_INT32]: si_field => ({
		name: `n_${si_field}`,
		type: type('number'),
		write: 'v',
	}),

	// uint64
	[H_FIELD_TYPES.TYPE_UINT64]: si_field => ({
		name: `sg_${si_field}`,
		type: k_impl.importType('../_core', 'WeakUint64Str'),
		return_type: k_impl.importType('../_core', 'Uint64Str'),
		write: 'v',
		proto_name: `atu8_${si_field}`,
		proto_type: typeRef('Uint8Array'),

	}),

	// int64
	[H_FIELD_TYPES.TYPE_INT64]: si_field => ({
		name: `sg_${si_field}`,
		type: k_impl.importType('../_core', 'WeakInt64Str'),
		return_type: k_impl.importType('../_core', 'Int64Str'),
		write: 'v',
	}),

	// string
	[H_FIELD_TYPES.TYPE_STRING](si_field, g_field) {
		// create default name
		let si_name = `s_${si_field}`;

		// create default type
		let yn_type: TypeNode = type('string');
		let yn_return!: TypeNode;

		// route snake type
		if(si_field.endsWith('_address') || A_SEMANTIC_ACCOUNT.includes(si_field)) {
			si_name = `sa_${si_field.replace(/_address$/, '')}`;
			yn_type = k_impl.importType('../_core', 'WeakAccountAddr');
			yn_return = k_impl.importType('../core', 'AccountAddr');
		}
		else if(si_field.endsWith('_id')) {
			si_name = `si_${si_field.replace(/_id$/, '')}`;
		}
		else if('code_hash' === si_field) {
			si_name = `sb16_${si_field}`;
			yn_type = k_impl.importType('@solar-republic/contractor', 'HexLower');
		}

		// construct ts field
		return {
			name: si_name,
			type: yn_type,
			return_type: yn_return,
			write: 's',
		};
	},

	// enum
	[H_FIELD_TYPES.TYPE_ENUM](si_field, g_field) {
		// locate source
		const sr_path = k_impl.path_to_type(g_field, true);

		// extract type reference ident
		const si_ref = g_field.typeName!.split('.').at(-1)!;

		// construct ts field
		return {
			name: `sc_${snake(si_field)}`,
			type: k_impl.importType(`../types/${sr_path}`, si_ref),
			nests: yn_data => call(ident('decode_protobuf'), [yn_data]),
		};
	},

	// struct
	[H_FIELD_TYPES.TYPE_MESSAGE](si_field, g_field) {
		// locate source
		const sr_path = k_impl.path_to_type(g_field);

		// extract type reference ident
		const si_ref = g_field.typeName!.split('.').at(-1)!;

		// construct ts field
		return {
			name: `g_${snake(si_field)}`,
			type: k_impl.importType(`../types/${sr_path}`, si_ref),
			write: 'b',
			nests: yn_data => call(ident('decode_protobuf'), [yn_data]),
			...H_OVERRIDE_MIXINS[g_field.typeName!]?.(g_field, k_impl) || {
				proto_name: `atu8_${snake(si_field)}`,
				proto_type: k_impl.importType(`./${sr_path}`, `Any${si_ref}`),
			},
		};
	},

	// bytes
	[H_FIELD_TYPES.TYPE_BYTES](si_field, g_field) {
		// default to `unknown`
		const yn_type: TypeNode = typeRef('Uint8Array');

		const si_self = `atu8_${snake(si_field)}`;

		// construct ts field
		return {
			name: si_self,
			type: yn_type,
			write: 'b',

			to_wire: ternary(ident(si_self), call('buffer_to_base64', [ident(si_self)]), ident('__UNDEFINED')) as Expression,

			from_wire: yn_data => call('base64_to_buffer', [castAs(yn_data, type('string'))]) as Expression,
		};
	},
});

export const H_FIELD_TYPE_TO_HUMAN_READABLE: Dict = {
	[H_FIELD_TYPES.TYPE_BOOL]: 'boolean',
	[H_FIELD_TYPES.TYPE_BYTES]: 'bytes',
	[H_FIELD_TYPES.TYPE_INT32]: 'int32',
	[H_FIELD_TYPES.TYPE_INT64]: 'int32',
	[H_FIELD_TYPES.TYPE_UINT32]: 'uint32',
	[H_FIELD_TYPES.TYPE_UINT64]: 'uint64',
	[H_FIELD_TYPES.TYPE_STRING]: 'string',
};

export {H_FIELD_TYPES};
