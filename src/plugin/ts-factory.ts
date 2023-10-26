/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import type {Arrayable, Dict} from '@blake.regalia/belt';

import type {
	TypeNode,
	Identifier,
	KeywordTypeSyntaxKind,
	Expression,
	Statement,
	BindingName,
	ConciseBody,
	ParameterDeclaration,
	Node,
	ArrayBindingElement,
	MemberName,
	ImportSpecifier,
} from 'typescript';

import {__UNDEFINED, fodemtv, oderac} from '@blake.regalia/belt';
import {ts, NodeFlags} from 'ts-morph';

// alias ts.factory
export const y_factory = ts.factory;

const {
	SyntaxKind,
	NewLineKind,
	ScriptTarget,
	ScriptKind,
} = ts;

const H_TYPE_KEYWORDS = {
	any: SyntaxKind.AnyKeyword,
	boolean: SyntaxKind.BooleanKeyword,
	number: SyntaxKind.NumberKeyword,
	bigint: SyntaxKind.BigIntKeyword,
	string: SyntaxKind.StringKeyword,
	unknown: SyntaxKind.UnknownKeyword,
	never: SyntaxKind.NeverKeyword,
	undefined: SyntaxKind.UndefinedKeyword,
	void: SyntaxKind.VoidKeyword,
};


// shortcuts
export const ident = (z_indent: string | Identifier) => 'string' === typeof z_indent? y_factory.createIdentifier(z_indent.replace(/[^a-zA-Z0-9$_]/g, '')): z_indent;
export const keyword = (si_type: keyof typeof H_TYPE_KEYWORDS) => y_factory.createKeywordTypeNode(H_TYPE_KEYWORDS[si_type] as KeywordTypeSyntaxKind);
export const unknown = () => keyword('unknown');
export const typeRef = (si_ref: string, a_type_args?: TypeNode[]) => y_factory.createTypeReferenceNode(si_ref, a_type_args);
// export const token = <
// 	w_kind extends Token<SyntaxKind>,
// >(xc_kind: Parameters<NodeFactory['createToken']>[0]): w_kind => y_factory.createToken(xc_kind) as w_kind;

export const trailingLineComment = <
	yn_node extends Node,
>(yn_node: yn_node, s_comment: string | undefined): yn_node => {
	if(s_comment) {
		ts.addSyntheticTrailingComment(yn_node, SyntaxKind.SingleLineCommentTrivia, ' '+s_comment, true);
	}

	return yn_node;
};

export const call = (z_method: string | Expression, a_args?: Expression[], a_types?: TypeNode[] | undefined, s_comment?: string) => trailingLineComment(
	y_factory.createCallExpression(
		'string' === typeof z_method? ident(z_method): z_method,
		a_types,
		a_args
	), s_comment
);

export const castAs = (yn_subject: Expression, yn_type: TypeNode) => y_factory.createAsExpression(yn_subject, yn_type);

export const ternary = (yn_if: Expression, yn_then: Expression, yn_else: Expression) => y_factory.createConditionalExpression(
	yn_if,
	y_factory.createToken(SyntaxKind.QuestionToken),
	yn_then,
	y_factory.createToken(SyntaxKind.ColonToken),
	yn_else
);

export const block = (a_statements: Statement[]) => y_factory.createBlock(a_statements, true);

export const string = (s_value: string) => y_factory.createStringLiteral(s_value);

export const doReturn = (yn_expr: Expression) => y_factory.createReturnStatement(yn_expr);

export const litType = (yn_lit: Parameters<ts.NodeFactory['createLiteralTypeNode']>[0]) => y_factory.createLiteralTypeNode(yn_lit);

export const typeLit = (h_props: Dict<TypeNode>) => y_factory.createTypeLiteralNode(
	oderac(h_props, (si_key, yn_type) => y_factory.createPropertySignature(
		__UNDEFINED,
		ident(si_key),
		__UNDEFINED,
		yn_type
	)));

export const declareAlias = (si_name: string, yn_assign: TypeNode, b_export?: boolean) => y_factory.createTypeAliasDeclaration(
	b_export? [y_factory.createToken(SyntaxKind.ExportKeyword)]: __UNDEFINED,
	ident(si_name),
	__UNDEFINED,
	yn_assign
);

export const declareConst = (z_binding: string | BindingName, yn_initializer: Expression, b_export?: boolean) => y_factory.createVariableStatement(
	b_export? [y_factory.createToken(SyntaxKind.ExportKeyword)]: __UNDEFINED,
	y_factory.createVariableDeclarationList([
		y_factory.createVariableDeclaration(
			'string' === typeof z_binding? ident(z_binding): z_binding,
			__UNDEFINED,
			__UNDEFINED,
			yn_initializer
		),
	], NodeFlags.Const)
);

export const tuple = (a_members: Array<TypeNode | [z_ident: string | Identifier, b_opt: boolean, yn_type: TypeNode]>) => y_factory
	.createTupleTypeNode(
		a_members.map(z_member => Array.isArray(z_member)
			? y_factory
				.createNamedTupleMember(
					__UNDEFINED,
					'package' === z_member[0]? ident('package_'): ident(z_member[0]),
					z_member[1]? y_factory.createToken(SyntaxKind.QuestionToken): __UNDEFINED,
					z_member[2]
				)
			: z_member
		)
	);

export const union = (a_types: TypeNode[]) => y_factory.createUnionTypeNode(a_types);

export const intersection = (a_types: TypeNode[]) => y_factory.createIntersectionTypeNode(a_types);

export const param = (z_binding: string | BindingName, yn_type?: TypeNode, b_optional=false, yn_init?: Expression) => y_factory.createParameterDeclaration(
	__UNDEFINED,
	__UNDEFINED,
	'string' === typeof z_binding? ident(z_binding): z_binding,
	b_optional? y_factory.createToken(SyntaxKind.QuestionToken): __UNDEFINED,
	yn_type,
	yn_init
);

export const arrow = (a_params: ParameterDeclaration[], yn_body: ConciseBody, yn_type?: TypeNode) => y_factory.createArrowFunction(
	__UNDEFINED,
	__UNDEFINED,
	a_params,
	yn_type,
	y_factory.createToken(SyntaxKind.EqualsGreaterThanToken),
	yn_body
);

export const objectLit = (h_props: Dict<Expression>) => y_factory.createObjectLiteralExpression(
	oderac(h_props, (si_key, yn_expr) => y_factory.createPropertyAssignment(ident(si_key), yn_expr)), true);

export const numericLit = (xn_value: number) => y_factory.createNumericLiteral(xn_value);

export const arrayLit = (a_elements: Expression[]) => y_factory.createArrayLiteralExpression(a_elements, false);

export const literal = (z_value: Arrayable<boolean | number | bigint | string | undefined>): Expression => {
	switch(typeof z_value) {
		case 'boolean': return y_factory.createToken(z_value? SyntaxKind.TrueKeyword: SyntaxKind.FalseKeyword) as Expression;
		case 'number': return numericLit(z_value);
		case 'bigint': return y_factory.createBigIntLiteral(z_value+'');
		case 'string': return string(z_value);
		case 'undefined': return y_factory.createVoidExpression(numericLit(0));
		default: {
			if(null === z_value) {
				return y_factory.createToken(SyntaxKind.NullKeyword);
			}
			else if(Array.isArray(z_value)) {
				return arrayLit(z_value.map(literal));
			}
			else {
				return objectLit(fodemtv(z_value, literal));
			}
		}
	}
};

export const access = (
	z_prime: string | Expression,
	...a_rest: Array<string | MemberName>
) => a_rest.reduce(
	(yn_prev, z_part) => y_factory.createPropertyAccessExpression(yn_prev, 'string' === typeof z_part? ident(z_part): z_part),
	'string' === typeof z_prime? ident(z_prime) as Expression: z_prime);

export const arrayAccess = (
	z_prime: string | Expression,
	...a_rest: Array<number | Expression>
) => a_rest.reduce(
	(yn_prev, z_part) => y_factory.createElementAccessExpression(yn_prev as Expression, z_part),
	'string' === typeof z_prime? ident(z_prime) as Expression: z_prime) as Expression;

export const binding = (yn_inner: BindingName) => y_factory.createBindingElement(
	__UNDEFINED,
	__UNDEFINED,
	yn_inner,
	__UNDEFINED
);

export const arrayBinding = (a_bidings: ArrayBindingElement[]) => y_factory.createArrayBindingPattern(a_bidings);

export const importModule = (sx_specifier: string, a_imports: Array<string | ImportSpecifier>, b_type_only=false) => y_factory.createImportDeclaration(
	__UNDEFINED,
	y_factory.createImportClause(
		b_type_only,
		__UNDEFINED,
		y_factory.createNamedImports(a_imports.map(z_import => 'string' === typeof z_import
			? y_factory.createImportSpecifier(
				false,  // never directly, handled in import clause
				__UNDEFINED,
				ident(z_import)
			)
			: z_import))
	),
	string(sx_specifier),
	__UNDEFINED
);

export const arrayType = (yn_type: TypeNode) => y_factory.createArrayTypeNode(yn_type);

export const parens = (yn_expr: Expression) => y_factory.createParenthesizedExpression(yn_expr);

export const funcType = (a_params: ParameterDeclaration[], yn_return: TypeNode) => y_factory.createFunctionTypeNode(__UNDEFINED, a_params, yn_return);

export const print = (yn_stmt: Statement, a_comment_lines?: string[]): string => {
	if(a_comment_lines) {
		yn_stmt = ts.addSyntheticLeadingComment(
			yn_stmt,
			SyntaxKind.MultiLineCommentTrivia,
			`*${a_comment_lines.map(s => '\n * '+s).join('')}\n `,
			true
		);
	}

	const y_printer = ts.createPrinter({
		newLine: NewLineKind.LineFeed,
	});

	const y_source_anon = ts.createSourceFile('_.ts', '', ScriptTarget.Latest, false, ScriptKind.TS);

	const sx_print = y_printer.printNode(ts.EmitHint.Unspecified, yn_stmt, y_source_anon)
		.replace(/\n(  {2,})/g, (s_line, s_spaces) => '\n'+'\t'.repeat((s_spaces.length / 4) | 0))
		.replace(/(const \w+ = \(.*)/g, s_line => s_line
			.replace(/(\()?(\w+\??: [^,"`)]+(?:["`][^"`]*["`][^,)]*)?)(?:(, )|\))/g, (s_match, s_lparen, s_main, s_comma) => ''
				+`${s_lparen? s_lparen+'\n\t': ''}${s_main}${s_comma? ',\n\t': '\n)'}`))
		.replace(/\[\s+\]/g, '[]');

	return sx_print;
};

export const enumDecl = (si_enum: string, h_values: Dict<Expression | undefined>, b_const: boolean, b_export: boolean) => y_factory.createEnumDeclaration(
	[
		...b_export? [y_factory.createToken(SyntaxKind.ExportKeyword)]: [],
		...b_const? [y_factory.createToken(SyntaxKind.ConstKeyword)]: [],
	],
	ident(si_enum),
	oderac(h_values, (si_key, w_value) => y_factory.createEnumMember(ident(si_key), w_value))
);
