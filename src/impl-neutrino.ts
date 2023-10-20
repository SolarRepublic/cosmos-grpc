import type {O} from 'ts-toolbelt';

import type {TsThing} from './common';
import type {MethodOptionsWithCosmosExtension, MethodOptionsWithHttp} from './env';

import type {MethodDescriptorProto, DescriptorProto} from 'google-protobuf/google/protobuf/descriptor_pb';
import type {Statement, TypeNode, Expression, ParameterDeclaration, ArrayBindingElement, ConciseBody} from 'typescript';

import {__UNDEFINED, fold, oderac, proper, snake, type Dict, escape_regex} from '@blake.regalia/belt';
import {default as pb} from 'google-protobuf/google/protobuf/descriptor_pb';
import {ts} from 'ts-morph';

import {H_FIELD_TYPE_TO_HUMAN_READABLE, field_router} from './common';
import {RpcImplementor, type AugmentedDescriptor} from './rpc-impl';
import {access, arrayAccess, arrayBinding, arrayLit, arrow, binding, call, castAs, declareConst, funcType, ident, numericLit, param, parens, print, string, tuple, type, typeRef, union, y_factory} from './ts-factory';

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

export class NeutrinoImpl extends RpcImplementor {
	protected _si_const = '';
	protected _s_path_prefix = '';
	protected _h_consts: Dict<Statement> = {};
	protected _a_lines: string[] = [];

	constructor() {
		super();

		this._h_router = field_router(this);
	}

	protected override _reset(): void {
		this._h_consts = {};
		this._a_lines = [];
	}

	lines(): string[] {
		return [
			...this.imports(),
			...this._a_lines,
			...oderac(this._h_consts, (si_const, yn_const) => print(yn_const)),
		];
	}

	generate_return(g_output: AugmentedDescriptor, g_input: AugmentedDescriptor): ReturnThing {
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

				type: g_thing.type,

				parser: g_thing.from_wire(
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
				g.thing.id,
				g.thing.optional,
				g.type,
			])),
			parser: a_returns.length? y_factory.createArrayLiteralExpression(a_returns.map(g => g.parser)): null,
			things: a_returns.map(g => g.thing),
		};
	}


	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	pattern_string_to_ast_node(sx_pattern: string, g_input: AugmentedDescriptor) {
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
			a_parts.push(this.route(g_field).to_wire);

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
				this.route(g_field).to_wire
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



	override generate(
		si_service: string,
		si_vendor: string,
		si_module: string,
		s_version: string,
		sr_path_prefix: string,
		g_method: MethodDescriptorProto.AsObject,
		g_opts: O.Compulsory<MethodOptionsWithHttp>,
		g_input: AugmentedDescriptor,
		g_output: AugmentedDescriptor,
		s_comments: string
	): Statement {
		const si_module_ident = si_module.replace(/\//g, '_');

		// 
		const si_const = this._si_const = `SR_LCD_${si_vendor.toUpperCase()}_${si_module_ident.toUpperCase()}`;

		// const s_path_prefix = this._s_path_prefix = `${'secret' === si_vendor? '': `/${si_vendor}`}/${si_module}/${s_version}/`;
		this._s_path_prefix = sr_path_prefix;
		this._h_consts[si_const] ||= declareConst(si_const, string(sr_path_prefix));

		// method name
		const si_method = g_method.name;

		// destructure options
		const {
			deprecated: b_deprecated,
			http: {
				get: sx_path_http_get,
				post: sx_path_http_post,
			},
		} = g_opts;

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

			return `@param ${g_arg.name} - ${s_comment}`;
		});

		const yn_call = call(`lcd_${si_service}`, [
			// request formatter
			arrow(a_args.map(g_arg => param(g_arg.id)), g_pattern.expr),

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
				g_arg.id,
				is_optional(g_arg),
				g_arg.type,
			])),

			// 2nd generics param is parsed response
			g_return.type,
		]);

		const yn_statement = declareConst(`${si_service}${proper(si_vendor)}${proper(si_module_ident)}${si_method}`, yn_call, true);

		const a_comment_lines = s_comments.trim().replace(new RegExp(`^${escape_regex(g_method.name!)}\\s+`, 'i'), '').split(/\n/g);
		const [s_line_0] = a_comment_lines;
		if(s_line_0) a_comment_lines[0] = s_line_0[0].toUpperCase()+s_line_0.slice(1);
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

		return ts.addSyntheticLeadingComment(
			yn_statement,
			SyntaxKind.MultiLineCommentTrivia,
			`*${a_comment_lines.map(s => '\n * '+s).join('')}\n `,
			true
		);
	}

	encodeParams(g_msg: AugmentedDescriptor): [ParameterDeclaration[], Expression] {
		// instantiate writer
		let yn_chain = call('Protobuf', [], __UNDEFINED, '...');

		// create params from fields
		const a_params_required: ParameterDeclaration[]= [];
		const a_params_optional: ParameterDeclaration[] = [];
		g_msg.fieldList.forEach((g_field, i_field) => {
			// convert field to thing
			const g_thing = this.route(g_field);

			// prep args
			const a_args: Expression[] = [g_thing.to_proto];

			// add optional field id
			const i_number = g_field.number;
			if('number' === typeof i_number && i_number !== i_field+1) {
				a_args.push(numericLit(i_number));
			}

			// add to chain
			const s_comment_type = g_field.typeName?.split('.').at(-1)
				|| H_FIELD_TYPE_TO_HUMAN_READABLE[g_field.type!] || 'unknown';

			yn_chain = call(
				access(yn_chain, g_thing.write),
				a_args,
				__UNDEFINED,
				`${s_comment_type}${FieldDescriptorProto.Label.LABEL_REPEATED === g_field.label? '[]': ''} ${g_field.name} = ${g_field.number}`
			);

			// create parameter
			const yn_param = param(ident(g_thing.proto_name), g_thing.proto_type, g_thing.optional);

			// add to optional/required depending on which one
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
		g_msg: AugmentedDescriptor
	) {
		// implements interface
		const g_opts = g_msg.options as MethodOptionsWithCosmosExtension;
		if(g_opts.implementsInterfaceList) {
			// prep unique type
			const si_singleton = `Any${g_msg.name}`;

			// declare unique type
			const yn_type = y_factory.createTypeAliasDeclaration([
				y_factory.createToken(SyntaxKind.ExportKeyword),
			], ident(si_singleton), __UNDEFINED, this.importType('../_core', 'ImplementsInterfaces', [
				union([
					string(g_msg.name!),
					...g_opts.implementsInterfaceList.map(si_interface => string(si_interface)),
				].map(yn => y_factory.createLiteralTypeNode(yn))),
			]));

			// add to preamble
			this._a_lines.push(print(yn_type));

			// encode params and build chain
			const [a_params, yn_chain] = this.encodeParams(g_msg);

			// construct call chain
			const yn_writer = arrow(a_params, castAs(yn_chain, typeRef(si_singleton)));

			// create statement
			return declareConst(`any${g_msg.name!}`, yn_writer, true);
		}
	}

	msgEncoder(
		g_method: MethodDescriptorProto.AsObject,
		g_input: AugmentedDescriptor,
		g_output: AugmentedDescriptor,
		s_comments: string
	) {
		const g_opts = g_method.options;

			// encode params and build chain
		const [a_params, yn_chain] = this.encodeParams(g_input);

		// prep unique type
		const si_singleton = `Msg${g_method.name}`;

		// declare unique type
		const yn_type = y_factory.createTypeAliasDeclaration([
			y_factory.createToken(SyntaxKind.ExportKeyword),
		], ident(si_singleton), __UNDEFINED, typeRef(si_singleton));

		// add type decl to preamble
		this._a_lines.push(print(yn_type));

		// construct call chain
		const yn_writer = arrow(a_params, castAs(yn_chain, typeRef(si_singleton)));

		// create statement
		const yn_const = declareConst(`msg${g_method.name!}`, yn_writer, true);


		return yn_const;
	}

	// 
	msgDecoder(g_msg: AugmentedDescriptor) {
		let b_monotonic = true;

		let b_flat = true;

		const a_types: TsThing[] = [];
		const a_returns: Expression[] = [];

		// create bindings
		const a_bindings = g_msg.fieldList.map((g_field, i_field) => {
			if(g_field.number !== i_field + 1) {
				b_monotonic = false;
			}

			const g_thing = this.route(g_field);

			const yn_ident = ident(g_thing.proto_name);

			if(g_thing.nests) {
				b_flat = false;
				a_returns.push(g_thing.nests(yn_ident));
			}
			else {
				a_returns.push(yn_ident);
			}

			a_types.push(g_thing);

			// repeated type; bind items
			if(FieldDescriptorProto.Label.LABEL_REPEATED === g_field.label) {
				return binding(yn_ident);
			}
			// single item; unwrap ot
			else {
				return arrayBinding([binding(yn_ident)]);
			}
		}) as ArrayBindingElement[];


		if(!b_monotonic) {
			console.warn(`Skipping non-monotonic response type ${g_msg.name}`);
			return;
		}

		const yn_decode = call('decode_protobuf', [ident('atu8_payload')]);


		let yn_init: Expression;
		let yn_body!: ConciseBody;

		// prep function params
		const a_params = [
			param(ident('atu8_payload'), typeRef('Uint8Array')),
		];

		let g_param_destructure!: ParameterDeclaration;

		const yn_return = 1 === a_types.length
			? a_types[0].id
				? union([a_types[0].type, type('undefined')])
				: a_types[0].type
			: tuple(a_types.map(g_thing => [g_thing.name, g_thing.optional, g_thing.type]));

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
					param('reserved', type('never'), true),
				], yn_return)
			)
			: yn_destructure;

		const yn_statement = declareConst(`decode${g_msg.name}`, yn_init, true);

		const a_comment_lines = [
			g_msg.comments,
			'@param atu8_payload - raw bytes to decode',
			...1 === a_types.length
				? [`@returns ${a_types[0].field.name} - ${a_types[0].field.comments}`]
				: [
					'@returns a tuple where:',
					...a_types.map((g_type, i_type) => `  - ${i_type}: ${g_type.field.name} - ${g_type.field.comments}`),
				],
		];

		return ts.addSyntheticLeadingComment(
			yn_statement,
			SyntaxKind.MultiLineCommentTrivia,
			`*${a_comment_lines.map(s => '\n * '+s).join('')}\n `,
			true
		);
	}
}
