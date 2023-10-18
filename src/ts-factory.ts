import type {Dict} from '@blake.regalia/belt';

import type {
	TypeNode,
	Identifier,
	KeywordTypeSyntaxKind,
	Expression,
	Statement,
	BindingName,
	ConciseBody,
	ParameterDeclaration,
} from 'typescript';

import {__UNDEFINED, oderac} from '@blake.regalia/belt';
import {ts, NodeFlags} from 'ts-morph';

// alias ts.factory
export const y_factory = ts.factory;

const {
	SyntaxKind,
	NewLineKind,
	ScriptTarget,
	ScriptKind,
} = ts;

// shortcuts
export const ident = (z_indent: string | Identifier) => 'string' === typeof z_indent? y_factory.createIdentifier(z_indent): z_indent;
export const type = (si_type: keyof typeof H_TYPE_KEYWORDS) => y_factory.createKeywordTypeNode(H_TYPE_KEYWORDS[si_type] as KeywordTypeSyntaxKind);
export const unknown = () => type('unknown');
export const typeRef = (si_ref: string) => y_factory.createTypeReferenceNode(si_ref);
// export const token = <
// 	w_kind extends Token<SyntaxKind>,
// >(xc_kind: Parameters<NodeFactory['createToken']>[0]): w_kind => y_factory.createToken(xc_kind) as w_kind;

export const call = (z_method: string | Expression, a_types: TypeNode[] | undefined, a_args: Expression[]) => y_factory.createCallExpression(
	'string' === typeof z_method? ident(z_method): z_method,
	a_types,
	a_args
);

export const castAs = (yn_subject: Expression, yn_type: TypeNode) => y_factory.createAsExpression(yn_subject, yn_type);

export const ternary = (yn_if: Expression, yn_then: Expression, yn_else: Expression) => y_factory.createConditionalExpression(
	yn_if,
	y_factory.createToken(SyntaxKind.QuestionToken),
	yn_then,
	y_factory.createToken(SyntaxKind.ColonToken),
	yn_else
);

export const string = (s_value: string) => y_factory.createStringLiteral(s_value);

export const declareConst = (si_const: string, yn_initializer: Expression, b_export?: boolean) => y_factory.createVariableStatement(
	b_export? [y_factory.createToken(SyntaxKind.ExportKeyword)]: __UNDEFINED,
	y_factory.createVariableDeclarationList([
		y_factory.createVariableDeclaration(
			ident(si_const),
			__UNDEFINED,
			__UNDEFINED,
			yn_initializer
		),
	], NodeFlags.Const)
);

export const tuple = (a_members: [yn_ident: Identifier, b_opt: boolean, yn_type: TypeNode][]) => y_factory
	.createTupleTypeNode(
		a_members.map(a_member => y_factory
			.createNamedTupleMember(
				__UNDEFINED,
				a_member[0],
				a_member[1]? y_factory.createToken(SyntaxKind.QuestionToken): __UNDEFINED,
				a_member[2]
			)
		)
	);

export const param = (z_ident: string | Identifier, yn_type?: TypeNode, b_optional=false, yn_init?: Expression) => y_factory.createParameterDeclaration(
	__UNDEFINED,
	__UNDEFINED,
	ident(z_ident),
	b_optional? y_factory.createToken(SyntaxKind.QuestionToken): __UNDEFINED,
	yn_type,
	yn_init
);

export const arrow = (a_params: ParameterDeclaration[], yn_body: ConciseBody) => y_factory.createArrowFunction(
	__UNDEFINED,
	__UNDEFINED,
	a_params,
	__UNDEFINED,
	y_factory.createToken(SyntaxKind.EqualsGreaterThanToken),
	yn_body
);

export const objectLit = (h_props: Dict<Expression>) => y_factory.createObjectLiteralExpression(
	oderac(h_props, (si_key, yn_expr) => y_factory.createPropertyAssignment(ident(si_key), yn_expr)), true);

export const numericLit = (xn_value: number) => y_factory.createNumericLiteral(xn_value);

export const arrayLit = (a_elements: Expression[]) => y_factory.createArrayLiteralExpression(a_elements, false);

export const access = (
	z_prime: string | Expression,
	...a_rest: Array<string | Identifier>
) => a_rest.reduce(
	(yn_prev, z_part) => y_factory.createPropertyAccessExpression(yn_prev, ident(z_part)),
	'string' === typeof z_prime? ident(z_prime) as Expression: z_prime);

export const importModule = (sx_specifier: string, a_imports: string[], b_type_only=false) => y_factory.createImportDeclaration(
	__UNDEFINED,
	y_factory.createImportClause(
		b_type_only,
		__UNDEFINED,
		y_factory.createNamedImports(
			a_imports.map(si => y_factory.createImportSpecifier(false, __UNDEFINED, ident(si))))
	),
	string(sx_specifier),
	__UNDEFINED
);

export const arrayType = (yn_type: TypeNode) => y_factory.createArrayTypeNode(yn_type);

const H_TYPE_KEYWORDS = {
	boolean: SyntaxKind.BooleanKeyword,
	number: SyntaxKind.NumberKeyword,
	bigint: SyntaxKind.BigIntKeyword,
	string: SyntaxKind.StringKeyword,
	unknown: SyntaxKind.UnknownKeyword,
};

export const print = (yn_stmt: Statement): string => {
	const y_printer = ts.createPrinter({
		newLine: NewLineKind.LineFeed,
	});

	const y_source_anon = ts.createSourceFile('_.ts', '', ScriptTarget.Latest, false, ScriptKind.TS);

	return y_printer.printNode(ts.EmitHint.Unspecified, yn_stmt, y_source_anon);
};
