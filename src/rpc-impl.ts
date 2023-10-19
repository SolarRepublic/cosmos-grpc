import type {O} from 'ts-toolbelt';

import type {MethodOptionsWithHttp} from './env';
import type {Dict} from '@blake.regalia/belt';
import type {
	DescriptorProto,
	EnumDescriptorProto,
	FieldDescriptorProto,
	FileDescriptorProto,
	MethodDescriptorProto,
} from 'google-protobuf/google/protobuf/descriptor_pb';

import type {TypeNode, Statement} from 'typescript';

import {__UNDEFINED, oderac, F_IDENTITY} from '@blake.regalia/belt';
import {default as pb} from 'google-protobuf/google/protobuf/descriptor_pb';
import {ts} from 'ts-morph';

import {type FieldRouter, type TsThing, type TsThingBare} from './common';
import {access, arrayType, arrow, call, ident, importModule, param, print, typeRef} from './ts-factory';


// alias ts.factory
const y_factory = ts.factory;

export type AugmentedDescriptor = DescriptorProto.AsObject & {
	source: FileDescriptorProto.AsObject;
	index: number;
	comments: string;
};

export type AugmentedEnumDescriptor = EnumDescriptorProto.AsObject & {
	source: FileDescriptorProto.AsObject;
	index: number;
	comments: string;
};

export abstract class RpcImplementor {
	protected _h_msgs: Dict<AugmentedDescriptor> = {};
	protected _h_enums: Dict<AugmentedEnumDescriptor> = {};

	protected _h_router!: FieldRouter;

	protected _h_type_imports: Dict = {};

	protected _a_file: string[] = [];

	protected abstract _reset(): void;

	abstract generate(
		si_service: string,
		si_vendor: string,
		si_module: string,
		s_version: string,
		g_method: MethodDescriptorProto.AsObject,
		g_opts: O.Compulsory<MethodOptionsWithHttp>,
		g_input: DescriptorProto.AsObject,
		g_output: DescriptorProto.AsObject,
		s_comments: string
	): Statement;

	abstract lines(): string[];

	path_to_type(g_field: FieldDescriptorProto.AsObject, b_enum=false): string {
		const si_type = g_field.typeName!;

		return (b_enum? this.enum(si_type): this.msg(si_type)).source.name!.split('.').slice(0, -1).join('.');
	}

	importType(sr_path: string, si_ident: string, a_type_args?: TypeNode[]): TypeNode {
		this._h_type_imports[si_ident] = sr_path;
		return typeRef(si_ident, a_type_args);
	}

	imports(): string[] {
		return oderac(this._h_type_imports, (si_ident, sr_path) => importModule(sr_path, [si_ident], true)).map(print);
	}

	file(): string[] {
		this._h_type_imports = {};
		this._reset();
		return this._a_file = [];
	}

	msg(si_type: string, g_desc?: AugmentedDescriptor): AugmentedDescriptor {
		// lookup or set message
		const g_msg = this._h_msgs[si_type] ??= g_desc as AugmentedDescriptor;
		if(!g_msg) {
			debugger;
			throw new Error(`No message found "${si_type}"`);
		}

		// return message
		return g_msg;
	}

	enum(si_type: string, g_desc?: AugmentedEnumDescriptor): AugmentedEnumDescriptor {
		// lookup or set message
		const g_enum = this._h_enums[si_type] ??= g_desc as AugmentedEnumDescriptor;
		if(!g_enum) {
			throw new Error(`No message found "${si_type}"`);
		}

		// return message
		return g_enum;
	}

	route(g_field: FieldDescriptorProto.AsObject): TsThing {
		// lookup transformer
		const f_transformer = this._h_router[g_field.type!];
		if(!f_transformer) {
			debugger;
			throw new Error(`No transformer for ${JSON.stringify(g_field)}`);
		}

		// no name
		if(!g_field.name) throw new Error(`Field is missing name ${JSON.stringify(g_field)}`);

		// apply transform
		const g_bare = f_transformer(g_field.name, g_field);

		// repeated field
		if(pb.FieldDescriptorProto.Label.LABEL_REPEATED === g_field.label) {
			const s_name_singular = g_bare.name;

			// pluralize name
			g_bare.name = s_name_singular.replace(/^[^_]+/, 'a')
				.replace(/(\w\w)$/, (s_match, s_term) => s_term + (
					's' === s_term[1]
						? 'e' === s_term[0]
							? ''
							: 's' === s_term[0]
								? 'es'
								: ''
						: 's'));

			// adjust type
			g_bare.type = arrayType(g_bare.type);
			if(!g_bare.proto_type) {
				g_bare.proto_type = g_bare.type;
			}

			// assert write type
			if(!g_bare.write) {
				throw new Error(`Repeated field type is not mapped to a proto writer function: ${s_name_singular}`);
			}

			// turn into repeated writer
			g_bare.write = g_bare.write.toUpperCase();

			// wrap wire functions
			if(g_bare.to_wire) {
				g_bare.to_wire = call(
					access(g_bare.name, 'map'),
					__UNDEFINED,
					[arrow([param(s_name_singular)], g_bare.to_wire)]
				);
			}

			if(g_bare.from_wire) {
				g_bare.from_wire = yn_data => call(access(yn_data, 'map'), __UNDEFINED, [
					arrow([param(s_name_singular)], g_bare.from_wire!(ident(s_name_singular))),
				]);
			}

			// wrap proto adapter
			if(g_bare.to_proto) {
				// fill-in proto name
				g_bare.proto_name ||= g_bare.name;

				// special wrap for Coin[]
				if('.cosmos.base.v1beta1.Coin' === g_field.typeName) {
					g_bare.to_proto = call('coins', __UNDEFINED, [ident(g_bare.proto_name)]);
				}
				// map items
				else {
					g_bare.to_proto = call(
						access(g_bare.proto_name, 'map'),
						__UNDEFINED,
						[arrow([param(s_name_singular)], g_bare.to_proto)]
					);
				}
			}
		}

		// default identifier
		const yn_id = ident(g_bare.name);

		// fill-in proto name
		const si_proto = g_bare.proto_name || g_bare.name;

		// create and return thing
		return {
			...g_bare as TsThingBare & Required<Pick<TsThingBare, 'proto_name' | 'write'>>,
			field: g_field,
			id: yn_id,
			optional: !(g_field.options as {nullable?: boolean})?.nullable
				&& (pb.FieldDescriptorProto.Label.LABEL_OPTIONAL === g_field.label || g_field.proto3Optional || false),

			to_wire: g_bare.to_wire || yn_id,
			from_wire: g_bare.from_wire || F_IDENTITY,

			proto_name: si_proto,
			write: g_bare.write || '',
			to_proto: g_bare.to_proto || ident(si_proto),
			proto_type: g_bare.proto_type || g_bare.type,
			nests: g_bare.nests || false,
		};
	}
}
