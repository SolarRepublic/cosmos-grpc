import type {O} from 'ts-toolbelt';

import type {AugmentedField, AugmentedFile, MethodOptionsWithHttp} from './env';
import type {Dict} from '@blake.regalia/belt';
import type {
	DescriptorProto,
	EnumDescriptorProto,
	FieldDescriptorProto,
	FileDescriptorProto,
	MethodDescriptorProto,
} from 'google-protobuf/google/protobuf/descriptor_pb';

import type {TypeNode} from 'typescript';

import {__UNDEFINED, oderac, F_IDENTITY} from '@blake.regalia/belt';
import {default as pb} from 'google-protobuf/google/protobuf/descriptor_pb';
import {ts} from 'ts-morph';

import {map_proto_path, type FieldRouter, type TsThing, type TsThingBare, version_supercedes} from './common';

import {access, arrayType, arrow, call, ident, importModule, param, print, typeRef} from './ts-factory';


// alias ts.factory
const y_factory = ts.factory;

export type AugmentedDescriptor = Omit<DescriptorProto.AsObject, 'fieldList'> & {
	source: AugmentedFile;
	index: number;
	comments: string;
	fieldList: AugmentedField[];
};

export type AugmentedEnumDescriptor = EnumDescriptorProto.AsObject & {
	source: AugmentedFile;
	index: number;
	comments: string;
};

export type FileCategory = 'lcd' | 'encoder' | 'decoder';

export abstract class RpcImplementor {
	protected _h_msgs: Dict<AugmentedDescriptor> = {};
	protected _h_enums: Dict<AugmentedEnumDescriptor> = {};

	protected _h_router!: FieldRouter;

	protected _h_type_imports: Dict = {};

	protected abstract _reset(): void;

	abstract lcd(
		si_service: string,
		si_vendor: string,
		si_module: string,
		s_version: string,
		sr_path_prefix: string,
		g_method: MethodDescriptorProto.AsObject,
		g_opts: O.Compulsory<MethodOptionsWithHttp>,
		g_input: DescriptorProto.AsObject,
		g_output: DescriptorProto.AsObject,
		s_comments: string
	): string;

	abstract head(si_category: FileCategory): string[];

	abstract body(si_category: FileCategory): string[];

	abstract accepts(si_interface: string, s_alias: string): TypeNode;

	pathToType(si_type: string): string {
		let g_src!: AugmentedDescriptor | AugmentedEnumDescriptor;

		if(si_type in this._h_msgs) {
			g_src = this.msg(si_type);
		}
		else if(si_type in this._h_enums) {
			g_src = this.enum(si_type);
		}
		else {
			throw new Error(`No type found "${si_type}"`);
		}

		return map_proto_path(g_src.source);
	}

	pathToFieldType(g_field: FieldDescriptorProto.AsObject): string {
		return this.pathToType(g_field.typeName!);
	}

	importType(sr_path: string, si_ident: string, a_type_args?: TypeNode[]): TypeNode {
		this._h_type_imports[si_ident] = sr_path;
		return typeRef(si_ident, a_type_args);
	}

	imports(): string[] {
		return oderac(this._h_type_imports, (si_ident, sr_path) => importModule(sr_path, [si_ident], true)).map(print);
	}

	reset(): void {
		this._h_type_imports = {};
		this._reset();
		return;
	}

	msg(si_type: string, g_desc?: AugmentedDescriptor): AugmentedDescriptor {
		const {_h_msgs} = this;

		// check for existing message
		let g_msg = _h_msgs[si_type];

		// getter
		if(!g_desc) {
			if(!g_msg) throw new Error(`No message found "${si_type}"`);
			return g_msg;
		}
		// setter, but message exists
		else if(g_msg) {
			const si_version_local = g_desc.source.parts.version;
			const si_version_other = g_msg.source.parts.version;

			const s_warn = `Multiple definitions of ${si_type}`;

			// this version supercedes other; replace it
			if(version_supercedes(si_version_local, si_version_other)) {
				console.warn(`${s_warn}; picking ${si_version_local} over ${si_version_other}`);
				g_msg = _h_msgs[si_type] = g_desc;
			}
			// other version supercedes; keep it
			else {
				console.warn(`${s_warn}; picking ${si_version_other} over ${si_version_local}`);
			}
		}
		// no conflict
		else {
			g_msg = _h_msgs[si_type] = g_desc;
		}

		// return message
		return g_msg;
	}

	enum(si_type: string, g_desc?: AugmentedEnumDescriptor): AugmentedEnumDescriptor {
		// lookup or set message
		const g_enum = this._h_enums[si_type] ??= g_desc as AugmentedEnumDescriptor;
		if(!g_enum) {
			throw new Error(`No enum found "${si_type}"`);
		}

		// return message
		return g_enum;
	}

	route(g_field: AugmentedField): TsThing {
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
		if(g_field.repeated) {
			// ref parts
			const {
				calls: g_calls,
				proto: g_proto,
			} = g_bare;

			// ref singular name format
			const s_name_singular = g_calls.name;

			// assert write type exists
			if(!g_proto?.writer) {
				debugger;
				throw new Error(`Repeated field type is not mapped to a proto writer function: ${s_name_singular}`);
			}

			// pluralize names
			g_calls.name = s_name_singular.replace(/^[^_]+/, 'a')
				.replace(/(\w\w)$/, (s_match, s_term) => s_term + (
					's' === s_term[1]
						? 'e' === s_term[0]
							? ''
							: 's' === s_term[0]
								? 'es'
								: ''
						: 's'));

			// adjust type
			g_calls.type = arrayType(g_calls.type);

			// turn into repeated writer
			g_proto.writer = g_proto.writer.toUpperCase();

			// no type; inherit from calls
			if(!g_proto.type) g_proto.type = g_calls.type;

			// wrap to_json
			if(g_calls.to_json) {
				g_calls.to_json = call(
					access(g_calls.name, 'map'),
					[arrow([param(s_name_singular)], g_calls.to_json)]
				);
			}

			// wrap from_json
			if(g_calls.from_json) {
				g_calls.from_json = yn_data => call(access(yn_data, 'map'), [
					arrow([param(s_name_singular)], g_calls.from_json!(ident(s_name_singular))),
				]);
			}

			// wrap to_proto
			if(g_calls.to_proto) {
				// special wrap for Coin[]
				if('.cosmos.base.v1beta1.Coin' === g_field.typeName) {
					g_calls.to_proto = call('coins', [ident(g_calls.name)]);
				}
				// map items
				else {
					g_calls.to_proto = call(
						access(g_calls.name, 'map'),
						[arrow([param(s_name_singular)], g_calls.to_proto)]
					);
				}
			}
		}

		{
			// auto-fill calls
			const g_calls = g_bare.calls as TsThing['calls'];
			g_calls.to_json ||= ident(g_calls.name);
			g_calls.from_json ||= F_IDENTITY;
			g_calls.to_proto ||= ident(g_calls.name);
			g_calls.return_type ||= g_calls.type;

			// auto-fill proto
			const g_proto = (g_bare.proto ||= {}) as TsThing['proto'];
			const si_proto = g_proto.name ||= g_calls.name;
			g_proto.type ||= g_calls.type;
			g_proto.writer ||= '';

			// create and return thing
			return {
				field: g_field,

				optional: (!g_field.repeated && !(g_field.options as {nullable?: boolean})?.nullable)
					&& (pb.FieldDescriptorProto.Label.LABEL_OPTIONAL === g_field.label || g_field.proto3Optional || false),

				calls: {
					...g_calls,

					get id() {
						return ident(g_calls.name);
					},
				},

				proto: {
					...g_proto,

					get id() {
						return ident(si_proto);
					},
				},

				nests: g_bare.nests || null,
			};
		}
	}
}
