import type {TsThing} from './common';
import type {AugmentedFile, AugmentedMessage, AugmentedMethod, ExtendedMethodOptions} from './env';

import type {TypesDict} from './plugin';
import type {FileCategory} from './rpc-impl';
import type {Statement, TypeNode, Expression, ParameterDeclaration, ConciseBody, OmittedExpression, BindingElement} from 'typescript';

import {__UNDEFINED, fold, oderac, proper, snake, type Dict, escape_regex} from '@blake.regalia/belt';
import {default as pb} from 'google-protobuf/google/protobuf/descriptor_pb';
import {ts} from 'ts-morph';

import {H_FIELD_TYPE_TO_HUMAN_READABLE, field_router, map_proto_path} from './common';
import {XC_HINT_NUMBER, XC_HINT_STRING, XC_HINT_BIGINT, XC_HINT_SINGULAR, XC_HINT_BYTES, N_MAX_PROTO_FIELD_NUMBER_GAP} from './constants';
import {RpcImplementor} from './rpc-impl';
import {access, arrayAccess, arrayBinding, arrayLit, arrow, binding, call, castAs, declareConst, funcType, ident, intersection, literal, numericLit, param, parens, print, string, tuple, type, typeLit, typeRef, union, y_factory} from './ts-factory';

type ReturnThing = {
	type: TypeNode;
	parser: Expression | null;
	things: TsThing[];
};

const {
	FieldDescriptorProto,
} = pb;

const {
	SyntaxKind,
} = ts;

type Draft = {
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
	protected _si_const = '';
	protected _s_path_prefix = '';

	protected _g_heads: Draft['heads'] = reset_heads();
	protected _g_consts: Draft['consts'] = reset_consts();
	protected _h_drafts: Dict<Draft> = {};

	protected _p_output = '';

	constructor(h_types: TypesDict) {
		super(h_types);

		this._h_router = field_router(this);
	}

	override open(g_proto: AugmentedFile): void {
		super.open(g_proto);

		// would-be output file nam
		const p_output = this._p_output = map_proto_path(g_proto)+'.ts';

		// open draft
		const g_draft = this._h_drafts[p_output] ||= {
			heads: reset_heads(),
			consts: reset_consts(),
		};

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
		return [
			...this._g_heads[si_category],
		];
	}

	override body(si_category: FileCategory): string[] {
		return [
			...oderac(this._g_consts[si_category], (si_const, yn_const) => print(yn_const)),
		];
	}

	override accepts(si_interface: string, s_alias: string) {
		const si_type = `Accepts${proper(s_alias)}`;

		const yn_type = y_factory.createTypeAliasDeclaration([
			y_factory.createToken(SyntaxKind.ExportKeyword),
		], ident(si_type), __UNDEFINED, typeRef('ImplementsInterfaces', [
			union([
				string(si_interface),
				// ...g_opts.implementsInterfaceList.map(si_interface => string(si_interface)),
			].map(yn => typeLit(yn))),
		]));

		// add to preamble
		this._g_heads.encoder.push(print(yn_type));

		return typeRef(si_type);
	}

	get path(): string {
		return this._p_output;
	}

	generate_return(g_output: AugmentedMessage, g_input: AugmentedMessage): ReturnThing {
		// remove redundant fields
		const a_fields = g_output.fieldList.filter((g_field) => {
			// test each field in input
			for(const g_test of g_input.fieldList) {
				// same type and identical name; remove
				if(g_test.type === g_field.type && g_test.name === g_field.name) {
					return false;
				}
			}

			// pass; keep
			return true;
		});

		const a_returns = a_fields.map((g_field) => {
			const g_thing = this.route(g_field);

			return {
				thing: g_thing,

				type: g_thing.calls.type,

				parser: g_thing.calls.from_json(
					access('g', snake(g_field.name!))
				),
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


	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	pattern_string_to_ast_node(sx_pattern: string, g_input: AugmentedMessage) {
		const {
			_si_const,
			_s_path_prefix,
		} = this;

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
			const i_match = d_match.index!;

			// push constant string part
			if(i_prev !== i_match) {
				a_parts.push(y_factory.createStringLiteral(sx_pattern.slice(i_prev, i_match)));
			}

			// param id
			const si_param = d_match[1];

			// lookup field
			const g_field = h_fields[si_param];

			// push param
			a_parts.push(this.route(g_field).calls.to_json);

			// remove from unused
			delete h_fields_unused[si_param];

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
			const a_properties = oderac(h_fields_unused, (si_param, g_field) => y_factory.createPropertyAssignment(
				ident(si_param),
				this.route(g_field).calls.to_json
			));

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



	override gateway(
		sr_path_prefix: string,
		g_method: AugmentedMethod,
		g_input: AugmentedMessage,
		g_output: AugmentedMessage
	): string {
		// ref path parts
		const g_parts = g_method.service.source.parts;

		const si_module_ident = g_parts.module.replace(/\//g, '_');

		// 
		const si_const = this._si_const = `SR_LCD_${g_parts.vendor.toUpperCase()}_${si_module_ident.toUpperCase()}`;

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

		const yn_call = call('restful_grpc', [
			// request formatter
			arrow(a_args.map(g_arg => param(g_arg.calls.id)), g_pattern.expr),

			// response parser
			g_return.parser? arrow([param('g')], g_return.parser): ident('F_IDENTITY'),

			// request init for POST
			...sx_path_http_post
				? [
					numericLit(1),
					// objectLit({
					// 	method: string('POST'),
					// }),
				]
				: [],
		], [
			// 1st generics param is function arguments
			tuple(a_args.map(g_arg => [
				g_arg.calls.id,
				is_optional(g_arg),
				g_arg.calls.type,
			])),

			// 2nd generics param is parsed response
			g_return.type,
		]);

		// const si_action_prefix = si_service
		const si_action_prefix = sx_path_http_get? 'query': 'submit';
		const yn_statement = declareConst(`${si_action_prefix}${proper(g_parts.vendor)}${proper(si_module_ident)}${si_method}`, yn_call, true);

		// service, reflectionService
		// if(sx_path_http_get && 'query' !== si_service.toLowerCase()) debugger;

		// service, 
		// if(sx_path_http_post) debugger;

		// upper-case first letter of comment if present
		let s_line_0 = g_method.comments;
		if(s_line_0) s_line_0 = s_line_0[0].toUpperCase()+s_line_0.slice(1);

		// init comment lines
		const a_comment_lines = [s_line_0];
		a_comment_lines.push(`@param z_req - URL origin of LCD endpoint or {@link RequestInit}`);
		a_comment_lines.push(...a_docs_parmas);


		const a_returns = g_return.things;
		if(!a_returns.length) {
			a_comment_lines.push(`@returns an empty object`);
		}
		else {
			const a_docs_returns = a_returns.map((g_thing) => {
				const g_field = a_returns[0].field;
				const s_comment = g_field.comments.replace(new RegExp(`^${escape_regex(g_field.name!)}\\s+`), '');

				return `${s_comment || `the '${g_field.name}' response property`}`;
			});

			if(1 === a_returns.length) {
				a_comment_lines.push(`@returns ${a_docs_returns[0]}`);
			}
			else {
				a_comment_lines.push(`@returns a tuple where:`);

				a_docs_returns.forEach((s_doc, i_doc) => {
					a_comment_lines.push(`  - ${i_doc}: ${a_returns[i_doc].field.name} - ${s_doc}`);
				});
			}
		}

		return print(yn_statement, a_comment_lines);
	}

	encodeParams(g_msg: AugmentedMessage): [ParameterDeclaration[], Expression] {
		// instantiate writer
		let yn_chain = call('Protobuf', [], __UNDEFINED, '...');

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
			const a_args: Expression[] = [g_thing.calls.to_proto];

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
			yn_chain = call(
				access(yn_chain, g_thing.proto.writer),
				a_args,
				__UNDEFINED,
				`${s_comment_type}${g_field.repeated? '[]': ''} ${g_field.name} = ${g_field.number}`
			);

			// create parameter
			const yn_param = g_thing.proto.prefers_call
				? param(g_thing.calls.id, g_thing.calls.type, g_thing.optional)
				: param(g_thing.proto.id, g_thing.proto.type, g_thing.optional);

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

	anyEncoder(
		g_msg: AugmentedMessage
	): string {
		// implements interface
		const a_interfaces = g_msg.options?.implementsInterfaceList;
		if(!a_interfaces) throw new Error('No interface option');

		// prep unique type
		const si_singleton = `Actual${g_msg.name}`;

		// prep 'typeUrl' property for `Any` protobuf message
		const p_type = `/${g_msg.source.pb_package}.${g_msg.name}`;

		// declare unique type
		const yn_type = y_factory.createTypeAliasDeclaration([
			y_factory.createToken(SyntaxKind.ExportKeyword),
		], ident(si_singleton), __UNDEFINED, intersection([
			// Encoded<si_message>
			typeRef('Encoded', [
				typeLit(string(p_type)),
			]),
			// ImplementsInterfaces<as_interfaces>
			typeRef('ImplementsInterfaces', [
				union(a_interfaces.map(si_interface => typeLit(string(si_interface)))),
			]),
		]));

		// add to preamble
		this._g_heads.any.push(print(yn_type));

		// encode params and build chain
		const [a_params, yn_chain] = this.encodeParams(g_msg);

		// wrap in any
		const yn_any = call('any', [
			string(p_type),
			yn_chain,
		]);

		// construct writer
		const yn_writer = arrow(a_params, castAs(yn_any, typeRef(si_singleton)));

		// create statement
		const yn_const = declareConst(`any${g_msg.name!}`, yn_writer, true);

		return print(yn_const, [
			`Encodes a \`${g_msg.name}\` protobuf message wrapped in the \`Any\` container: ${g_msg.comments}`,
			...(a_params as unknown as {thing: TsThing}[]).map(({thing:g_thing}) => `@param ${g_thing.calls.name} - \`${g_thing.field.name}\`: ${g_thing.field.comments}`),
			`@returns a strongly subtyped Uint8Array representing an \`Any\` protobuf message`,
		]);
	}

	methodEncoder(
		g_method: AugmentedMethod,
		g_input: AugmentedMessage
	): string {
		const g_parts = g_method.service.source.parts;

		// prep unique type
		const si_singleton = `Encoded${proper(g_parts.vendor)}${g_method.name}`;

		// declare unique type
		const yn_type = y_factory.createTypeAliasDeclaration([
			y_factory.createToken(SyntaxKind.ExportKeyword),
		], ident(si_singleton), __UNDEFINED, typeRef('Encoded', [
			typeLit(string(`/${g_method.service.source.pb_package}.${g_method.name!}`)),
		]));

		// add type decl to preamble
		this._g_heads.encoder.push(print(yn_type));

		// encode params and build chain
		const [a_params, yn_chain] = this.encodeParams(g_input);

		// construct call chain
		const yn_writer = arrow(a_params, castAs(yn_chain, typeRef(si_singleton)));

		// create statement
		const yn_const = declareConst(`msg${proper(g_parts.vendor)}${g_method.name!}`, yn_writer, true);

		return print(yn_const, [
			`Encodes a \`${g_method.name}\` protobuf message: ${g_method.comments}`,
			...(a_params as unknown as {thing: TsThing}[]).map(({thing:g_thing}) => `@param ${g_thing.calls.name} - \`${g_thing.field.name}\`: ${g_thing.field.comments}`),
			`@returns a strongly subtyped Uint8Array protobuf message`,
		]);
	}

	msgEncoder(g_msg: AugmentedMessage): string {
		const g_parts = g_msg.source.parts;

		// prep unique type
		const si_singleton = `Encoded${proper(g_parts.vendor)}${g_msg.name}`;

		// declare unique type
		const yn_type = y_factory.createTypeAliasDeclaration([
			y_factory.createToken(SyntaxKind.ExportKeyword),
		], ident(si_singleton), __UNDEFINED, typeRef('Encoded', [
			typeLit(string(`/${g_msg.source.pb_package}.${g_msg.name!}`)),
		]));

		// add type decl to preamble
		this._g_heads.encoder.push(print(yn_type));

		// encode params and build chain
		const [a_params, yn_chain] = this.encodeParams(g_msg);

		// construct call chain
		const yn_writer = arrow(a_params, castAs(yn_chain, typeRef(si_singleton)));

		// create statement
		const yn_const = declareConst(`msg${proper(g_parts.vendor)}${g_msg.name!}`, yn_writer, true);

		return print(yn_const, [
			`Encodes a \`${g_msg.name}\` protobuf message: ${g_msg.comments}`,
			...(a_params as unknown as {thing: TsThing}[]).map(({thing:g_thing}) => `@param ${g_thing.calls.name} - \`${g_thing.field.name}\`: ${g_thing.field.comments}`),
			`@returns a strongly subtyped Uint8Array protobuf message`,
		]);
	}

	// 
	msgDecoder(g_msg: AugmentedMessage): string | undefined {
		let b_monotonic = true;

		let b_flat = true;

		const a_types: TsThing[] = [];
		const a_returns: Expression[] = [];
		const a_hints: Expression[] = [];

		// prep bindings
		const a_bindings: Array<OmittedExpression | BindingElement> = [];

		// each field
		g_msg.fieldList.forEach((g_field, i_field) => {
			const i_number = g_field.number!;

			// found a gap, fields are not monotonic
			if(i_number !== i_field + 1) {
				// gap is skippable
				const n_gap = i_number - (i_field + 1);
				if(n_gap < N_MAX_PROTO_FIELD_NUMBER_GAP) {
					// clear the gap
					for(let i_omit=0; i_omit<n_gap; i_omit++) {
						a_bindings.push(y_factory.createOmittedExpression());
						a_hints.push(literal(0));
					}
				}
				// gap is not skippable; flag as not monotonic
				else {
					return b_monotonic = false;
				}
			}

			// convert to thing
			const g_thing = this.route(g_field);

			// prep identifier
			let yn_ident = g_thing.calls.id;

			// message is nested inside of field
			const g_nests = g_thing.nests;
			if(g_nests) {
				// mark as not flat
				b_flat = false;

				// set hint
				a_hints.push(g_nests.hints);

				// overwrite identifier
				yn_ident = ident(g_nests.name);

				// add expression to return list
				a_returns.push(g_nests.parse(yn_ident));
			}
			else {
				// infer hint from write type
				a_hints.push(literal((g_field.repeated? 0: XC_HINT_SINGULAR) | ({
					v: 's' === g_thing.calls.name[0]? XC_HINT_BIGINT: XC_HINT_NUMBER,
					s: XC_HINT_STRING,
					b: XC_HINT_BYTES,
				}[g_thing.proto.writer.toLowerCase()] || 0)));

				// add expression to return list
				a_returns.push(yn_ident);
			}

			// set return type
			a_types.push(g_thing);

			a_bindings.push(binding(yn_ident));

			// // repeated type; bind items
			// if(g_field.repeated) {
			// 	return binding(yn_ident);
			// }
			// // single item; unwrap it
			// else {
			// 	return arrayBinding([binding(yn_ident)]);
			// }
		});


		// message fields are not monotonic
		if(!b_monotonic) {
			console.warn(`WARNING: Message ${g_msg.name} in ${g_msg.source.name} has too wide of a gap between non-monotonic fields`);
			return;
		}

		const yn_decode = call('decode_protobuf', [ident('atu8_payload'), arrayLit(a_hints)]);


		let yn_init: Expression;
		let yn_body!: ConciseBody;

		// prep function params
		const a_params = [
			param(ident('atu8_payload'), typeRef('Uint8Array')),
		];

		let g_param_destructure!: ParameterDeclaration;

		const yn_return = 1 === a_types.length
			? a_types[0].calls.id
				? union([a_types[0].calls.return_type, type('undefined')])
				: a_types[0].calls.return_type
			: tuple(a_types.map(g_thing => [g_thing.calls.name, g_thing.optional, g_thing.calls.return_type]));

		// single field; use simplified response
		if(1 === a_bindings.length) {
			// flat type
			if(b_flat) {
				yn_init = castAs(ident('decode_protobuf_r0'), funcType(a_params, yn_return));
			}
			// not flat
			else {
				yn_body = arrayAccess(yn_decode, numericLit(0));
			}
		}
		else {
			// add init param
			g_param_destructure = param(arrayBinding(a_bindings), __UNDEFINED, false, yn_decode);

			// const yn_destructure = declareConst(
			// 	arrayBinding(a_bindings),
			// 	yn_decode
			// );

			// yn_body = block([
			// 	yn_destructure,
			// 	doReturn(arrayLit([])),
			// ]);

			yn_body = arrayLit(a_returns);
		}

		const yn_destructure = yn_body
			? arrow([
				...a_params,
				...g_param_destructure? [g_param_destructure]: [],
			], yn_body, g_param_destructure? __UNDEFINED: yn_return)
			: string('ERROR');

		yn_init ||= g_param_destructure
			? castAs(
				castAs(
					parens(yn_destructure),
					type('unknown')
				),
				funcType([
					...a_params,
					param('RESERVED', type('never'), true),
				], yn_return)
			)
			: yn_destructure;

		const yn_statement = declareConst(`decode${g_msg.name}`, yn_init, true);

		return print(yn_statement, [
			`Decodes a protobuf ${g_msg.name!.replace(/^Msg|Response$/g, '')} response message`,
			'@param atu8_payload - raw bytes to decode',
			...g_param_destructure
				? ['@param RESERVED - a second argument is explicitly forbidden. make sure not to pass this function by reference to some callback argument']
				: [],
			...1 === a_types.length
				? [`@returns ${a_types[0].field.name} - ${a_types[0].field.comments}`]
				: [
					'@returns a tuple where:',
					...a_types.map((g_type, i_type) => `  - ${i_type}: ${g_type.field.name} - ${g_type.field.comments}`),
				],
		]);
	}
}
