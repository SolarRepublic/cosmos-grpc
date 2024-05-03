#!/usr/bin/env bun
import {inspect} from 'node:util';
import {readFileSync} from 'fs';

import type {Dict} from '@blake.regalia/belt';
import {entries, from_entries, is_array, is_string, keys} from '@blake.regalia/belt';
import * as diff from 'diff';
import * as proto from 'proto-parser';

type ParseResult = proto.ProtoDocument | proto.ProtoError;

const RT_EOF = /^illegal token 'null'/;

const remove_patterns = (s: string, r: RegExp) => s.split(/\n/g).filter(s => s.trim().replace(r, '')).join('\n');

const remove_comments = (s: string) => remove_patterns(s, /^\/\/.*/);

const remove_concatable = (s: string) => remove_patterns(s, /^((\/\/|(import|option)\s+).*)|\}$/);

const is_all_comments = (s: string) => !remove_comments(s).length;

const is_concatable = (s: string) => !remove_concatable(s).length;


function parse_proto(z_content: string | string[], s_append='', b_strict=false) {
	let sx_content = z_content as string;

	if(is_array(z_content)) {
		const a_content = z_content.slice();
		a_content[1] += s_append;
		sx_content = a_content.join('\n');
	}

	if(!b_strict) {
		sx_content = sx_content.replace(/[\[\{]\s*$/, '');
	}

	const y_try = proto.parse([
		`syntax = "proto3";`,
		sx_content.replace(/^\s*syntax\s*=\s*['"]proto3['"];?/, ''),
	].join('\n'));

	if((y_try as proto.ProtoError).error) {
		if('ProtoError' === y_try.syntaxType) {
			const s_msg = y_try.message;

			// missing terminal semi-colon
			if(!b_strict && `illegal token '}', ';' expected` === s_msg) {
				if(!s_append) {
					return parse_proto(z_content, ';');
				}
			}
			// missing closing brace
			// else if(`illegal token 'null', '=' expected` === s_msg) {
			else if(!b_strict && RT_EOF.test(s_msg)) {
				if(!s_append || ';' === s_append) {
					return parse_proto(z_content, s_append+'}');
				}
			}
			// other
			else {
				// field type not found
				const m_type = /invalid type '([^']+)'/.exec(s_msg);
				if(m_type) {
					const s_prepend = `message ${m_type[1]} { uint32 FAKE_MESSAGE = 1; };\n`;

					return parse_proto(is_array(z_content)
						? [
							s_prepend+z_content[0],
							z_content[1],
							z_content[2],
						]
						: s_prepend+z_content
					);
				}
			}
		}
	}

	return y_try;
}

function success(y_result: ParseResult): y_result is proto.ProtoDocument {
	return 'ProtoDocument' === y_result.syntaxType;
}

const stringify_keys = (h_fields: Dict<any>) => JSON.stringify(keys(h_fields).sort());

const stringify_fields = (h_fields: Dict<any>) => JSON.stringify(from_entries(entries(h_fields).sort(([si_a], [si_b]) => si_a.localeCompare(si_b))));

const stringify_method = (h_methods: Dict<proto.MethodDefinition>) => JSON.stringify(from_entries(
	entries(h_methods).sort(([si_a], [si_b]) => si_a.localeCompare(si_b)).map(([si_key, g_method]) => [si_key, {
		requestType: g_method.requestType,
		responseType: g_method.responseType,
		options: JSON.stringify(g_method.options),
	}])
));

const normalize_lines = s => s.split(/\n/g).filter(s => s.trim()).map(s => s.replace(/  +/g, ' '));

function merge_lines(sx_a: string, sx_b: string) {
	const as_lines_a = new Set(normalize_lines(sx_a));
	for(const s_line of normalize_lines(sx_b)) {
		as_lines_a.add(s_line);
	}

	return [...as_lines_a].join('\n');
}

let b_expect_discrepancy_take_b = false;

function merge(sx_a_src: string, sx_b_src: string, g_diff: diff.Change) {
	if(is_concatable(sx_a_src)) {
		return sx_a_src+'\n'+sx_b_src;
	}
	else if(is_concatable(sx_b_src)) {
		return sx_b_src+'\n'+sx_a_src;
	}

	// remove comments
	const sx_a = remove_comments(sx_a_src).trim().replace(/[ \t]{2,}/g, ' ');
	const sx_b = remove_comments(sx_b_src).trim().replace(/[ \t]{2,}/g, ' ');

	// identical
	if(sx_a === sx_b) {
		return sx_a_src.length > sx_b_src.length? sx_a_src: sx_b_src;
	}

	// prep debug hint
	const s_summary = `\n${sx_a}\n${'#'.repeat(30)}\n${sx_b}`;

	let y_doc_a: ParseResult;
	let y_doc_b: ParseResult;

	// attempt to parse both as-is (top-level things)
	y_doc_a = parse_proto(sx_a);
	y_doc_b = parse_proto(sx_b);

	// `a` did not succeed
	if(!success(y_doc_a)) {
		// `b` did succeed; merging would create syntax error; merge conflict
		if(success(y_doc_b)) {
			debugger;
			y_doc_b = parse_proto(sx_b);
			throw new Error(`Merge conflict; [0, 1]:${s_summary}`);
		}

		// retry within message
		y_doc_a = parse_proto(['message Test {', sx_a, '}']);
		y_doc_b = parse_proto(['message Test {', sx_b, '}']);

		// `a` succeeded
		if(success(y_doc_a)) {
			// `b` did not succeed
			if(!success(y_doc_b)) {
				debugger;
				throw new Error(`Merge conflict; [0.1, 0.0]:${s_summary}`);
			}

			// get fields dict
			const h_fields_a = (y_doc_a.root!.nested!['Test'] as proto.MessageDefinition).fields;
			const h_fields_b = (y_doc_b.root!.nested!['Test'] as proto.MessageDefinition).fields;

			// stringify
			const s_json_a = stringify_fields(h_fields_a);
			const s_json_b = stringify_fields(h_fields_b);

			// same fields
			if(stringify_keys(h_fields_a) === stringify_keys(h_fields_b)) {
				// choose longer one, giving tie to origin
				return s_json_b.length > s_json_a.length? sx_b: sx_a;
			}

			// create set
			const as_fields_a = new Set(Object.keys(h_fields_a));
			const as_fields_b = new Set(Object.keys(h_fields_b));

			// check if `b` is entirely within in `a`
			A_CONTAINS_B:
			{
				for(const si_field_b of Object.keys(h_fields_b)) {
					if(!as_fields_a.has(si_field_b)) break A_CONTAINS_B;
				}

				return sx_a;
			}

			// check if `a` is in `b`
			B_CONTAINS_A:
			{
				for(const si_field_a of Object.keys(h_fields_a)) {
					if(!as_fields_b.has(si_field_a)) break B_CONTAINS_A;
				}

				return sx_b;
			}

			// additive merge
			return merge_lines(sx_a, sx_b);
		}
		// `b` succeeded
		else if(success(y_doc_b)) {
			throw new Error(`Merge conflict; [0.0, 0.1]:${s_summary}`);
		}
		// neither could be parsed
		else {
			// retry within enum
			y_doc_a = parse_proto(['enum Test {', sx_a, '}']);
			y_doc_b = parse_proto(['enum Test {', sx_b, '}']);

			// `a` succeeded
			if(success(y_doc_a)) {
				// `b` did not succeed
				if(!success(y_doc_b)) {
					throw new Error(`Merge conflict; [0.0.1, 0.0.0]:${s_summary}`);
				}

				// get values dict
				const h_values_a = (y_doc_a.root!.nested!['Test'] as proto.EnumDefinition).values;
				const h_values_b = (y_doc_b.root!.nested!['Test'] as proto.EnumDefinition).values;

				// stringify
				const s_json_a = stringify_fields(h_values_a);
				const s_json_b = stringify_fields(h_values_b);

				// same fields
				if(stringify_keys(h_values_a) === stringify_keys(h_values_b)) {
					// choose longer one, giving tie to origin
					return s_json_b.length > s_json_a.length? sx_b: sx_a;
				}

				// create set
				const as_values_a = new Set(Object.keys(h_values_a));
				const as_values_b = new Set(Object.keys(h_values_b));

				// check if `b` is entirely within in `a`
				A_CONTAINS_B:
				{
					for(const si_value_b of Object.keys(h_values_b)) {
						if(!as_values_a.has(si_value_b)) break A_CONTAINS_B;
					}

					return sx_a;
				}

				// check if `a` is in `b`
				B_CONTAINS_A:
				{
					for(const si_value_a of Object.keys(h_values_a)) {
						if(!as_values_b.has(si_value_a)) break B_CONTAINS_A;
					}

					return sx_b;
				}

				// different fields
				debugger;
				throw new Error(`Merge resolution path for enum values not yet defined`);
			}
			// `b` succeeded
			else if(success(y_doc_b)) {
				throw new Error(`Merge conflict; [0.0.0, 0.0.1]:${s_summary}`);
			}
			// neither cold be parsed
			else {
				// retry within service
				y_doc_a = parse_proto(['service Test {', sx_a, '}']);
				y_doc_b = parse_proto(['service Test {', sx_b, '}']);

				// `a` succeeded
				if(success(y_doc_a)) {
					// `b` did not succeed
					if(!success(y_doc_b)) {
						throw new Error(`Merge conflict; [0.0.0.1, 0.0.0.0]:${s_summary}`);
					}

					// get methods dict
					const h_methods_a = (y_doc_a.root.nested!['Test'] as proto.ServiceDefinition).methods;
					const h_methods_b = (y_doc_b.root.nested!['Test'] as proto.ServiceDefinition).methods;

					// stringify
					const s_json_a = stringify_method(h_methods_a);
					const s_json_b = stringify_method(h_methods_b);
					
					// same fields
					if(stringify_keys(s_json_a) === stringify_keys(s_json_b)) {
						// choose longer one, giving tie to origin
						return s_json_b.length > s_json_a.length? sx_b: sx_a;
					}

					// create set
					const as_fields_a = new Set(Object.keys(h_methods_a));
					const as_fields_b = new Set(Object.keys(h_methods_b));
							
					// check if `b` is entirely within in `a`
					A_CONTAINS_B:
					{
						for(const si_field_b of Object.keys(h_methods_b)) {
							if(!as_fields_a.has(si_field_b)) break A_CONTAINS_B;
						}

						return sx_a;
					}

					// check if `a` is in `b`
					B_CONTAINS_A:
					{
						for(const si_field_a of Object.keys(h_methods_a)) {
							if(!as_fields_b.has(si_field_a)) break B_CONTAINS_A;
						}

						return sx_b;
					}

					// different methods

					const y_doc_a_test = proto.parse(`service Test {\n${sx_a}\n}`);
					if('ProtoError' === y_doc_a_test.syntaxType && RT_EOF.test(y_doc_a_test.message)) {
						// // find the next closing paren in `a`
						const i_start_a = sx_file_a.indexOf(sx_a)+sx_a.length;
						const i_end_a = sx_file_a.indexOf('}', i_start_a)+1;

						const sx_tmp = sx_a + sx_file_a.slice(i_start_a, i_end_a)+'\n' + sx_b;

						b_expect_discrepancy_take_b = true;

						return sx_tmp;
					}

					debugger;
					throw new Error(`Merge resolution path for methods not yet defined`);
				}
				// `b` succeeded
				else if(success(y_doc_b)) {
					throw new Error(`Merge conflict; [0.0.0.0, 0.0.0.1]:${s_summary}`);
				}
				// neither could be parsed
				else {
					// expected this
					if(b_expect_discrepancy_take_b) {
						// unset flag
						b_expect_discrepancy_take_b = false;

						// take `b`
						return sx_b;
					}

					debugger;
	
					const y_doc_test = proto.parse([
						`syntax = "proto3";`,
						(remove_comments(sx_a)+'\n}').replace(/^\s*syntax\s*=\s*"proto3";?/, ''),
					].join('\n'))
	
					console.warn(inspect(y_doc_test));
	
					y_doc_a = parse_proto(remove_comments(sx_a)+'\n}');
					y_doc_b = parse_proto(remove_comments(sx_b)+'\n}');
					throw new Error(`Unable to parse diff:\n${remove_comments(s_summary)}\n${inspect(y_doc_a)}\n${inspect(y_doc_b)}`);
				}
			}
		}
	}
	// `a` succeeded; `b` did not
	else if(!success(y_doc_b)) {
		throw new Error(`Merge conflict; [1, 0]:${s_summary}`);
	}
	// both are top-level
	else {
		// both are all comments
		if(is_all_comments(sx_a)) {
			if(is_all_comments(sx_b)) {
				return sx_a+'\n'+sx_b;
			}
		}

		// check plain validity without fixing
		const b_valid_a = 'ProtoError' !== parse_proto(sx_a).syntaxType;
		const b_valid_b = 'ProtoError' !== parse_proto(sx_b).syntaxType;

		// both are valid on their own, accept both
		if(b_valid_a) {
			if(b_valid_b) {
				return sx_a+'\n'+sx_b;
			}
		}

		console.warn(s_summary);

		debugger;
		throw new Error(`Merge resolution path not yet defined`);
	}
}


const [sr_file_a, sr_file_b] = process.argv.slice(2);

if(!sr_file_a || !sr_file_b) {
	console.error(`Usage ./merge.ts <UPSTREAM_FILE> <CHAIN_FILE>`);
	process.exit(1);
}

const sx_file_a = readFileSync(sr_file_a, 'utf-8');
const sx_file_b = readFileSync(sr_file_b, 'utf-8');

const a_diff = diff.diffLines(sx_file_a, sx_file_b);

const a_out: string[] = [];
let sx_tmp = '';


// each diff
// eslint-disable-next-line @typescript-eslint/prefer-for-of
for(let i_diff=0; i_diff<a_diff.length; i_diff++) {
	const g_diff = a_diff[i_diff];

	// ref diff content
	const sx_content = g_diff.value;

	// something was added
	if(g_diff.added) {
		// it might be replacing something
		if(sx_tmp) {
			// handle conflict
			const sx_resolved = merge(sx_tmp, sx_content, g_diff);

			// add to output
			a_out.push(sx_resolved);

			// clear
			sx_tmp = '';
		}
		// otherwise approve
		else {
			a_out.push(sx_content);
		}
	}
	// removed or intersection
	else {
		// previous chunk in tmp was not changed
		if(sx_tmp) {
			// add it to output
			a_out.push(sx_tmp);

			// reset
			sx_tmp = '';
		}

		// something was removed
		if(g_diff.removed) {
			// hold
			sx_tmp = sx_content;
		}
		// intersection
		else {
			a_out.push(sx_content);
		}
	}
}

// output merged file contents
const sx_out = a_out.join('\n');

// // ensure output document can be parsed
// const y_doc_out = parse_proto(sx_out);
// if((y_doc_out as proto.ProtoError).error) {
// 	throw Error(`Output document not valid: ${inspect(y_doc_out)}\n\n${sx_out}`);
// }

console.log(sx_out);
