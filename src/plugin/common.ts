import type {AugmentedEnum, AugmentedField, AugmentedFile} from './env';
import type {NeutrinoImpl} from './impl-neutrino';
import type {RpcImplementor} from './rpc-impl';
import type {ProtoWriterMethod} from '../api/protobuf-writer';
import type {FieldDescriptorProto} from 'google-protobuf/google/protobuf/descriptor_pb';
import type {TypeNode, Identifier, Expression} from 'typescript';

import {snake, type Dict} from '@blake.regalia/belt';
import {default as protobuf} from 'google-protobuf/google/protobuf/descriptor_pb';

import {SR_IMPORT_TYPES_PROTO, XC_HINT_SINGULAR_NUMBER, XC_HINT_SINGULAR_STRING} from './constants';
import {call, ident, literal, string, type, typeLit, typeRef, union} from './ts-factory';

// destructure members from protobuf
const {
	FieldDescriptorProto: {
		Type: H_FIELD_TYPES,
	},
} = protobuf;

export type TsThingBare = {
	// when using the type as a parameter in an exported API function
	calls: {
		name: string;
		type: TypeNode;

		// some types have a stronger return
		return_type?: TypeNode;

		// how to encode the argument for use in JSON
		to_json?: Expression;

		// how to encode the argument for use in protobuf
		to_proto?: Expression;

		// how to convert a response value in JSON back to `type`
		from_json?: (yn_expr: Expression) => Expression;
	};

	// // when using the type to submit gateway request or parse a response
	// json: {

	// },

	proto: {
		// which method to use on the `Protobuf` writer
		writer: ProtoWriterMethod;

		type?: TypeNode;

		// indicates that encoders prefer to use the `calls` type in parameters
		prefers_call?: number;
	};

	nests?: null | {
		name: string;
		hints: Expression;
		parse: (yn_data: Expression) => Expression;
	};  // the field uses some other message for its type (for decoding)
};

export type TsThing = {
	field: AugmentedField;
	optional: boolean;

	calls: Required<TsThingBare['calls']> & {
		id: Identifier;
	};

	proto: Required<TsThingBare['proto']> & {
		name: string;
		id: Identifier;
	};

	nests: Required<TsThingBare['nests']>;
};

const route_not_impl = (si_field: string) => {
	throw new Error(`Route not implemented for ${si_field} field type`);
};


export type FieldRouter = Record<
	FieldDescriptorProto.Type,
	(si_field: string, g_field: AugmentedField) => TsThingBare
>;

const A_SEMANTIC_ACCOUNT_ADDR = [
	'sender',
	'creator',
	'delegator',
	'depositor',
	'grantee',
	'granter',
	'voter',

	'recipient',
	'owner',
	'new_owner',
];

type ThingDefMixin = Pick<TsThingBare, 'proto'> & Partial<Omit<TsThingBare, 'proto'>>;

const temporal = (g_field: AugmentedField, k_impl: RpcImplementor): ThingDefMixin => {
	const s_ident = `xt_${snake(g_field.name!)}`;
	return {
		calls: {
			name: s_ident,
			type: type('number'),
			to_proto: call('timestamp', [ident(s_ident)]),
		},

		proto: {
			writer: 'b',
			type: typeRef('Uint8Array'),
			prefers_call: 1,
		},

		nests: {
			name: `a_${snake(g_field.name!)}`,
			hints: literal([XC_HINT_SINGULAR_NUMBER, XC_HINT_SINGULAR_NUMBER]),
			parse: yn_data => call(ident('reduce_timestamp'), [yn_data]),
		},
	};
};

// special overrides
const H_OVERRIDE_MIXINS: Dict<
	(g_field: AugmentedField, k_impl: RpcImplementor) => ThingDefMixin | undefined
> = {
	// Coin
	'.cosmos.base.v1beta1.Coin'(g_field, k_impl) {
		const si_name = snake(g_field.name!);

		const s_ident = `a_${si_name}`;
		return {
			calls: {
				name: s_ident,
				type: typeRef('SlimCoin'),
				to_proto: call('coin', [ident(s_ident)]),
			},

			proto: {
				writer: 'b',
				type: typeRef('Uint8Array'),
				prefers_call: 1,
			},

			nests: {
				name: `a_${si_name}`,
				hints: literal([XC_HINT_SINGULAR_STRING, XC_HINT_SINGULAR_STRING]),
				parse: yn_data => call(ident('decode_coin'), [yn_data], [typeRef('SlimCoin')]),
			},
		};
	},

	// Timestamp
	'.google.protobuf.Timestamp': temporal,

	// Duration
	'.google.protobuf.Duration': temporal,

	// Any
	'.google.protobuf.Any'(g_field, k_impl) {
		let yn_proto_type: TypeNode = typeRef('Uint8Array');
		let yn_json_type: TypeNode = type('string');

		const si_accepts = g_field.options?.acceptsInterface;
		if(si_accepts) {
			yn_proto_type = typeRef('Encoded', [
				union([
					typeLit(string(si_accepts)),
				]),
			]);

			yn_json_type = k_impl.importJsonTypesImplementing(si_accepts);
		}

		return {
			calls: {
				name: `atu8_${g_field.name!}`,
				type: yn_json_type,
			},

			proto: {
				type: yn_proto_type,
				writer: 'b',
				prefers_call: 1,
			},
		};
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
		calls: {
			name: `b_${si_field}`,
			type: type('boolean'),
		},

		proto: {
			writer: 'v',
		},
	}),

	// uint32
	[H_FIELD_TYPES.TYPE_UINT32]: si_field => ({
		calls: {
			name: `n_${si_field}`,
			type: type('number'),
		},

		proto: {
			writer: 'v',
		},
	}),

	// int32
	[H_FIELD_TYPES.TYPE_INT32]: si_field => ({
		calls: {
			name: `n_${si_field}`,
			type: type('number'),
		},

		proto: {
			writer: 'v',
		},
	}),

	// uint64
	[H_FIELD_TYPES.TYPE_UINT64]: si_field => ({
		calls: {
			name: `sg_${si_field}`,
			type: typeRef('WeakUint64Str'),
		},

		proto: {
			writer: 'g',
		},

		return_type: typeRef('Uint64Str'),
	}),

	// int64
	[H_FIELD_TYPES.TYPE_INT64]: si_field => ({
		calls: {
			name: `sg_${si_field}`,
			type: typeRef('WeakInt64Str'),
		},

		proto: {
			writer: 'g',
		},

		return_type: typeRef('Int64Str'),
	}),

	// string
	[H_FIELD_TYPES.TYPE_STRING](si_field, g_field) {
		// create default name
		let si_name = `s_${si_field}`;

		// create default type
		let yn_type: TypeNode = type('string');
		let yn_return!: TypeNode;

		// validator address
		if(/(^val(idator)?_.*?|val(idator)?)_addr(ess)?$/.test(si_field)) {
			si_name = `sa_${si_field.replace(/_addr(ess)?$/, '')}`;
			yn_type = typeRef('WeakValidatorAddr');
			yn_return = typeRef('ValidatorAddr');
		}
		// account address
		else if(/(_addr(ess)?|(^|_)receiver)$/.test(si_field) || A_SEMANTIC_ACCOUNT_ADDR.includes(si_field)) {
			si_name = `sa_${si_field.replace(/_address$/, '')}`;
			yn_type = typeRef('WeakAccountAddr');
			yn_return = typeRef('AccountAddr');
		}
		else if(si_field.endsWith('_id')) {
			si_name = `si_${si_field.replace(/_id$/, '')}`;
		}
		else if('code_hash' === si_field) {
			si_name = `sb16_${si_field}`;
			yn_type = typeRef('NaiveHexLower');
		}

		// construct ts field
		return {
			calls: {
				name: si_name,
				type: yn_type,
			},

			proto: {
				writer: 's',
			},

			return_type: yn_return,
		};
	},

	// enum
	[H_FIELD_TYPES.TYPE_ENUM](si_field, g_field) {
		// locate source
		const sr_path = k_impl.pathOfFieldType(g_field);

		// extract type reference ident
		const si_ref = g_field.typeName!.split('.').at(-1)!;

		const g_enum = k_impl.resolveType(g_field.typeName!) as AugmentedEnum;

		// construct ts field
		return {
			calls: {
				name: `sc_${snake(si_field)}`,
				type: k_impl.importType(`${SR_IMPORT_TYPES_PROTO}${sr_path}`, si_ref),
			},
			proto: {
				writer: 'v',
				type: typeRef((k_impl as NeutrinoImpl).enumId(g_enum)),
			},
		};
	},

	// struct
	[H_FIELD_TYPES.TYPE_MESSAGE](si_field, g_field) {
		// prep name
		const si_name = snake(si_field);

		// locate source
		const sr_path = k_impl.pathOfFieldType(g_field);

		// extract type reference ident
		const si_ref = g_field.typeName!.split('.').at(-1)!;

		// construct ts field
		return {
			calls: {
				name: `g_${si_name}`,
				type: k_impl.importType(`${SR_IMPORT_TYPES_PROTO}${sr_path}`, si_ref),
			},

			nests: {
				name: `a_${si_name}`,
				hints: literal(0),
				parse: yn_data => call(ident('decode_protobuf'), [yn_data]),
			},

			...H_OVERRIDE_MIXINS[g_field.typeName!]?.(g_field, k_impl) || {
				proto: {
					writer: 'b',
					type: typeRef('Encoded', [
						typeLit(string(g_field.typeName!.replace(/^\./, '/'))),
					]),
					// type: k_impl.importType(k_impl.pathOfFieldType(g_field), `EncodedThing`),
					// prefers_call: 1,
				},
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
			calls: {
				name: si_self,
				type: yn_type,
			},

			proto: {
				writer: 'b',
			},
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

export const map_proto_path = (g_proto: AugmentedFile): string => g_proto.name!.split('.').slice(0, -1).join('.');


type VersionSelector = [n_major: number, s_tag: string, n_minor: number];

const parse_semantic_version = (si_version: string): VersionSelector => {
	const m_semantic = /^v(\d+)(\w*?)(\d*)$/.exec(si_version);
	if(m_semantic) {
		const [, s_major, s_tag, s_minor] = m_semantic;
		const n_major = +s_major;
		const n_minor = +s_minor;

		return [n_major, s_tag, n_minor];
	}

	return [0, '', 0];
};

export const version_supercedes = (si_version_a: string, si_version_b?: string): boolean => {
	// parse local version
	const a_local = parse_semantic_version(si_version_a);

	// other version exists
	if(si_version_b) {
		// parse other version
		const a_picked = parse_semantic_version(si_version_b);

		return false
			// greater major version
			|| a_local[0] > a_picked[0]
			// same major
			|| (a_local[0] === a_picked[0]
				// no tag
				&& (!a_local[1]
					// beta supercedes alpha
					|| ('beta' === a_local[1] && 'alpha' === a_picked[1])
					// same tag
					|| (a_local[1] === a_picked[1]
						// greater minor version
						&& a_local[2] > a_picked[2]
					)
				)
			);
	}
	// no other version
	else {
		return true;
	}
};
