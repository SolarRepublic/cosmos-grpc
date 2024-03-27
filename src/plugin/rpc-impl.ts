import type {FieldRouter, TsThing} from './common';
import type {AugmentedField, AugmentedFile, AugmentedMessage, AugmentedMethod} from './env';

import type {InterfacesDict, RefableType, TypesDict, Params} from './plugin';
import type {Dict} from '@blake.regalia/belt';

import type {TypeNode, ImportSpecifier, Identifier, CallExpression, Expression} from 'typescript';

import {concat_entries, F_IDENTITY, proper, __UNDEFINED, escape_regex, values} from '@blake.regalia/belt';
import {ts} from 'ts-morph';
const {SyntaxKind} = ts;


import {map_proto_path} from './common';
import {parse_package_parts} from './plugin';

import {arrayType, arrow, callExpr, ident, importModule, param, print, typeRef, y_factory, chain, callChain, union, keyword} from './ts-factory';


export type FileCategory = 'lcd' | 'any' | 'encoder' | 'decoder';


const F_SORT_PATH = ([sr_a]: [string, any], [sr_b]: [string, any]) => sr_a === sr_b? 0: sr_a < sr_b? -1: 1;

type ExpressionTransformer = (yn: Expression) => Expression;

const pluralize = (f_gen: ExpressionTransformer, s_name_singular='w'): ExpressionTransformer => {
	// cache singular form
	const yn_singular = f_gen(ident(s_name_singular)) as CallExpression;

	// callable
	if(SyntaxKind.CallExpression === (yn_singular.kind as typeof SyntaxKind.CallExpression) && 1 === yn_singular.arguments.length) {
		return yn_expr => callExpr('map', [yn_expr, yn_singular.expression]);
	}

	// shorten to using `map` import if single argument
	return yn_expr => callChain(
		chain(yn_expr, 'map'),
		[arrow([param(s_name_singular)], yn_singular)]
	);
};

export abstract class RpcImplementor {
	protected _h_router!: FieldRouter;

	protected _h_type_imports: Dict<[string, ImportSpecifier]> = {};
	protected _h_imports: Dict<[string, ImportSpecifier]> = {};

	protected _g_opened!: Pick<AugmentedFile, 'name'>;
	protected _b_clash_free = false;

	constructor(protected _h_types: TypesDict, protected _h_interfaces: InterfacesDict, protected _h_params: Params) {}

	abstract gateway(
		sr_path_prefix: string,
		g_method: AugmentedMethod,
		g_input: AugmentedMessage,
		g_output: AugmentedMessage,
	): string;

	abstract head(si_category: FileCategory): string[];

	abstract body(si_category: FileCategory): string[];

	abstract accepts(si_interface: string, s_alias: string): TypeNode;

	clashFreeTypeId(g_type: RefableType): string {
		return g_type.path.split('.').filter(F_IDENTITY).map(proper).join('').replace(/[^A-Za-z0-9$_]+/g, '');
	}

	exportedId(g_thing: {name?: string | undefined; path: string; source: AugmentedFile}): string {
		const si_thing = g_thing.path.slice(1);

		const g_parts = parse_package_parts(si_thing, '.');

		const sr_reparted = [g_parts.vendor, g_parts.module, g_parts.version]
			.map(s => s+'.').join('').replace(/[^A-Za-z0-9_.]+/g, '').replace(/\.{2,}/g, '.');

		const s_name = si_thing.replace(new RegExp(`^${escape_regex(sr_reparted)}`), '');

		return [g_parts.vendor, g_parts.module, s_name].join('/')
			.split(/[^A-Za-z0-9]+/g).map(proper).join('');
	}

	exportedConst(g_thing: {name?: string | undefined; path: string; source: AugmentedFile}): string {
		return this.exportedId(g_thing).replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
	}

	importJsonTypesImplementing(si_interface: string): TypeNode {
		const a_msgs = this._h_interfaces[si_interface];

		// no mesages implement the interface
		if(!a_msgs) {
			console.warn(`WARNING: No messages implement the interface "${si_interface}"`);
			// return keyword('void');
		}

		// create type reference to JSON form of Any with appropriate generics
		return typeRef('JsonAny', [
			// litType(string(si_interface)),
			keyword('string'),
			...a_msgs
				? [union(a_msgs.map(g_msg => this.importType(g_msg)))]
				: [],  // keyword('never'),
		]);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	open(g_proto: Pick<AugmentedFile, 'name'>, b_clash_free=false): void {
		this._g_opened = g_proto;
		this._b_clash_free = b_clash_free;

		this._h_type_imports = {};
		this._h_imports = {};
	}

	resolveType(si_type: string): RefableType {
		const g_type = this._h_types[si_type];

		if(!g_type) throw new Error(`No type found "${si_type}"`);

		return g_type;
	}

	pathOfType(si_type: string): string {
		return map_proto_path(this.resolveType(si_type).source);
	}

	pathOfFieldType(g_field: AugmentedField): string {
		return this.pathOfType(g_field.typeName!);
	}

	_import(h_imports: Dict<[string, ImportSpecifier]>, g_ref: RefableType, s_prefix: string, b_ignore=false): string {
		const si_export = s_prefix+this.exportedId(g_ref);
		const si_distinct = s_prefix+this.clashFreeTypeId(g_ref);

		// external and not explicitly ignored
		if(g_ref.source !== this._g_opened && !b_ignore) {
			h_imports[si_distinct] = [`#/proto/${map_proto_path(g_ref.source)}`, y_factory.createImportSpecifier(
				false,
				...(this._b_clash_free && si_distinct !== si_export
					? [ident(si_export), ident(si_distinct)]
					: [__UNDEFINED, ident(si_export)]) as [Identifier | undefined, Identifier]
			)];
		}

		return this._b_clash_free? si_distinct: si_export;
	}

	importType(g_ref: RefableType, s_prefix=''): TypeNode {
		const b_ignore = this._b_clash_free && !['', 'Encoded', 'Decoded'].includes(s_prefix);

		return typeRef(this._import(this._h_type_imports, g_ref, s_prefix, b_ignore));
	}

	importConstant(g_ref: RefableType, s_prefix=''): Identifier {
		const b_ignore = this._b_clash_free && !['', 'encode', 'decode', 'JsonToProtoEnum', 'ProtoToJsonEnum'].includes(s_prefix);

		return ident(this._import(this._h_imports, g_ref, s_prefix, b_ignore));
	}

	imports(): string[] {
		// reduce type imports by path
		const h_types: Dict<ImportSpecifier[]> = {};
		for(const [sr_path, yn_import] of values(this._h_type_imports).sort(F_SORT_PATH)) {
			(h_types[sr_path] ??= []).push(yn_import);
		}

		// reduce module imports by path
		const h_modules: Dict<ImportSpecifier[]> = {};
		for(const [sr_path, yn_import] of values(this._h_imports).sort(F_SORT_PATH)) {
			(h_modules[sr_path] ??= []).push(yn_import);
		}

		return [
			// // type imports
			...concat_entries(h_types, (sr_path, a_imports) => importModule(sr_path, a_imports, true)).map(yn => print(yn)),

			// // dependencies on other generated proto files
			...concat_entries(h_modules, (sr_path, a_imports) => importModule(sr_path, a_imports)).map(yn => print(yn)),
		];
	}

	route(g_field: AugmentedField): TsThing {
		if(!g_field) debugger;

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
		const g_calls = {...g_bare.calls} as TsThing['calls'];
		const g_proto = {...g_bare.proto} as TsThing['proto'];
		const g_nests = g_bare.nests? {...g_bare.nests}: __UNDEFINED as TsThing['nests'] || null;
		const g_json = {...g_bare.json} as TsThing['json'];

		// if(H_FIELD_TYPES.TYPE_BOOL === g_field.type) debugger;

		// auto-fill proto
		{
			let si_proto = g_calls.name;

			if('b' === g_proto.writer) {
				si_proto = `atu8_${g_calls.name.replace(/^[^_]+_/, '')}`;
			}

			g_proto.name = si_proto;
			g_proto.type ||= g_calls.type;
		}

		// ref singular name format
		const si_snake = g_calls.name;

		// repeated field
		if(g_field.repeated) {
			// assert write type exists
			if(!g_proto.writer) {
				debugger;
				throw new Error(`Repeated field type is not mapped to a proto writer function: ${si_snake}`);
			}

			// pluralize names
			g_proto.name = g_calls.name = si_snake.replace(/^[^_]+/, 'a')
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
			// @ts-expect-error ignore string assignment
			g_proto.writer = g_proto.writer.toUpperCase();

			// wrap to_json
			const f_to_json = g_calls.to_json;
			if(f_to_json) g_calls.to_json = pluralize(f_to_json, si_snake);

			// wrap from_json
			const f_from_json = g_calls.from_json;
			if(f_from_json) g_calls.from_json = pluralize(f_from_json, si_snake);

			// wrap to_proto
			const f_to_proto = g_calls.to_proto;
			if(f_to_proto) {
				// special wrap for Coin[]
				if('.cosmos.base.v1beta1.Coin' === g_field.typeName) {
					g_calls.to_proto = yn_expr => callExpr('coins', [yn_expr]);
				}
				// map items
				else {
					g_calls.to_proto = pluralize(f_to_proto, si_snake);
				}
			}

			// condense
			const f_condense = g_calls.condense;
			if(f_condense) g_calls.condense = pluralize(f_condense, si_snake);

			// expand
			const f_expand = g_calls.expand;
			if(f_expand) g_calls.expand = pluralize(f_expand, si_snake);

			// convert types into array
			if(g_json?.type) g_json.type = arrayType(g_json.type);
			if(g_json?.weak) g_json.weak = arrayType(g_json.weak);
			if(g_calls.return_type) g_calls.return_type = arrayType(g_calls.return_type);
		}

		// auto-fill calls
		if(si_snake.startsWith('atu8_')) {
			g_calls.to_json ||= yn_expr => callExpr('safe_bytes_to_base64', [yn_expr]);

			// repeated
			if(g_field.repeated) g_calls.to_json = pluralize(g_calls.to_json, si_snake);
		}

		g_calls.to_json ||= F_IDENTITY;
		g_calls.from_json ||= F_IDENTITY;

		g_calls.to_proto ||= F_IDENTITY;  // ident(g_proto.prefers_call? g_calls.name: g_proto.name);
		g_calls.return_type ||= g_calls.type;

		g_calls.condense ||= g_calls.from_json;
		g_calls.expand ||= g_calls.to_json;

		const yn_json = g_json?.type || g_calls.return_type;

		// create and return thing
		return {
			field: g_field,

			get optional() {
				return g_field.optional;
			},

			calls: {
				...g_calls,

				get id() {
					return ident(g_calls.name);
				},
			},

			json: {
				type: yn_json,
				weak: g_json?.weak || yn_json,
			},

			proto: {
				...g_proto,

				get id() {
					return ident(g_proto.name);
				},
			},

			get destruct_type(): TypeNode {
				return g_calls.from_json !== F_IDENTITY? g_calls.type: yn_json;
			},

			nests: g_nests,
		};
	}
}
