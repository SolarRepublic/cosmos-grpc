#!/usr/bin/env bun

import {readFileSync} from 'fs';

import {ode, type Dict} from '@blake.regalia/belt';
import * as diff from 'diff';
import * as proto from 'proto-parser';

type ParseResult = proto.ProtoDocument | proto.ProtoError;

const [sr_file_a, sr_file_b] = process.argv.slice(2);

if(!sr_file_a || !sr_file_b) {
	console.error(`Usage ./merge.ts <UPSTREAM_FILE> <CHAIN_FILE>`);
	process.exit(1);
}

const sx_file_a = readFileSync(sr_file_a, 'utf-8');
const sx_file_b = readFileSync(sr_file_b, 'utf-8');

const a_diff = diff.diffLines(sx_file_a, sx_file_b);

function parse_proto(sx_content: string) {
	return proto.parse(`
		syntax = 'proto3';
		${sx_content};
	`);
}

function success(y_result: ParseResult): y_result is proto.ProtoDocument {
	return 'ProtoDocument' === y_result.syntaxType;
}

const stringify_keys = (h_fields: Dict<any>) => JSON.stringify(Object.keys(h_fields).sort());

const stringify_fields = (h_fields: Dict<any>) => JSON.stringify(Object.fromEntries(ode(h_fields).sort(([si_a], [si_b]) => si_a.localeCompare(si_b))));

function merge(sx_a: string, sx_b: string) {
	// prep debug hint
	const s_summary = `\n${sx_a}\n${'#'.repeat(30)}\n${sx_b}`;

	let y_doc_a: ParseResult;
	let y_doc_b: ParseResult;

	// attempt to parse both as-is (top-level things)
	y_doc_a = parse_proto(sx_a);
	y_doc_b = parse_proto(sx_a);

	// `a` did not succeed
	if(!success(y_doc_a)) {
		// `b` did succeed; merging would create syntax error; merge conflict
		if(success(y_doc_b)) {
			throw new Error(`Merge conflict; [0, 1]:${s_summary}`);
		}

		// retry within message
		y_doc_a = parse_proto(`message Test { ${sx_a} }`);
		y_doc_b = parse_proto(`message Test { ${sx_b} }`);

		// `a` succeeded
		if(success(y_doc_a)) {
			// `b` did not succeed
			if(!success(y_doc_b)) {
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

			const as_fields_a = new Set(Object.keys(h_fields_a));
			const as_fields_b = new Set(Object.keys(h_fields_b));

			// check if `b` is in `a`
			for(const si_field_b of Object.keys(h_fields_b)) {
				if(as_fields_a.has(si_field_b)) {
					throw new Error(`Merge conflict; conflicting keys "${si_field_b}":${s_summary}`);
				}
			}

			// check if `a` is in `b`
			for(const si_field_a of Object.keys(h_fields_a)) {
				if(as_fields_b.has(si_field_a)) {
					throw new Error(`Merge conflict; conflicting keys "${si_field_a}":${s_summary}`);
				}
			}

			// different fields
			debugger;
			throw new Error(`Merge resolution path not yet defined`);
		}
		// `b` succeeded
		else if(success(y_doc_b)) {
			throw new Error(`Merge conflict; [0.0, 0.1]:${s_summary}`);
		}
		// neither could be parsed
		else {
			throw new Error(`Unable to parse diff:${s_summary}`);
		}
	}
	// `a` succeeded; `b` did not
	else if(!success(y_doc_b)) {
		throw new Error(`Merge conflict; [1, 0]:${s_summary}`);
	}
	// both are top-level
	else {
		debugger;
		throw new Error(`Merge resolution path not yet defined`);
	}
}

const a_out = [];
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
			const sx_resolved = merge(sx_tmp, sx_content);

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
console.log(a_out.join('\n'));
