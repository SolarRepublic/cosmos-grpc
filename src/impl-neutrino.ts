import type {O} from 'ts-toolbelt';

import type {TsThing} from './common';
import type {MethodOptionsWithCosmosExtension, MethodOptionsWithHttp} from './env';
import type {MethodDescriptorProto, DescriptorProto} from 'google-protobuf/google/protobuf/descriptor_pb';
import type {SourceFile as MorphSourceFile} from 'ts-morph';

import type {Statement, TypeNode, Expression} from 'typescript';

import {__UNDEFINED, fold, oderac, proper, snake, type Dict, escape_regex} from '@blake.regalia/belt';
import {ts} from 'ts-morph';

import {field_router} from './common';
import {findCommentByPath} from './plugin';
import {RpcImplementor, type AugmentedDescriptor} from './rpc-impl';
import {access, arrow, call, declareConst, ident, numericLit, objectLit, param, print, string, tuple, y_factory} from './ts-factory';

type ReturnThing = {
	type: TypeNode;
	parser: Expression | null;
	things: TsThing[];
};

const {
	SyntaxKind,
} = ts;

export class NeutrinoImpl extends RpcImplementor {
	protected _si_const = '';
	protected _s_path_prefix = '';
	protected _h_consts: Dict<Statement> = {};

	constructor() {
		super();

		this._h_router = field_router(this);
	}

	protected override _reset(): void {
		this._h_consts = {};
	}

	lines(): string[] {
		return [
			...this.imports(),
			...oderac(this._h_consts, (si_const, yn_const) => print(yn_const)),
		];
	}

	generate_return(g_output: DescriptorProto.AsObject, g_input: DescriptorProto.AsObject): ReturnThing {
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
		g_method: MethodDescriptorProto.AsObject,
		g_opts: O.Compulsory<MethodOptionsWithHttp>,
		g_input: AugmentedDescriptor,
		g_output: AugmentedDescriptor,
		s_comments: string
	): Statement {
		const si_module_ident = si_module.replace(/\//g, '_');

		// 
		const si_const = this._si_const = `SR_LCD_${si_module_ident.toUpperCase()}`;

		const s_path_prefix = this._s_path_prefix = `${'secret' === si_vendor? '': `/${si_vendor}`}/${si_module}/${s_version}/`;
		this._h_consts[si_const] = declareConst(si_const, string(s_path_prefix));

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
		const a_docs_parmas = a_args.map((g_arg, i_arg) => {
			const i_field = a_things.indexOf(g_arg);

			const s_comment = findCommentByPath([4, g_input.index, 2, i_field], g_input.source).trim().replace(/\s*\n\s*/g, ' ')
				.replace(new RegExp(`^${escape_regex(g_arg.field.name!)}\\s+`), '');

			return `@param ${g_arg.name} - ${s_comment}`;
		});

		const yn_call = call(`lcd_${si_service}`, [
			// 1st generics param is function arguments
			tuple(a_args.map(g_arg => [
				g_arg.id,
				is_optional(g_arg),
				g_arg.type,
			])),

			// 2nd generics param is parsed response
			g_return.type,
		], [
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
		]);

		const yn_statement = declareConst(`${si_service}${proper(si_module_ident)}${si_method}`, yn_call, true);

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
				const i_field = g_output.fieldList.indexOf(g_field);
				const s_comment = findCommentByPath([4, g_output.index, 2, i_field], g_output.source).trim().replace(/\s*\n\s*/g, ' ')
					.replace(new RegExp(`^${escape_regex(g_field.name!)}\\s+`), '');

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


	encoderDecoder(
		g_msg: DescriptorProto.AsObject
	) {
		// instantiate writer
		let yn_chain = call('Protobuf', __UNDEFINED, []);

		// implements interface
		const g_opts = g_msg.options as MethodOptionsWithCosmosExtension;
		if(g_opts.implementsInterfaceList) {
			// create params from fields
			const a_params = g_msg.fieldList.map((g_field, i_field) => {
				const g_thing = this.route(g_field);

				const a_args: Expression[] = [g_thing.to_proto];

				const i_number = g_field.number;
				if('number' === typeof i_number && i_number !== i_field+1) {
					a_args.push(numericLit(i_number));
				}

				// add to chain
				yn_chain = call(access(yn_chain, g_thing.write), __UNDEFINED, a_args);

				// create parameter
				return param(g_thing.id, g_thing.type, g_thing.optional);
			});

			// construct call chain
			const yn_writer = arrow(a_params, access(yn_chain, 'o'));

			// create statement
			return declareConst(`write${g_msg.name!}`, yn_writer, true);
		}
	}
}
