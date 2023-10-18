// import type {O} from 'ts-toolbelt';

// import type {MethodOptionsWithHttp} from './env';
// import type {Dict} from '@blake.regalia/belt';
// import type {DescriptorProto, DescriptorProto, FieldDescriptorProto, FileDescriptorProto, MethodDescriptorProto} from 'google-protobuf/google/protobuf/descriptor_pb';
// import type {SourceFile as MorphSourceFile, TypeNode as MorphTypeNode, TypeReferenceNode} from 'ts-morph';
// import type {KeywordTypeNode, TypeNode, Identifier, TypeAliasDeclaration, KeywordTypeSyntaxKind, Expression, CallExpression, SourceFile, Statement} from 'typescript';

// import {__UNDEFINED, oderom, proper, snake, fold, oderac, F_IDENTITY} from '@blake.regalia/belt';
// import {default as protobuf} from 'google-protobuf/google/protobuf/descriptor_pb';
// import {ts, VariableDeclarationKind, SyntaxKind, Project, Writers, NodeFlags} from 'ts-morph';


// // alias ts.factory
// const y_factory = ts.factory;

// const H_TYPE_KEYWORDS = {
// 	boolean: SyntaxKind.BooleanKeyword,
// 	number: SyntaxKind.NumberKeyword,
// 	bigint: SyntaxKind.BigIntKeyword,
// 	string: SyntaxKind.StringKeyword,
// 	unknown: SyntaxKind.UnknownKeyword,
// };

// // shortcuts
// const ident = (si_indent: string) => y_factory.createIdentifier(si_indent);
// const type = (si_type: keyof typeof H_TYPE_KEYWORDS) => y_factory.createKeywordTypeNode(H_TYPE_KEYWORDS[si_type] as KeywordTypeSyntaxKind);
// const unknown = () => type('unknown');

// // destructure members from protobuf
// const {
// 	FieldDescriptorProto: {
// 		Type: H_FIELD_TYPES,
// 	},
// } = protobuf;

// type TsThingBare = {
// 	name: string;
// 	type: TypeNode;
// 	to_wire?: Expression;
// 	from_wire?: (yn_expr: Expression) => Expression;
// };

// type TsThing = O.Compulsory<TsThingBare> & {
// 	field: FieldDescriptorProto.AsObject;
// 	id: Identifier;
// 	optional: boolean;
// };


// const H_PROTO_TS_TYPES: Dict<TypeAliasDeclaration | KeywordTypeNode> = {};

// function type_to_struct(si_type: string) {
// 	const y_msg = h_global_msgs[si_type || ''];
// 	const g_msg = y_msg.toObject();

// 	if(/PageRequest/i.test(g_msg.name!) || /PageRequest/i.test(si_type)) {
// 		debugger;
// 	}

// 	if(!g_msg) {
// 		// return y_factory.createObjectLiteralExpression([], false);
// 		return unknown();
// 	}

// 	if('ContractInfo' === g_msg.name) {
// 		debugger;
// 	}

// 	return y_factory.createTypeAliasDeclaration(
// 		[
// 			y_factory.createToken(SyntaxKind.ExportKeyword),
// 		],
// 		ident(si_type),
// 		__UNDEFINED,
// 		y_factory.createTypeLiteralNode(g_msg.fieldList.map(g_field => y_factory.createPropertySignature(
// 			__UNDEFINED,
// 			// use same key for struct
// 			ident(g_field.name!),
// 			__UNDEFINED,
// 			tsify(g_field).type
// 		)))
// 	);
// }

// const A_SEMANTIC_ACCOUNT = [
// 	'creator',
// ];

// // field transformers
// const H_FIELD_TO_SNAKE_TYPES = {
// 	// boolean
// 	[H_FIELD_TYPES.TYPE_BOOL](g_field) {
// 		// ref name
// 		let si_name = g_field.name!;

// 		// create default type
// 		const yn_type: TypeNode = type('boolean');

// 		// generic boolean
// 		si_name = `b_${si_name}`;

// 		// construct ts field
// 		return {
// 			name: si_name,
// 			type: yn_type,
// 		};
// 	},

// 	// uint32
// 	[H_FIELD_TYPES.TYPE_UINT32](g_field) {
// 		// ref name
// 		let si_name = g_field.name!;

// 		// create default type
// 		const yn_type: TypeNode = type('number');

// 		// generic boolean
// 		si_name = `n_${si_name}`;

// 		// construct ts field
// 		return {
// 			name: si_name,
// 			type: yn_type,
// 		};
// 	},

// 	// int32
// 	[H_FIELD_TYPES.TYPE_INT32](g_field) {
// 		// ref name
// 		let si_name = g_field.name!;

// 		// create default type
// 		const yn_type: TypeNode = type('number');

// 		// generic boolean
// 		si_name = `n_${si_name}`;

// 		// construct ts field
// 		return {
// 			name: si_name,
// 			type: yn_type,
// 		};
// 	},

// 	// uint64
// 	[H_FIELD_TYPES.TYPE_UINT64](g_field) {
// 		// ref name
// 		let si_name = g_field.name!;

// 		// create default type
// 		const yn_type: TypeNode = y_factory.createTypeReferenceNode('WeakUint128');

// 		// generic bigint
// 		si_name = `sg_${si_name}`;

// 		// construct ts field
// 		return {
// 			name: si_name,
// 			type: yn_type,
// 		};
// 	},

// 	// int64
// 	[H_FIELD_TYPES.TYPE_INT64](g_field) {
// 		// ref name
// 		let si_name = g_field.name!;

// 		// create default type
// 		const yn_type: TypeNode = type('bigint');

// 		// generic boolean
// 		si_name = `n_${si_name}`;

// 		// construct ts field
// 		return {
// 			name: si_name,
// 			type: yn_type,
// 		};
// 	},

// 	// // uint128
// 	// [H_FIELD_TYPES.TYPE](g_field) {
// 	// 	// ref name
// 	// 	let si_name = g_field.name!;
// 	// 	if(!si_name) throw new Error(`Field is missing name ${JSON.stringify(g_field)}`);

// 	// 	// create default type
// 	// 	let yn_type: TypeNode = type('bigint');

// 	// 	// generic boolean
// 	// 	si_name = `n_${si_name}`;

// 	// 	// construct ts field
// 	// 	return {
// 	// 		name: si_name,
// 	// 		type: yn_type,
// 	// 	};
// 	// },

// 	// string
// 	[H_FIELD_TYPES.TYPE_STRING](g_field) {
// 		// ref name
// 		const si_field = g_field.name!;

// 		// create default name
// 		let si_name = `s_${si_field}`;

// 		// create default type
// 		let yn_type: TypeNode = type('string');

// 		// route snake type
// 		if(si_field.endsWith('_address') || A_SEMANTIC_ACCOUNT.includes(si_field)) {
// 			si_name = `sa_${si_field.replace(/_address$/, '')}`;
// 			yn_type = y_factory.createTypeReferenceNode('WeakSecretAddr');
// 		}
// 		else if(si_field.endsWith('_id')) {
// 			si_name = `si_${si_field.replace(/_id$/, '')}`;
// 		}
// 		else if('code_hash' === si_field) {
// 			si_name = `sb16_${si_field}`;
// 			yn_type = y_factory.createTypeReferenceNode('HexLower');
// 		}

// 		// construct ts field
// 		return {
// 			name: si_name,
// 			type: yn_type,
// 		};
// 	},

// 	[H_FIELD_TYPES.TYPE_ENUM](g_field) {
// 		debugger;

// 		return {
// 			name: `xc_${g_field.name}`,
// 			type: unknown(),
// 		};
// 	},

// 	// struct
// 	[H_FIELD_TYPES.TYPE_MESSAGE](g_field) {
// 		// default to `unknown`
// 		let yn_type: TypeNode = unknown();

// 		// not anonymous
// 		if(g_field.name) {
// 			// locate source
// 			const sr_path = h_global_msgs[g_field.typeName!].source.getName();

// 			// add import
// 			debugger;
// 			// add to types file
// 			const yn_struct = type_to_struct(g_field.typeName!);

// 			const sx_type = g_field.typeName!.split('.').at(-1)!;

// 			H_PROTO_TS_TYPES[sx_type] = yn_struct;

// 			yn_type = y_factory.createTypeReferenceNode(sx_type);
// 		}

// 		// construct ts field
// 		return {
// 			name: `g_${snake(g_field.name || 'other')}`,
// 			type: yn_type,
// 		};
// 	},

// 	// bytes
// 	[H_FIELD_TYPES.TYPE_BYTES](g_field) {
// 		// default to `unknown`
// 		const yn_type: TypeNode = y_factory.createTypeReferenceNode('Uint8Array');

// 		const si_self = `atu8_${snake(g_field.name || 'other')}`;

// 		// construct ts field
// 		return {
// 			name: si_self,
// 			type: yn_type,

// 			to_wire: y_factory.createConditionalExpression(
// 				ident(si_self),
// 				y_factory.createToken(SyntaxKind.QuestionToken),
// 				y_factory.createCallExpression(
// 					ident('buffer_to_base64'),
// 					__UNDEFINED,
// 					[ident(si_self)]
// 				),
// 				y_factory.createToken(SyntaxKind.ColonToken),
// 				ident('__UNDEFINED')
// 			) as Expression,

// 			from_wire: yn_data => y_factory.createCallExpression(
// 				ident('base64_to_buffer'),
// 				__UNDEFINED,
// 				[
// 					y_factory.createAsExpression(
// 						yn_data,
// 						type('string')
// 					),
// 				]
// 			) as Expression,
// 		};
// 	},

// } as Record<FieldDescriptorProto.Type, (g_field: FieldDescriptorProto.AsObject) => TsThingBare>; // TODO: move to var type;

// function tsify(g_field: FieldDescriptorProto.AsObject): TsThing {
// 	const f_transformer = H_FIELD_TO_SNAKE_TYPES[g_field.type!];
// 	if(!f_transformer) {
// 		debugger;
// 		throw new Error(`No transformer for ${JSON.stringify(g_field)}`);
// 	}

// 	// no name
// 	if(!g_field.name) throw new Error(`Field is missing name ${JSON.stringify(g_field)}`);

// 	const g_bare = f_transformer(g_field);

// 	const yn_id = y_factory.createIdentifier(g_bare.name);

// 	return {
// 		...g_bare,
// 		field: g_field,
// 		id: yn_id,
// 		optional: g_field.proto3Optional || false,
// 		to_wire: g_bare.to_wire || yn_id,
// 		from_wire: g_bare.from_wire || F_IDENTITY,
// 	};
// }


// type ReturnThing = {
// 	type: TypeNode;
// 	parser: Expression;
// 	things: TsThing[];
// };

// function generate_return(g_output: DescriptorProto.AsObject, g_input: DescriptorProto.AsObject): ReturnThing {
// 	// remove redundant fields
// 	const a_fields = g_output.fieldList.filter((g_field) => {
// 		// test each field in input
// 		for(const g_test of g_input.fieldList) {
// 			// same type and identical name; remove
// 			if(g_test.type === g_field.type && g_test.name === g_field.name) {
// 				return false;
// 			}
// 		}

// 		// pass; keep
// 		return true;
// 	});

// 	const a_returns = a_fields.map((g_field) => {
// 		const g_thing = tsify(g_field);

// 		return {
// 			thing: g_thing,

// 			type: g_thing.type,

// 			parser: g_thing.from_wire(
// 				y_factory.createPropertyAccessExpression(
// 					ident('g'),
// 					ident(snake(g_field.name!))
// 				)
// 			),
// 		};
// 	});

// 	// single return type
// 	if(1 === a_returns.length) {
// 		const g_return = a_returns[0];

// 		return {
// 			type: g_return.type,
// 			parser: g_return.parser,
// 			things: [g_return.thing],
// 		};
// 	}

// 	// handle multiple returns as tuple
// 	return {
// 		type: y_factory.createTupleTypeNode(a_returns.map(g => y_factory.createNamedTupleMember(
// 			__UNDEFINED,
// 			g.thing.id,
// 			g.thing.optional? y_factory.createToken(SyntaxKind.QuestionToken): __UNDEFINED,
// 			g.type
// 		))),
// 		parser: y_factory.createArrayLiteralExpression(a_returns.map(g => g.parser)),
// 		things: a_returns.map(g => g.thing),
// 	};
// }


// // all message types
// export const h_global_msgs: Dict<DescriptorProto & {
// 	source: FileDescriptorProto;
// 	index: number;
// 	comments: string;
// }> = {};

// export const h_consts: Dict<Statement> = {};

// let si_const = '';
// let s_path_prefix = '';

// function pattern_string_to_ast_node(sx_pattern: string, g_input: DescriptorProto.AsObject) {
// 	const h_fields = fold(g_input.fieldList, g_field => ({
// 		[g_field.name!]: g_field,
// 	}));

// 	// clone fields in order to find out which params are unused
// 	const h_fields_unused = {...h_fields};

// 	// construct parts of expression
// 	const a_parts = [];

// 	// prefix
// 	if(sx_pattern.startsWith(s_path_prefix)) {
// 		a_parts.push(ident(si_const));

// 		sx_pattern = sx_pattern.slice(s_path_prefix.length);
// 	}

// 	// record index of end of previous match
// 	let i_prev = 0;

// 	// each match
// 	for(const d_match of sx_pattern.matchAll(/\{([^}]+)\}/g)) {
// 		const i_match = d_match.index!;

// 		// push constant string part
// 		if(i_prev !== i_match) {
// 			a_parts.push(y_factory.createStringLiteral(sx_pattern.slice(i_prev, i_match)));
// 		}

// 		// param id
// 		const si_param = d_match[1];

// 		// push param
// 		a_parts.push(tsify(h_fields[si_param]).to_wire);

// 		// remove from unused
// 		delete h_fields_unused[si_param];

// 		// advance pointer
// 		i_prev = i_match + d_match[0].length;
// 	}

// 	// push remainder string
// 	const s_remainder = sx_pattern.slice(i_prev);
// 	if(s_remainder) {
// 		a_parts.push(y_factory.createStringLiteral(s_remainder));
// 	}

// 	// create concat expression
// 	const yn_concat = a_parts.length
// 		? a_parts.slice(1).reduce((yn_prev, yn_part) => y_factory.createBinaryExpression(
// 			yn_prev,
// 			y_factory.createToken(SyntaxKind.PlusToken),
// 			yn_part
// 		), a_parts[0])
// 		: y_factory.createStringLiteral(sx_pattern);

// 	// members
// 	const a_members = [yn_concat];

// 	// other params remain
// 	if(Object.keys(h_fields_unused).length) {
// 		// convert each to property signature
// 		const a_properties = oderac(h_fields_unused, (si_param, g_field) => y_factory.createPropertyAssignment(
// 			ident(si_param),
// 			tsify(g_field).to_wire
// 		));

// 		a_members.push(y_factory.createObjectLiteralExpression(a_properties, true));

// 		// // single property; create simple struct
// 		// if(1 === a_properties.length) {
// 		// 	a_members.push(y_factory.createObjectLiteralExpression(a_properties, true));
// 		// }
// 		// // multiple properties, join
// 		// else {

// 		// }
// 	}

// 	return {
// 		unused: h_fields_unused,
// 		expr: y_factory.createArrayLiteralExpression(a_members, false),
// 	};
// }


// // 
// export function generate_method(
// 	y_source: MorphSourceFile,
// 	si_service: string,
// 	si_vendor: string,
// 	si_module: string,
// 	s_version: string,
// 	g_method: MethodDescriptorProto.AsObject,
// 	g_opts: O.Compulsory<MethodOptionsWithHttp>,
// 	y_input: DescriptorProto,
// 	y_output: DescriptorProto,
// 	s_comments: string
// ) {
// 	// 
// 	si_const = `SR_LCD_${si_module.toUpperCase()}`;

// 	s_path_prefix = `${'secret' === si_vendor? '': `/${si_vendor}`}/${si_module}/${s_version}/`;
// 	h_consts[si_const] = y_factory.createVariableStatement(
// 		__UNDEFINED,
// 		y_factory.createVariableDeclarationList(
// 			[y_factory.createVariableDeclaration(
// 				ident(si_const),
// 				__UNDEFINED,
// 				__UNDEFINED,
// 				y_factory.createStringLiteral(s_path_prefix)
// 			)]
// 		)
// 	);

// 	// method name
// 	const si_method = g_method.name;

// 	// destructure options
// 	const {
// 		deprecated: b_deprecated,
// 		http: {
// 			get: sx_path_http_get,
// 			post: sx_path_http_post,
// 		},
// 	} = g_opts;

// 	const g_input = y_input.toObject();
// 	const g_output = y_output.toObject();

// 	// transform input arguments
// 	const a_args = g_input.fieldList.map(tsify);

// 	// transform output type
// 	const g_return = generate_return(g_output, g_input);

// 	// parse pattern and apply input args
// 	const g_pattern = pattern_string_to_ast_node(sx_path_http_get || sx_path_http_post, g_input);

// 	const yn_call = y_factory.createCallExpression(
// 		y_factory.createIdentifier(`lcd_${si_service}`),
// 		[
// 			// 1st generics param is function arguments
// 			y_factory.createTupleTypeNode(a_args
// 				.map(g_arg => y_factory.createNamedTupleMember(
// 					__UNDEFINED,
// 					g_arg.id,
// 					g_arg.optional || g_pattern.unused[g_arg.field.name!]
// 						? y_factory.createToken(SyntaxKind.QuestionToken)
// 						: __UNDEFINED,
// 					g_arg.type
// 				))
// 			),

// 			// 2nd generics param is parsed response
// 			g_return.type,
// 		],
// 		[
// 			// request formatter
// 			y_factory.createArrowFunction(
// 				__UNDEFINED,
// 				__UNDEFINED,
// 				a_args.map(g_arg => y_factory.createParameterDeclaration(
// 					__UNDEFINED,
// 					__UNDEFINED,
// 					g_arg.id,
// 					__UNDEFINED,
// 					__UNDEFINED,
// 					__UNDEFINED
// 				)),
// 				__UNDEFINED,
// 				y_factory.createToken(SyntaxKind.EqualsGreaterThanToken),
// 				g_pattern.expr
// 			),

// 			// response parser
// 			y_factory.createArrowFunction(
// 				__UNDEFINED,
// 				__UNDEFINED,
// 				[
// 					y_factory.createParameterDeclaration(
// 						__UNDEFINED,
// 						__UNDEFINED,
// 						ident('g'),
// 						__UNDEFINED,
// 						__UNDEFINED,
// 						__UNDEFINED
// 					),
// 				],
// 				__UNDEFINED,
// 				y_factory.createToken(SyntaxKind.EqualsGreaterThanToken),
// 				g_return.parser
// 			),

// 			// request init for POST
// 			...sx_path_http_post
// 				? [
// 					y_factory.createObjectLiteralExpression([
// 						y_factory.createPropertyAssignment(
// 							ident('method'),
// 							y_factory.createStringLiteral('POST')
// 						),
// 					], true),
// 				]
// 				: [],
// 		]
// 	);

// 	const yn_statement = y_factory.createVariableStatement(
// 		[
// 			y_factory.createToken(SyntaxKind.ExportKeyword),
// 		],
// 		y_factory.createVariableDeclarationList([
// 			y_factory.createVariableDeclaration(
// 				ident(`${si_service}${proper(si_module)}${si_method}`),
// 				__UNDEFINED,
// 				__UNDEFINED,
// 				yn_call
// 			),
// 		], NodeFlags.Const)
// 	);

// 	return ts.addSyntheticLeadingComment(
// 		yn_statement,
// 		SyntaxKind.MultiLineCommentTrivia,
// 		`*${s_comments.split(/\n/g).map(s => '\n * '+s).join('')}\n `,
// 		true
// 	);
// }
