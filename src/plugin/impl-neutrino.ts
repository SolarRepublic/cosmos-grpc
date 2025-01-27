import type {TsThing} from './common';
import type {AugmentedEnum, AugmentedField, AugmentedFile, AugmentedMessage, AugmentedMethod, ExtendedMethodOptions} from './env';

import type {InterfacesDict, Params, TypesDict} from './plugin';
import type {FileCategory} from './rpc-impl';
import type {Dict} from '@blake.regalia/belt';


import {readFileSync} from 'node:fs';

import {__UNDEFINED, fold, concat_entries, proper, snake, escape_regex, transform_values, map_entries, F_IDENTITY, keys, values, is_number, is_array} from '@blake.regalia/belt';

import {ts} from 'ts-morph';
import {type Statement, type TypeNode, type Expression, type ImportSpecifier, type ParameterDeclaration, type ConciseBody, type OmittedExpression, type BindingElement, type Identifier, type ArrayBindingElement} from 'typescript';

import {H_FIELD_TYPES, H_FIELD_TYPE_TO_HUMAN_READABLE, field_router, map_proto_path} from './common';
import {N_MAX_PROTO_FIELD_NUMBER_GAP} from './constants';
import {RpcImplementor} from './rpc-impl';
import {access, arrayBinding, arrayLit, arrow, binding, callExpr, castAs, declareAlias, declareConst, funcType, ident, intersection, literal, numericLit, param, parens, print, string, tuple, keyword, litType, typeRef, union, y_factory, typeLit, objectLit, arrayType, typeOf, objectBinding, arrayAccess, exclaim, callChain, chain, andAnd, ternary, binary, unknown} from './ts-factory';
import {ProtoHint} from '../api/protobuf-reader';

type ReturnThing = {
	type: TypeNode;
	parser: Expression | null;
	things: TsThing[];
};

const {
	SyntaxKind,
} = ts;

type Draft = {
	typeImports: Dict<[string, ImportSpecifier]>;
	imports: Dict<[string, ImportSpecifier]>;
	heads: Record<FileCategory, string[]>;
	consts: Record<FileCategory, Dict<Statement>>;
};

const reset_heads = (): Draft['heads'] => ({
	lcd: [],
	any: [],
	encoder: [],
	decoder: [],
});

const reset_consts = (): Draft['consts'] => ({
	lcd: {},
	any: {},
	encoder: {},
	decoder: {},
});

export class NeutrinoImpl extends RpcImplementor {
	static condenserFile(): Pick<AugmentedFile, 'name'> {
		return {
			name: '_any_condense.proto',
		};
	}

	protected _si_const = '';
	protected _s_path_prefix = '';

	protected _g_heads: Draft['heads'] = reset_heads();
	protected _g_consts: Draft['consts'] = reset_consts();
	protected _h_drafts: Dict<Draft> = {};

	protected _p_output = '';

	constructor(h_types: TypesDict, h_interfaces: InterfacesDict, h_params: Params) {
		super(h_types, h_interfaces, h_params);

		this._h_router = field_router(this);
	}


	protected encode_params(g_msg: AugmentedMessage): [ParameterDeclaration[], Expression] {
		// instantiate writer
		let yn_chain = callExpr('Protobuf', [], __UNDEFINED, '...');

		// prep params lists
		const a_params_required: ParameterDeclaration[]= [];
		const a_params_optional: ParameterDeclaration[] = [];

		// keep track of the expected field number to determine when there are gaps
		let n_field_expected = 1;

		// each field
		g_msg.fieldList.forEach((g_field) => {
			// convert field to thing
			const g_thing = this.route(g_field);

			// prep args
			const a_args: Expression[] = [
				g_thing.calls.to_proto(g_thing.proto.prefers_call
					? g_thing.calls.id
					: g_thing.proto.id
				)];

			// field number does not immediately follow previous
			const i_number = g_field.number!;
			if(i_number !== n_field_expected++) {
				// append the correct number to the calll args
				a_args.push(numericLit(i_number));

				// no number
				if('number' !== typeof i_number) {
					throw new Error(`Field is missing explicit number: ${g_field.name}`);
				}
			}

			// human-readable field type for comment
			const s_comment_type = g_field.typeName?.split('.').at(-1)
				|| H_FIELD_TYPE_TO_HUMAN_READABLE[g_field.type!] || 'unknown';

			// append to protobuf-building call chain
			yn_chain = callExpr(
				access(yn_chain, g_thing.proto.writer),
				a_args,
				__UNDEFINED,
				`${s_comment_type}${g_field.repeated? '[]': ''} ${g_field.name} = ${g_field.number}`
			);

			// create parameter
			const yn_param = g_thing.proto.prefers_call
				? param(
					g_thing.calls.id,
					g_thing.optional? typeRef('Opt', [g_thing.calls.type]): g_thing.calls.type,
					g_thing.optional)
				: param(
					g_thing.proto.id,
					g_thing.optional? typeRef('Opt', [g_thing.proto.type]): g_thing.proto.type,
					g_thing.optional);

			// extend
			(yn_param as any).thing = g_thing;

			// add to optional/required params list, depending on which one it is
			if(g_thing.optional) {
				a_params_optional.push(yn_param);
			}
			else {
				a_params_required.push(yn_param);
			}
		});

		return [[
			...a_params_required,
			...a_params_optional,
		], access(yn_chain, 'o')];
	}



	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	protected pattern_string_to_ast_node(sx_pattern: string, g_input: AugmentedMessage) {
		const {
			_si_const,
			_s_path_prefix,
		} = this;

		// if('/axelar/nexus/v1beta1/latest_deposit_address/{recipient_addr}/{recipient_chain}/{deposit_chain}')

		const h_fields = fold(g_input.fieldList, g_field => ({
			[g_field.name!]: g_field,
		}));

		// clone fields in order to find out which params are unused
		const h_fields_unused = {...h_fields};

		// construct parts of expression
		const a_parts = [];

		// prefix
		if(sx_pattern.startsWith(_s_path_prefix)) {
			a_parts.push(ident(_si_const));

			sx_pattern = sx_pattern.slice(_s_path_prefix.length);
		}

		// record index of end of previous match
		let i_prev = 0;

		// each match
		for(const d_match of sx_pattern.matchAll(/\{([^}]+)\}/g)) {
			const i_match = d_match.index;

			// push constant string part
			if(i_prev !== i_match) {
				a_parts.push(y_factory.createStringLiteral(sx_pattern.slice(i_prev, i_match)));
			}

			// param path
			const a_param_path = d_match[1].replace(/=\*+$/, '').split('.');

			// ref 0th part
			const si_param_0 = a_param_path[0];

			// lookup base field
			const g_field = h_fields[si_param_0];

			// convert to thing
			let g_thing = this.route(g_field);

			// prep access expression
			let yn_access: Expression = g_thing.calls.id;

			// each subsequent part
			for(const si_param_part of a_param_path.slice(1)) {
				// resolve parent type
				const g_resolved = this.resolveType(g_field.typeName!);

				// message type
				if('message' === g_resolved.form) {
					// locate the subfield
					const g_subfield = g_resolved.fieldList.find(g => si_param_part === g.name);

					// convert to thing
					g_thing = this.route(g_subfield!);

					// add accessor
					yn_access = chain(yn_access, g_subfield!.name!);
				}
				else {
					throw Error(`Non-message fields not implemented for resolving dot-notation member`);
				}
			}

			// push param
			a_parts.push(g_thing.calls.to_json(yn_access));

			// remove from unused
			delete h_fields_unused[si_param_0];

			// advance pointer
			i_prev = i_match + d_match[0].length;
		}

		// push remainder string
		const s_remainder = sx_pattern.slice(i_prev);
		if(s_remainder) {
			a_parts.push(y_factory.createStringLiteral(s_remainder));
		}

		// create concat expression
		const yn_concat = a_parts.length
			? a_parts.slice(1).reduce((yn_prev, yn_part) => y_factory.createBinaryExpression(
				yn_prev,
				y_factory.createToken(SyntaxKind.PlusToken),
				yn_part
			), a_parts[0])
			: y_factory.createStringLiteral(sx_pattern);

		// members
		const a_members = [yn_concat];

		// other params remain
		if(Object.keys(h_fields_unused).length) {
			// convert each to property signature
			const a_properties = concat_entries(h_fields_unused, (si_param, g_field) => {
				const g_thing = this.route(g_field);

				return y_factory.createPropertyAssignment(
					ident(si_param),
					g_thing.calls.to_json(g_thing.calls.id)
				);
			});

			a_members.push(y_factory.createObjectLiteralExpression(a_properties, true));

			// // single property; create simple struct
			// if(1 === a_properties.length) {
			// 	a_members.push(y_factory.createObjectLiteralExpression(a_properties, true));
			// }
			// // multiple properties, join
			// else {

			// }
		}

		return {
			unused: h_fields_unused,
			expr: y_factory.createArrayLiteralExpression(a_members, false),
		};
	}

	override open(g_proto: Pick<AugmentedFile, 'name'>, b_clash_free=false): void {
		super.open(g_proto, b_clash_free);

		// would-be output file nam
		const p_output = this._p_output = map_proto_path(g_proto)+'.ts';

		// open draft
		const g_draft = this._h_drafts[p_output] ||= {
			typeImports: this._h_type_imports,
			imports: this._h_imports,
			heads: reset_heads(),
			consts: reset_consts(),
		};

		// restore imports
		this._h_type_imports = g_draft.typeImports;
		this._h_imports = g_draft.imports;

		// destructure parts
		const {
			consts: g_consts,
			heads: g_heads,
		} = g_draft;

		// set fields
		this._g_consts = g_consts;
		this._g_heads = g_heads;
	}

	override head(si_category: FileCategory): string[] {
		// inject augmentations once, right below the imports
		let s_augmentations = '';
		const sr_augment = this._h_params.augmentations?.[this.path.replace(/\.ts$/, '')];
		if(sr_augment) {
			s_augmentations = readFileSync(sr_augment, 'utf-8');
		}

		return [
			...this._g_heads[si_category],
			s_augmentations,
		];
	}

	override body(si_category: FileCategory): string[] {
		// all statements
		return [
			...concat_entries(this._g_consts[si_category], (si_const, yn_const) => print(yn_const)),
		];
	}

	override accepts(si_interface: string, s_alias: string) {
		const si_type = `Accepts${proper(s_alias)}`;

		const yn_type = declareAlias(si_type, typeRef('Encoded', [
			union([
				string(si_interface),
				// ...g_opts.implementsInterfaceList.map(si_interface => string(si_interface)),
			].map(yn => litType(yn))),
		]));

		// add to preamble
		this._g_heads.encoder.push(print(yn_type));

		return typeRef(si_type);
	}

	get path(): string {
		return this._p_output;
	}

	generate_return(g_output: AugmentedMessage, g_input: AugmentedMessage): ReturnThing {
		// // remove redundant fields
		// const a_fields = g_output.fieldList.filter((g_field) => {
		// 	// test each field in input
		// 	for(const g_test of g_input.fieldList) {
		// 		// same type and identical name
		// 		if(g_test.name === g_field.name && g_test.type === g_field.type && g_test.typeName === g_field.typeName) {
		// 			// not exceptional
		// 			if(!A_EXCEPTIONAL_RETURNS.includes(g_field.typeName!)) {
		// 				console.warn(`WARNING: Omitting redundant response field [${g_field.name}: ${g_field.typeName}] from ${g_output.path}`);
		// 				return false;
		// 			}
		// 		}
		// 	}

		// 	// pass; keep
		// 	return true;
		// });

		const a_fields = g_output.fieldList;

		const a_returns = a_fields.map((g_field) => {
			const g_thing = this.route(g_field);

			// eslint-disable-next-line prefer-const
			let yn_parser = (yn: Expression) => yn;

			// // bytes
			// if(H_FIELD_TYPES.TYPE_BYTES === g_field.type) {
			// 	yn_parser = yn => call('safe_base64_to_bytes', [yn]);
			// }

			return {
				thing: g_thing,

				type: g_thing.calls.type,

				parser: yn_parser(access('g', snake(g_field.name!))),

				// parser: g_thing.calls.from_json(
				// 	access('g', snake(g_field.name!))
				// ),
			};
		});

		// single return type
		if(1 === a_returns.length) {
			const g_return = a_returns[0];

			return {
				type: g_return.type,
				parser: g_return.parser,
				things: [g_return.thing],
			};
		}

		// handle multiple returns as tuple
		return {
			type: tuple(a_returns.map(g => [
				g.thing.calls.id,
				g.thing.optional,
				g.type,
			])),
			parser: a_returns.length? y_factory.createArrayLiteralExpression(a_returns.map(g => g.parser)): null,
			things: a_returns.map(g => g.thing),
		};
	}


	override gateway(
		sr_path_prefix: string,
		g_method: AugmentedMethod,
		g_input: AugmentedMessage,
		g_output: AugmentedMessage
	): string {
		// open proto source of service
		this.open(g_method.service.source);

		// ref path parts
		const g_parts = g_method.service.source.parts;

		const si_module_ident = g_parts.module.replace(/\//g, '_');

		// 
		const si_const = this._si_const = `SR_LCD_${g_parts.vendor.toUpperCase()}_${si_module_ident.toUpperCase()}_${g_method.service.name!.toUpperCase()}`;

		// const s_path_prefix = this._s_path_prefix = `${'secret' === si_vendor? '': `/${si_vendor}`}/${si_module}/${s_version}/`;
		this._s_path_prefix = sr_path_prefix;
		this._g_consts.lcd[si_const] ||= declareConst(si_const, string(sr_path_prefix));

		// method name
		const si_method = g_method.name;

		// destructure options
		const {
			deprecated: b_deprecated,
			http: {
				get: sx_path_http_get,
				post: sx_path_http_post,
			},
		} = g_method.options! as Required<ExtendedMethodOptions>;

		// transform output type
		const g_return = this.generate_return(g_output, g_input);

		// parse pattern and apply input args
		const g_pattern = this.pattern_string_to_ast_node(sx_path_http_get || sx_path_http_post, g_input);

		// transform input arguments
		const a_things = g_input.fieldList.map(g_field => this.route(g_field));

		const is_optional = (g: TsThing) => !!(g.optional || g_pattern.unused[g.field.name!]);

		// construct args such that required fields are at beginning, followed by optional/unused
		const a_args = [
			...a_things.filter(g => !is_optional(g)),
			...a_things.filter(is_optional),
		];

		// each arg used in pattern
		const a_docs_parmas = a_args.map((g_arg) => {
			const s_comment = g_arg.field.comments.replace(new RegExp(`^${escape_regex(g_arg.field.name!)}\\s+`), '');

			return `@param ${g_arg.calls.name} - ${s_comment}`;
		});

		const yn_call = callExpr('restful_grpc', [
			// request formatter
			arrow(a_args.map(g_arg => param(g_arg.calls.id)), g_pattern.expr),

			// // response parser
			// g_return.parser? arrow([param('g')], g_return.parser): ident('F_IDENTITY'),

			// request init for POST
			...sx_path_http_post
				? [
					numericLit(1),
				]
				: [],
		], [
			// 1st generics param is function arguments
			tuple(a_args.map(g_arg => [
				g_arg.calls.id,
				is_optional(g_arg),
				g_arg.optional
					? typeRef('Opt', [g_arg.calls.type])
					: g_arg.calls.type,
			])),

			// 2nd generics param is raw response data
			this.importType(g_output),
		]);

		// const si_action_prefix = si_service
		const si_action_prefix = sx_path_http_get? 'query': 'submit';
		const si_action = `${si_action_prefix}${proper(g_parts.vendor)}${proper(si_module_ident)}${si_method}`;
		const yn_statement = declareConst(si_action, yn_call, true);

		// upper-case first letter of comment if present
		let s_line_0 = g_method.comments;
		if(s_line_0) s_line_0 = s_line_0[0].toUpperCase()+s_line_0.slice(1);

		// init comment lines
		const a_comment_lines = [s_line_0];
		a_comment_lines.push(`@param z_req - URL origin of LCD endpoint or {@link RequestInit}`);
		a_comment_lines.push(...a_docs_parmas);


		const a_returns = g_return.things;
		if(!a_returns.length) {
			a_comment_lines.push(`@returns an empty tuple`);
		}
		else {
			const a_docs_returns = a_returns.map((g_thing) => {
				const g_field = a_returns[0].field;
				const s_comment = g_field.comments.replace(new RegExp(`^${escape_regex(g_field.name!)}\\s+`), '');

				return `${s_comment || `the '${g_field.name}' response property`}`;
			});

			// if(1 === a_returns.length) {
			// 	a_comment_lines.push(`@returns ${a_docs_returns[0]}`);
			// }
			// else {
			a_comment_lines.push(`@returns a tuple where:`);

			a_docs_returns.forEach((s_doc, i_doc) => {
				a_comment_lines.push(`  - ${i_doc}: ${a_returns[i_doc].field.name} - ${s_doc}`);
			});
			// }
		}

		return print(yn_statement, a_comment_lines);
	}

	anyEncoder(
		g_msg: AugmentedMessage
	): string {
		// open proto source of msg
		this.open(g_msg.source);

		// implements interface
		const a_interfaces = g_msg.options?.implementsInterfaceList;
		if(!a_interfaces) throw new Error('No interface option');

		// prep unique type
		const si_singleton = `Any${this.exportedId(g_msg)}`;

		// prep 'typeUrl' property for `Any` protobuf message
		const p_type = `/${g_msg.source.pb_package}.${g_msg.local}`;

		// declare unique type
		const yn_type = declareAlias(si_singleton, intersection([
			// Encoded<si_message | ...as_interfaces>
			typeRef('Encoded', [
				union([
					// litType(string(p_type)),
					...a_interfaces.map(si_interface => litType(string(si_interface))),
				]),
			]),
		]), true);

		// add to preamble
		this._g_heads.any.push(print(yn_type));

		// encode params and build chain
		const [a_params, yn_chain] = this.encode_params(g_msg);

		// wrap in any
		const yn_any = callExpr('any', [
			string(p_type),
			yn_chain,
		]);

		// construct writer
		const yn_writer = arrow(a_params, castAs(yn_any, typeRef(si_singleton)), typeRef(si_singleton));

		// create statement
		const yn_const = declareConst(`any${g_msg.name!}`, yn_writer, true);

		return print(yn_const, [
			`Encodes a \`${g_msg.name}\` protobuf message wrapped in the \`Any\` container: ${g_msg.comments}`,
			...(a_params as unknown as {thing: TsThing}[]).map(({thing:g_thing}) => `@param ${g_thing.calls.name} - \`${g_thing.field.name}\`: ${g_thing.field.comments}`),
			`@returns a strongly subtyped Uint8Array representing an \`Any\` protobuf message`,
		]);
	}

	msgEncoder(g_msg: AugmentedMessage): string[] {
		// open proto source of msg
		this.open(g_msg.source);

		// prep unique type
		const si_singleton = `Encoded${this.exportedId(g_msg)}`;

		// list of types the encoded payload implements
		const a_encoded_types = [litType(string(`/${g_msg.source.pb_package}.${g_msg.local}`))];

		// add all types from implements interfaces list
		g_msg.options?.implementsInterfaceList?.forEach(p_type => a_encoded_types.push(litType(string(p_type))));

		// declare unique type
		const yn_type = declareAlias(si_singleton, typeRef('Encoded', [
			union(a_encoded_types),
		]), true);

		// add type decl to preamble
		this._g_heads.encoder.push(print(yn_type));

		// encode params and build chain
		const [a_params, yn_chain] = this.encode_params(g_msg);

		// construct call chain
		const yn_writer = arrow(a_params, castAs(yn_chain, typeRef(si_singleton)), typeRef(si_singleton));

		// create statement
		const yn_const = declareConst(`encode${this.exportedId(g_msg)}`, yn_writer, true);

		return [
			print(yn_const, [
				`Encodes a \`${g_msg.name}\` protobuf message: ${g_msg.comments}`,
				...(a_params as unknown as {thing: TsThing}[]).map(({thing:g_thing}) => `@param ${g_thing.calls.name} - \`${g_thing.field.name}\`: ${g_thing.field.comments}`),
				`@returns a strongly subtyped Uint8Array protobuf message`,
			]),
		];
	}

	msgCondenser(g_msg: AugmentedMessage): string[] {
		// open condenser output
		this.open(NeutrinoImpl.condenserFile(), true);

		const yn_enstructor = arrow(
			[
				param('g_msg', this.importType(g_msg)),
			],
			callExpr(this.importConstant(g_msg, 'encode'), g_msg.fieldList.map((g_field) => {
				// convert field to thing
				const g_thing = this.route(g_field);

				// resolve field type
				const g_resolved = g_field.typeName? this.resolveType(g_field.typeName): __UNDEFINED;

				// base accessor expression
				const yn_access = access('g_msg', g_field.name!);

				const f_condense = g_thing.calls.condense;

				// 
				if(F_IDENTITY !== f_condense) {
					const yn_applied = f_condense(yn_access);

					if(g_resolved && '.google.protobuf.Any' === g_field.typeName && g_field.options?.acceptsInterface) {
						const yn_encoded = typeRef('Encoded', [litType(string(g_field.options.acceptsInterface))]);
						return castAs(yn_applied, g_field.repeated? arrayType(yn_encoded): yn_encoded);
					}

					return yn_applied;
				}
				// message
				else if(g_resolved) {
					// enum
					if('enum' === g_resolved.form) {
						// import enum map
						const yn_enum = this.importConstant(g_resolved, 'JsonToProtoEnum');

						// repeated
						return g_field.repeated
							? callChain(
								chain(yn_access, 'map'),
								[arrow([param('w')], arrayAccess(yn_enum, exclaim(ident('w'))))]
							)
							// encode lookup
							: arrayAccess(yn_enum, exclaim(yn_access));
					}
					// message
					else {
						// ref field condenser
						const yn_condenser = ident(`condense${this.clashFreeTypeId(g_resolved)}`);

						// encode expr
						const f_encode = (yn: Expression) => callExpr(yn_condenser, [yn]);

						const yn_each = g_field.repeated
							? callExpr('map', [yn_access, yn_condenser])
							: g_thing.optional
								? callExpr('apply_opt', [yn_access, yn_condenser])
								: f_encode(yn_access);

						return yn_each;
					}
				}

				return yn_access;
			})),
			this.importType(g_msg, 'Encoded')
		);

		const yn_condense = declareConst(`condense${this.clashFreeTypeId(g_msg)}`, yn_enstructor, true);

		return [
			print(yn_condense, [
				`Takes the JSON representation of a message and converts it to its protobuf form`,
				`@returns {@link Encoded${this.clashFreeTypeId(g_msg)}}`,
			]),
			...this.msgExpander(g_msg),
		];
	}

	msgExpander(g_msg: AugmentedMessage): string[] {
		// open condenser output
		this.open(NeutrinoImpl.condenserFile(), true);

		// field identifiers, keyed by field idnex (not field number)
		const a_field_idents: Identifier[] = [];

		// bindings for continuous fields and higher fields, respectively
		const a_fields_continuous: ArrayBindingElement[] = [];
		const a_fields_access: BindingElement[] = [];

		// keep track of the expected field number to determine when there are gaps
		let n_field_expected = 1;
		let b_continuous = true;

		let a_single_access: [Identifier, number, AugmentedField, TsThing];

		// each field
		for(const g_field of g_msg.fieldList) {
			// convert field to thing
			const g_thing = this.route(g_field);

			// select which ident to use
			const yn_ident = g_thing.nests? ident(g_thing.nests.name): g_thing.calls.id;

			// add to ident list
			a_field_idents.push(yn_ident);

			// ref field number
			const i_number = g_field.number!;

			// field number does not immediately follow previous, or continuity is already broken
			GAPS:
			if(i_number !== n_field_expected++ || !b_continuous) {
				// still continuous and gap is clearable
				if(b_continuous && (i_number - (n_field_expected -1)) < N_MAX_PROTO_FIELD_NUMBER_GAP) {
					// clear the gap
					for(let i_fill=n_field_expected-1; i_fill<i_number; i_fill++) {
						// add to sequence
						a_fields_continuous.push(y_factory.createOmittedExpression());
					}

					// update expected field
					n_field_expected = i_number + 1;

					// proceed
					break GAPS;
				}

				// set continuity break
				b_continuous = false;

				// add to object biding
				a_fields_access.push(binding(yn_ident, numericLit(i_number-1)));
				a_single_access = [yn_ident, i_number-1, g_field, g_thing];

				// next
				continue;
			}

			// add to continuous params
			a_fields_continuous.push(binding(yn_ident));
		}


		const a_params: ParameterDeclaration[] = [];

		if(a_fields_continuous.length + a_fields_access.length) {
			// continuous
			if(b_continuous) {
				// destructure fields using array binding
				a_params.push(param(arrayBinding(a_fields_continuous)));
			}
			// not continuous
			else {
				const yn_payload = ident('a_fields');

				// capture fields in param
				a_params.push(param(yn_payload));

				// destructure continuous fields in array binding if any
				if(a_fields_continuous.length) {
					a_params.push(param(arrayBinding(a_fields_continuous), __UNDEFINED, false, yn_payload));
				}

				// destructure higher fields in object binding
				if(1 === a_fields_access.length) {
					a_params.push(param(
						a_single_access![0],
						__UNDEFINED,
						false,
						// recastAs(
						arrayAccess(yn_payload, a_single_access![1])
							// , this.importType(this.resolveType(a_single_access![2].typeName!), 'Decoded'))
					));
				}
				else {
					a_params.push(param(objectBinding(a_fields_access), __UNDEFINED, false, yn_payload));
				}
			}
		}


		// const yn_destruct = declareConst(
		// 	arrayBinding(g_msg.fieldList.map((g_field) => {
		// 		// convert field to thing
		// 		const g_thing = this.route(g_field);

		// 		// resolve field type
		// 		const g_resolved = g_field.typeName? this.resolveType(g_field.typeName): __UNDEFINED;

		// 		return binding(ident(g_field.name!));
		// 	})),
		// 	callExpr(this.importConstant(g_msg, 'decode'), [yn_payload])
		// );

		// const a_param_idents = g_msg.fieldList.map((g_field) => {
		// 	// convert field to thing
		// 	const g_thing = this.route(g_field);

		// 	// select which ident to use
		// 	return g_thing.nests? ident(g_thing.nests.name): g_thing.calls.id;
		// });

		const yn_body = arrow([
			// param(yn_payload),
			// param(
			// 	arrayBinding(g_msg.fieldList.map((g_field) => {
			// 		// convert field to thing
			// 		const g_thing = this.route(g_field);

			// 		// resolve field type
			// 		const g_resolved = g_field.typeName? this.resolveType(g_field.typeName): __UNDEFINED;

			// 		return binding(g_thing.calls.id);
			// 	})),
			// 	__UNDEFINED, false,
			// 	// callExpr(this.importConstant(g_msg, 'expand'), [yn_payload])
			// 	callExpr(`expand${this.clashFreeTypeId()}`)
			// ),

			// ...g_msg.fieldList.length
				// ? [param(
				// 	arrayBinding(g_msg.fieldList.map((g_field, i_field) =>
				// 		// // convert field to thing
				// 		// const g_thing = this.route(g_field);

				// 		// // resolve field type
				// 		// const g_resolved = g_field.typeName? this.resolveType(g_field.typeName): __UNDEFINED;

				// 		// return binding(g_thing.nests? g_thing.nests.name: g_thing.calls.id);

				// 		binding(a_param_idents[i_field])
				// 	))
				// )]
				// : [],

			...a_params.length? a_params: [],
		], objectLit(fold(g_msg.fieldList, (g_field, i_field) => {
			// convert field to thing
			const g_thing = this.route(g_field);

			// resolve field type
			const g_resolved = g_field.typeName? this.resolveType(g_field.typeName): __UNDEFINED;

			// const yn_src = g_thing.calls.id;
			const yn_src = a_field_idents[i_field];

			const f_expand = g_thing.calls.expand;

			let yn_expanded = f_expand(yn_src);

			// enum
			if('enum' === g_resolved?.form && !g_field.repeated) {
				yn_expanded = ternary(
					binary(y_factory.createToken(SyntaxKind.GreaterThanEqualsToken), castAs(yn_src, keyword('number')), numericLit(0)),
					f_expand(exclaim(yn_src)),
					ident('__UNDEFINED')
				);
			}
			else if(F_IDENTITY !== f_expand) {
				if(g_field.typeName && !['.google.protobuf.Timestamp', '.google.protobuf.Duration'].includes(g_field.typeName)) {
					yn_expanded = andAnd(yn_src, yn_expanded);
				}
			}

			// const yn_expanded = g_field.repeated
			// 	? callExpr('map', [yn_src, yn_condenser])
			// 	: g_thing.optional
			// 		? callExpr('apply_opt', [yn_access, yn_condenser])
			// 		: f_expand(yn_access);


			return {
				[g_field.name!]: yn_expanded,
			};
		})));

		const yn_expand = declareConst(
			`expand${this.clashFreeTypeId(g_msg)}`,
			yn_body, true,
			funcType([param('a_fields', this.importType(g_msg, 'Decoded'))], this.importType(g_msg))
		);

		// const si_name = this.exportedId(g_msg);

		// const yn_alias = declareAlias(si_name, typeLit(fold(g_msg.fieldList, g_field => ({
		// 	[g_field.name!]: [this.route(g_field).json!.type, g_field.optional],
		// }))), true);

		return [
			print(yn_expand, [
				`Takes the protobuf representation of a message and converts it to its JSON form \`${g_msg.path.slice(1)}\` - ${g_msg.comments}`,
			]),
		];
	}

	// 
	msgDecoder(g_msg: AugmentedMessage): string[] {
		// open proto source of msg
		this.open(g_msg.source);

		// whether or not the fields are continuous and don't need arbitrary indexes
		let b_continuous = true;

		// determine whether the decoded values are processed before being returned
		// eslint-disable-next-line prefer-const
		let b_processed = false;

		const a_types: [string, boolean, TypeNode][] = [];
		const h_things: Dict<TsThing> = {};
		const a_hints: (ProtoHint | ProtoHint[] | Expression)[] = [];
		const a_returns: Expression[] = [];

		// prep generic args and destructure bindings, omitting 0th item
		const a_generics: TypeNode[] = [];
		const a_bindings: Array<OmittedExpression | BindingElement> = [];

		const a_decoders: Expression[] = [];

		// arbitrary-index fields
		const h_arbitrary_fields: Record<number, {
			thing: TsThing;
			type: TypeNode;
			generic: TypeNode;
			return: Expression;
			hint: Expression;
			binding: BindingElement;
		}> = {};

		// each field in sorted order
		let i_expect = 1;
		g_msg.fieldList.forEach((g_field) => {
			const i_number = g_field.number!;

			// found a gap, fields are not continuous
			if(i_number !== i_expect) {
				// mark as processed
				b_processed = true;

				// gap is skippable
				const n_gap = i_number - i_expect;
				if(n_gap < N_MAX_PROTO_FIELD_NUMBER_GAP) {
					// clear the gap
					for(let i_omit=0; i_omit<n_gap; i_omit++) {
						// type should not be used
						a_generics.push(keyword('any'));

						// omit binding
						a_bindings.push(y_factory.createOmittedExpression());

						// add hint to arg
						a_hints.push(ProtoHint.NONE);

						a_returns.push(ident('__UNDEFINED'));

						// add return type to tuple
						a_types.push([`w_${i_omit}`, true, keyword('undefined')]);
					}
				}
				// gap is not skippable; flag as not continuous
				else {
					b_continuous = false;
				}
			}

			i_expect = i_number + 1;

			// prep components
			let z_hint: ProtoHint | ProtoHint[] | Expression;
			let yn_generic: TypeNode;
			let yn_return: Expression;

			// convert to thing
			const g_thing = this.route(g_field);

			// prep identifier
			let yn_ident = g_thing.calls.id;

			let yn_type: TypeNode;
			let s_type_label: string;

			// message is nested inside of field
			const g_nests = g_thing.nests;
			if(g_nests) {
				// set hint
				z_hint = g_nests.hints;

				s_type_label = g_nests.name;

				// overwrite identifier
				yn_ident = ident(s_type_label);

				yn_type = g_nests.type;

				// defer
				// yn_generic = g_thing.field.repeated? arrayType(yn_type): yn_type;
				yn_generic = yn_type = g_thing.field.repeated? arrayType(yn_type): yn_type;

				yn_return = yn_ident;

				if(g_nests.parser) a_decoders[i_number-1] = g_nests.parser;

				// // add expression to return list
				// yn_return = g_nests.parse(yn_ident);

				// // mark as processed if processing occurs
				// if(F_IDENTITY !== g_nests.parse) {
				// 	b_processed = true;
				// }
			}
			else {
				// infer hint from write type
				z_hint = (g_field.repeated? ProtoHint.NONE: ProtoHint.SINGULAR) | ({
					v: 's' === g_thing.calls.name[0]? ProtoHint.BIGINT: ProtoHint.NONE,
					g: ProtoHint.BIGINT,
					s: ProtoHint.STRING,
					b: H_FIELD_TYPES.TYPE_MESSAGE === g_field.type? ProtoHint.MESSAGE: ProtoHint.NONE,
				}[g_thing.proto.writer.toLowerCase()] || 0);

				// apply same logic to generic parameter
				const yn_primitive = {
					v: 's' === g_thing.calls.name[0]? keyword('string'): keyword('number'),
					g: keyword('string'),
					s: keyword('string'),
					b: H_FIELD_TYPES.TYPE_MESSAGE === g_field.type? keyword('any'): typeRef('Uint8Array'),
				}[g_thing.proto.writer.toLowerCase()] || keyword('unknown');

				// add to generic type arg
				yn_generic = g_field.repeated? arrayType(yn_primitive): yn_primitive;

				// add expression to return list
				yn_return = yn_ident;

				s_type_label = g_thing.calls.name;
				yn_type = g_thing.calls.return_type;
			}

			const yn_binding = binding(yn_ident);

			// fields up to this point are continuous (or gaps have been tolerated)
			if(b_continuous) {
				a_hints.push(z_hint);
				a_generics.push(yn_generic);
				a_returns.push(yn_return);
				h_things[i_number-1] = g_thing;

				// add return type to tuple
				a_types.push([s_type_label, g_thing.optional, yn_type]);

				a_bindings.push(yn_binding);
			}
			// not continuous
			else {
				h_arbitrary_fields[i_number-1] = {
					thing: g_thing,
					hint: is_number(z_hint)
						? literal(z_hint)
						: is_array(z_hint)
							? arrayLit(z_hint.map(x => literal(x)))
							: z_hint,
					generic: yn_generic,
					return: yn_return,
					type: yn_type,
					binding: yn_binding,
				};
			}

			// // repeated type; bind items
			// if(g_field.repeated) {
			// 	return binding(yn_ident);
			// }
			// // single item; unwrap it
			// else {
			// 	return arrayBinding([binding(yn_ident)]);
			// }
		});

		// build args
		const a_args: Expression[] = [
			// payload argument
			ident('atu8_payload'),
		];

		// 2nd arg is needed; add hints if there are any
		if(a_hints.length || a_decoders.length) {
			// optimization: all hints are numbers less than 16
			if(a_hints.length && a_hints.length < 8 && a_hints.every(z => is_number(z) && (z as number) < 16)) {
				a_args.push(literal(
					(a_hints as ProtoHint[]).slice().reverse()
						.reduce((xm_out, z) => (xm_out << 4) | z, 0)
				));
			}
			else {
				a_args.push(a_hints.length
					? arrayLit(a_hints.map(z => is_number(z)
						? literal(z)
						: is_array(z)
							? arrayLit(z.map(x => literal(x)))
							: z))
					: ident('__UNDEFINED'));
			}
		}

		// nested decoders are present
		if(a_decoders.length) {
			// prep full-width array literal, using `0` to omit slots where one is not used
			const a_fill: Expression[] = Array(a_decoders.length).fill(numericLit(0));

			// set decoder in each position where one is defined
			a_decoders.forEach((yn, i) => a_fill[i] = yn);

			// add call arg
			a_args.push(arrayLit(a_fill));
		}

		// call expression to decode payload
		const yn_decode = callExpr('decode_protobuf', a_args, [typeRef(`Decoded${this.exportedId(g_msg)}`)]);

		let yn_init!: Expression;
		let yn_body!: ConciseBody;

		// prep function params
		const a_params = [
			param(ident('atu8_payload'), typeRef('Uint8Array')),
		];

		// create the return types by transforming each TsThing item to a tuple entry descriptor
		let yn_return: TypeNode = tuple(a_types);


		let g_param_destructure: ParameterDeclaration | undefined;
		let a_params_arbitrary: ParameterDeclaration[] | undefined;

		// in-parameter processing required
		if(b_processed) {
			// set arrow function's body, which is also the return value
			yn_body = arrayLit(a_returns);

			// destructuring array bindings will be used
			const yn_destruct_array_bindings = arrayBinding(a_bindings);

			// add init param
			g_param_destructure = param(b_continuous? yn_destruct_array_bindings: 'a_decoded', __UNDEFINED, false, yn_decode);

			// not continuous
			if(!b_continuous) {
				// need to destructure arbitrary indexes
				a_params_arbitrary = [
					// e.g., `{1023: field_1024} = a_decoded`
					param(objectBinding(map_entries(h_arbitrary_fields, ([si_field, g]) => {
						const yn_ident = ident((g.binding.name as Identifier).text);
						return binding(yn_ident, numericLit(+si_field));
					})), __UNDEFINED, false, ident('a_decoded')),
				];

				// there are also indexed fields to destructure with aray binding
				if(a_bindings.length) {
					a_params_arbitrary.push(
						// e.g., `[field_1, field_2] = a_decoded`
						param(yn_destruct_array_bindings, __UNDEFINED, false, ident('a_decoded'))
					);
				}

				// wrap return value, e.g., `assign([field_1], {1023: field:1024})`
				yn_body = callExpr('assign', [
					yn_body,
					objectLit(transform_values(h_arbitrary_fields, g_arb => g_arb.binding.name as Identifier)),
				]);

				// extend return type with intersection
				yn_return = intersection([
					yn_return,

					// add arbitrary-index fields to type lit, each one with question token (i.e., optional)
					typeLit(transform_values(h_arbitrary_fields, g => [g.type, g.thing.optional] as [TypeNode, boolean])),
				]);
			}
		}
		// simple decoder; all logic happens in body
		else {
			yn_body = yn_decode;
		}

		// override the type
		const si_override = this._h_params.decoder_types?.[g_msg.path.slice(1)];
		if(si_override) yn_return = typeRef(si_override);

		// declare type def
		const si_decoded_type = `Decoded${this.exportedId(g_msg)}`;
		const yn_type_decl = declareAlias(si_decoded_type, yn_return, true);

		// change return to type ref
		yn_return = typeRef(si_decoded_type);

		// function has a body
		if(yn_body) {
			// in-parameter destructuring
			const yn_destructure = arrow([
				...a_params,
				...g_param_destructure
					? [
						g_param_destructure,
						...a_params_arbitrary || [],
					]
					: [],
			], yn_body);

			// set statement initializer
			yn_init ||= g_param_destructure
				? castAs(
					castAs(
						parens(yn_destructure),
						keyword('unknown')
					),
					funcType([
						...a_params,
						param('RESERVED', keyword('never'), true),
					], yn_return)
				)
				: castAs(yn_destructure, yn_return);
		}

		// create decoder statement
		const yn_statement = declareConst(`decode${this.exportedId(g_msg)}`, yn_init, true);

		// print statement with docs
		return [
			print(yn_type_decl, [
				`A decoded protobuf ${g_msg.name!.replace(/^Msg|Response$/g, '')} message`,
				'',
				...1 === keys(h_things).length
					? [`Alias for: ${values(h_things)[0].field.name} - ${values(h_things)[0].field.comments}`]
					: [
						'Tuple where:',
						...concat_entries(h_things, (s_index, g_type) => `  - ${s_index}: ${g_type.field.name} - ${g_type.field.comments}`),
						...map_entries(h_arbitrary_fields, ([si_index, g_arb]) => ` - ${si_index}: ${g_arb.thing.field.name} - ${g_arb.thing.field.comments}`),
					],
			]),
			print(yn_statement, [
				`Decodes a protobuf ${g_msg.name!.replace(/^Msg|Response$/g, '')} message`,
				'@param atu8_payload - raw bytes to decode',
				...g_param_destructure
					? ['@param RESERVED - a second argument is explicitly forbidden. make sure not to pass this function by reference to some callback argument']
					: [],
				`@returns a {@link Decoded${this.exportedId(g_msg)}}`,
			]),
		];
	}

	msgDestructor(g_msg: AugmentedMessage): string[] {
		// open proto source of msg
		this.open(g_msg.source);

		const si_name = this.exportedId(g_msg);

		// continuous sequence
		const a_sequence: Expression[] = [];
		const h_assigns: Record<number, Expression> = {};
		const a_returns: [string, boolean, TypeNode][] = [];
		const h_indicies: Record<number, [TypeNode, boolean]> = {};

		// keep track of the expected field number to determine when there are gaps
		let n_field_expected = 1;
		let b_continuous = true;

		// each field
		for(const g_field of g_msg.fieldList) {
			const g_thing = this.route(g_field);

			// prep expr
			const yn_access = g_thing.calls.from_json(access('g_struct', g_field.name!));

			// no number
			const i_number = g_field.number!;
			if('number' !== typeof i_number) {
				throw new Error(`Field is missing explicit number: ${g_field.name}`);
			}

			// field number does not immediately follow previous
			GAPS:
			if(i_number !== n_field_expected++) {
				// still continuous and gap is clearable
				if(b_continuous && (i_number - (n_field_expected -1)) < N_MAX_PROTO_FIELD_NUMBER_GAP) {
					// clear the gap
					for(let i_fill=n_field_expected-1; i_fill<i_number; i_fill++) {
						// add to sequence
						a_sequence.push(ident('__UNDEFINED'));

						// void return
						a_returns.push(['EMPTY', true, keyword('void')]);
					}

					// update expected field
					n_field_expected = i_number + 1;

					// proceed
					break GAPS;
				}

				// set continuity break
				b_continuous = false;

				// add to assign
				h_assigns[i_number] = yn_access;

				// add to return
				h_indicies[i_number] = [g_thing.destruct_type, g_thing.optional];

				// next
				continue;
			}

			// add to sequence
			a_sequence.push(yn_access);

			// add to returns
			a_returns.push([g_field.name!, g_thing.optional, g_thing.destruct_type]);
		}

		// base array
		const yn_base = arrayLit(a_sequence);

		// function body
		const yn_body = Object.keys(h_assigns).length
			? callExpr('assign', [yn_base, objectLit(h_assigns)])
			: yn_base;

		// final return type
		let yn_return: TypeNode = tuple(a_returns);

		// non-continuous field numbers, wrap in intersection type
		if(Object.keys(h_indicies).length) {
			yn_return = intersection([yn_return, typeLit(h_indicies)]);
		}

		// request object needs to be recast from intentionally weakened fields
		const yn_body_casted = /Request$/.test(si_name)? castAs(yn_body, unknown()): yn_body;

		// content
		const yn_const = declareConst(`destruct${si_name}`, arrow([
			param('g_struct', typeRef(si_name)),
		], castAs(yn_body_casted, yn_return)), true);

		return [
			print(yn_const, [
				`Destructures the fields of a {@link ${si_name}} JSON message into a tuple of parsed ES equivalents`,
				`@param g_struct - the JSON message`,
				`@returns a tuple where:`,
				...g_msg.fieldList.map(g_field => `  - ${g_field.number! - 1}: ${g_field.name!} - ${g_field.comments}`),
			]),
			...this.msgAccessor(g_msg),
		];
	}

	enumId(g_enum: AugmentedEnum, si_mode: 'Proto' | 'Json' | 'ProtoToJson' | 'JsonToProto') {
		return `${si_mode}Enum${this.exportedId(g_enum)}`;
	}

	enums(g_enum: AugmentedEnum): string[] {
		// open proto source of msg
		this.open(g_enum.source);

		// enum path
		const sr_enum = g_enum.path.slice(1);

		// enum ids
		const si_enum_proto = this.enumId(g_enum, 'Proto');
		const si_enum_json = this.enumId(g_enum, 'Json');

		// ident refs to exported values
		const a_values_proto: string[] = [];
		const a_values_json: string[] = [];

		// types for enum alias
		const a_types_proto: TypeNode[] = [];
		const a_types_json: TypeNode[] = [];

		// mapping entries between modes
		const h_map_proto_json: Dict<[Expression, Expression]> = {};
		const h_map_json_proto: Dict<[Expression, Expression]> = {};

		// output strings
		const a_outs: string[] = [];

		// each value
		for(const g_value of g_enum.valueList) {
			// value name
			const si_name = g_value.name!;

			// value text
			const s_value = g_value.options?.enumvalueCustomname || si_name;

			// enum symbol suffix
			const si_redundant = snake(g_enum.name!).toUpperCase();  // .replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
			const si_symbol = this.exportedConst(g_enum).replace(new RegExp(`_${si_redundant}$`), '')
				+'_'+si_name;


			// proto value const id
			const si_proto = `XC_PROTO_${si_symbol}`;

			// add id to values list
			a_values_proto.push(si_proto);

			// add ref to types list
			a_types_proto.push(typeOf(ident(si_proto)));

			// declare proto const
			const yn_proto = declareConst(si_proto, numericLit(g_value.number!), true);


			// json value const id
			const si_json = `SI_JSON_${si_symbol}`;

			// add id to values list
			a_values_json.push(si_json);

			// add ref to types list
			a_types_json.push(typeOf(ident(si_json)));

			// declare json const
			const yn_json = declareConst(si_json, string(si_name), true);


			// print values to putput
			a_outs.push(...[
				// proto value
				print(yn_proto, [
					`Protobuf enum value for \`${sr_enum}\`.`,
					'',
					`**${si_name}** - ${g_value.comments}`,
					'',
					`Belongs to enum type {@link ${si_enum_proto}}`,
				]),
				// json value
				print(yn_json, [
					`JSON enum value for \`${sr_enum}\`.`,
					'',
					`**${si_name}** - ${g_value.comments}`,
					'',
					`Belongs to enum type {@link ${si_enum_json}}`,
				]),
			]);

			// add mappings
			h_map_proto_json[si_proto] = [ident(si_proto), ident(si_json)];
			h_map_json_proto[si_json] = [ident(si_json), ident(si_proto)];
		}

		// print proto enum type
		a_outs.push(print(declareAlias(si_enum_proto, union(a_types_proto), true), [
			`Raw protobuf enum values for \`${sr_enum}\` to be used when passing to an encoder or comparing to a decoded protobuf value.`,
			'',
			'Values:',
			...a_values_proto.map(s => `  - {@link ${s}}`),
		]));

		// print json enum type
		a_outs.push(print(declareAlias(si_enum_json, union(a_types_json), true), [
			`JSON enum values for \`${sr_enum}\` to be used when passing to a gRPC-gateway method or comparing to a response value`,
			'',
			'Values:',
			...a_values_json.map(s => `  - {@link ${s}}`),
		]));

		// print maps
		a_outs.push(print(declareConst(
			this.enumId(g_enum, `ProtoToJson`),
			objectLit(h_map_proto_json),
			true,
			typeRef('Record', [typeRef(si_enum_proto), typeRef(si_enum_json)])
		), [
			`Maps a protobuf enum int value for \`${sr_enum}\` to is JSON equivalent enum string value`,
		]));
		a_outs.push(print(declareConst(
			this.enumId(g_enum, `JsonToProto`),
			objectLit(h_map_json_proto),
			true,
			typeRef('Record', [typeRef(si_enum_json), typeRef(si_enum_proto)])
		), [
			`Maps a JSON enum string value for \`${sr_enum}\` to is protobuf equivalent enum int value`,
		]));

		// return string list
		return a_outs;
	}

	msgAccessor(g_msg: AugmentedMessage): string[] {
		// open proto source of msg
		this.open(g_msg.source);

		const si_name = this.exportedId(g_msg);

		const yn_alias = declareAlias(si_name, typeLit(fold(g_msg.fieldList, (g_field) => {
			const g_resolved = this.route(g_field);

			// if the message is a "Request", then weaken the accessor's fields datatypes
			const yn_type = /Request$/.test(g_msg.name || '')? g_resolved.json!.weak: g_resolved.json!.type;

			return {
				[g_field.name!]: g_field.optional
					? [union([
						yn_type,
						keyword('undefined'),
					]), true]
					: [yn_type, false],
			};
		})), true);

		return [
			// message type key
			print(declareConst(
				`SI_MESSAGE_TYPE_${snake(si_name).toUpperCase()}`,
				string('/'+g_msg.path.slice(1)),
				true
			), [
				`Message type string constant`,
			]),

			print(yn_alias, [
				`JSON serialization of \`${g_msg.path.slice(1)}\` - ${g_msg.comments}`,
			]),
		];
	}
}
