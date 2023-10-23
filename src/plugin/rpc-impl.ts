import type {FieldRouter, TsThing} from './common';
import type {AugmentedEnum, AugmentedField, AugmentedFile, AugmentedMessage, AugmentedMethod} from './env';
import type {TypesDict} from './plugin';
import type {Dict} from '@blake.regalia/belt';

import type {TypeNode} from 'typescript';

import {oderac, F_IDENTITY} from '@blake.regalia/belt';

import {map_proto_path} from './common';

import {access, arrayType, arrow, call, ident, importModule, param, print, typeRef} from './ts-factory';


export type FileCategory = 'lcd' | 'any' | 'encoder' | 'decoder';

export abstract class RpcImplementor {
	protected _h_router!: FieldRouter;

	protected _h_type_imports: Dict = {};

	constructor(protected _h_types: TypesDict) {}

	abstract gateway(
		sr_path_prefix: string,
		g_method: AugmentedMethod,
		g_input: AugmentedMessage,
		g_output: AugmentedMessage,
	): string;

	abstract head(si_category: FileCategory): string[];

	abstract body(si_category: FileCategory): string[];

	abstract accepts(si_interface: string, s_alias: string): TypeNode;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	open(g_proto: AugmentedFile): void {
		this._h_type_imports = {};
	}

	resolveType(si_type: string): AugmentedMessage | AugmentedEnum {
		const g_type = this._h_types[si_type];

		// if(si_type in this._h_msgs) {
		// 	return this.msg(si_type);
		// }
		// else if(si_type in this._h_enums) {
		// 	return this.enum(si_type);
		// }

		if(!g_type) throw new Error(`No type found "${si_type}"`);

		return g_type;
	}

	pathOfType(si_type: string): string {
		return map_proto_path(this.resolveType(si_type).source);
	}

	pathOfFieldType(g_field: AugmentedField): string {
		return this.pathOfType(g_field.typeName!);
	}

	importType(sr_path: string, si_ident: string, a_type_args?: TypeNode[]): TypeNode {
		this._h_type_imports[si_ident] = sr_path;
		return typeRef(si_ident, a_type_args);
	}

	imports(): string[] {
		return oderac(this._h_type_imports, (si_ident, sr_path) => importModule(sr_path, [si_ident], true)).map(yn => print(yn));
	}

	// msg(si_type: string, g_desc?: AugmentedMessage): AugmentedMessage {
	// 	const {_h_msgs} = this;

	// 	// check for existing message
	// 	let g_msg = _h_msgs[si_type];

	// 	// getter
	// 	if(!g_desc) {
	// 		if(!g_msg) throw new Error(`No message found "${si_type}"`);
	// 		return g_msg;
	// 	}
	// 	// setter, but message exists
	// 	else if(g_msg) {
	// 		const si_version_local = g_desc.source.parts.version;
	// 		const si_version_other = g_msg.source.parts.version;

	// 		const s_warn = `Multiple definitions of ${si_type}`;

	// 		// this version supercedes other; replace it
	// 		if(version_supercedes(si_version_local, si_version_other)) {
	// 			console.warn(`${s_warn}; picking ${si_version_local} over ${si_version_other}`);
	// 			g_msg = _h_msgs[si_type] = g_desc;
	// 		}
	// 		// other version supercedes; keep it
	// 		else {
	// 			console.warn(`${s_warn}; picking ${si_version_other} over ${si_version_local}`);
	// 		}
	// 	}
	// 	// no conflict
	// 	else {
	// 		g_msg = _h_msgs[si_type] = g_desc;
	// 	}

	// 	// return message
	// 	return g_msg;
	// }

	// enum(si_type: string, g_desc?: AugmentedEnum): AugmentedEnum {
	// 	// lookup or set message
	// 	const g_enum = this._h_enums[si_type] ??= g_desc as AugmentedEnum;
	// 	if(!g_enum) {
	// 		throw new Error(`No enum found "${si_type}"`);
	// 	}

	// 	// return message
	// 	return g_enum;
	// }

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

		// ref parts
		const g_calls = g_bare.calls as TsThing['calls'];
		const g_proto = g_bare.proto as TsThing['proto'];

		// auto-fill proto
		{
			let si_proto = g_calls.name;

			if('b' === g_proto.writer) {
				si_proto = `atu8_${g_calls.name.replace(/^[^_]+_/, '')}`;
			}

			g_proto.name = si_proto;
			g_proto.type ||= g_calls.type;
		}

		const si_snake = g_calls.name;

		// repeated field
		if(g_field.repeated) {
			// ref singular name format
			const s_name_singular = g_calls.name;

			// assert write type exists
			if(!g_proto.writer) {
				debugger;
				throw new Error(`Repeated field type is not mapped to a proto writer function: ${s_name_singular}`);
			}

			// pluralize names
			g_proto.name = g_calls.name = s_name_singular.replace(/^[^_]+/, 'a')
				.replace(/(\w\w)$/, (s_match, s_term) => s_term + (
					's' === s_term[1]
						? 'e' === s_term[0]
							? ''
							: 's' === s_term[0]
								? 'es'
								: ''
						: 's'));

			// adjust call type
			g_calls.type = arrayType(g_calls.type);

			// adjust proto type
			g_proto.type = arrayType(g_proto.type);

			// turn into repeated writer
			// @ts-expect-error ignore
			g_proto.writer = g_proto.writer.toUpperCase();

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
					arrow([param(s_name_singular)], g_calls.from_json(ident(s_name_singular))),
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

		// auto-fill calls
		if(si_snake.startsWith('atu8_')) {
			g_calls.to_json ||= call('safe_buffer_to_base64', [ident(g_calls.name)]);
			g_calls.from_json ||= yn_data => call('safe_base64_to_buffer', [yn_data]);
		}

		g_calls.to_json ||= ident(g_calls.name);
		g_calls.from_json ||= F_IDENTITY;

		g_calls.to_proto ||= ident(g_proto.prefers_call? g_calls.name: g_proto.name);
		g_calls.return_type ||= g_calls.type;


		// optionality (everything in proto3 is optional by default)
		let b_optional = true;  // pb.FieldDescriptorProto.Label.LABEL_OPTIONAL === g_field.label;

		// explicitly not nullable
		if(false === g_field.options?.nullable) {
			// explictly optional
			if(g_field.proto3Optional) {
				debugger;
			}
			// not repeated
			else if(!g_field.repeated) {
				b_optional = true;
			}
		}

		// create and return thing
		return {
			field: g_field,

			optional: b_optional,
			// optional: (!g_field.repeated && !(g_field.options as {nullable?: boolean})?.nullable)
			// 	&& (pb.FieldDescriptorProto.Label.LABEL_OPTIONAL === g_field.label || g_field.proto3Optional || false),

			calls: {
				...g_calls,

				get id() {
					return ident(g_calls.name);
				},
			},

			proto: {
				...g_proto,

				get id() {
					return ident(g_proto.name);
				},
			},

			nests: g_bare.nests || null,
		};
	}
}
