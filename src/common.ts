import type {O} from 'ts-toolbelt';

import type {RpcImplementor} from './rpc-impl';
import type {FieldDescriptorProto} from 'google-protobuf/google/protobuf/descriptor_pb';
import type {TypeNode, Identifier, Expression} from 'typescript';

import {__UNDEFINED, snake} from '@blake.regalia/belt';
import {default as protobuf} from 'google-protobuf/google/protobuf/descriptor_pb';

import {access, arrayLit, call, castAs, ident, ternary, type, typeRef} from './ts-factory';

// destructure members from protobuf
const {
	FieldDescriptorProto: {
		Type: H_FIELD_TYPES,
	},
} = protobuf;

export type TsThingBare = {
	name: string;
	type: TypeNode;
	to_wire?: Expression;
	from_wire?: (yn_expr: Expression) => Expression;
	write?: string;
	// encode_type?: TypeNode;
	to_proto?: Expression;
};

export type TsThing = O.Compulsory<TsThingBare> & {
	field: FieldDescriptorProto.AsObject;
	id: Identifier;
	optional: boolean;
	to_proto?: Expression;
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
		type: k_impl.importType('../_core', 'WeakUint128'),
		write: 'v',
	}),

	// int64
	[H_FIELD_TYPES.TYPE_INT64]: si_field => ({
		name: `sg_${si_field}`,
		type: k_impl.importType('../_core', 'WeakUint128'),
		write: 'v',
	}),

	// string
	[H_FIELD_TYPES.TYPE_STRING](si_field, g_field) {
		// create default name
		let si_name = `s_${si_field}`;

		// create default type
		let yn_type: TypeNode = type('string');

		// route snake type
		if(si_field.endsWith('_address') || A_SEMANTIC_ACCOUNT.includes(si_field)) {
			si_name = `sa_${si_field.replace(/_address$/, '')}`;
			yn_type = k_impl.importType('../_core', 'WeakSecretAddr');
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
		};
	},

	// struct
	[H_FIELD_TYPES.TYPE_MESSAGE](si_field, g_field) {
		// locate source
		const sr_path = k_impl.path_to_type(g_field);

		// extract type reference ident
		const si_ref = g_field.typeName!.split('.').at(-1)!;

		// special override
		let g_mix = {};
		if('.cosmos.base.v1beta1.Coin' === g_field.typeName) {
			const s_ident = `a_${snake(si_field)}`;
			g_mix = {
				name: s_ident,
				type: k_impl.importType('../_core', 'SlimCoin'),
				to_proto: call('coin', __UNDEFINED, [ident(s_ident)]),
				// from_wire: yn_data => arrayLit([
				// 	access(s_ident, ''),
				// ]),
				write: 'b',
			};
		}

		// construct ts field
		return {
			name: `g_${snake(si_field)}`,
			type: k_impl.importType(`../types/${sr_path}`, si_ref),
			write: 'v',
			...g_mix,
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

			to_wire: ternary(ident(si_self), call('buffer_to_base64', [], [ident(si_self)]), ident('__UNDEFINED')) as Expression,

			from_wire: yn_data => call('base64_to_buffer', [], [castAs(yn_data, type('string'))]) as Expression,
		};
	},
});
