#!/usr/bin/env node --inspect-brk

import type {O} from 'ts-toolbelt';

import type {FieldDescriptorProtoWithComments, MethodOptionsWithCosmosExtension, MethodOptionsWithHttp} from './env';

import type {AugmentedDescriptor, RpcImplementor} from './rpc-impl';
import type {Dict} from '@blake.regalia/belt';

import type {DescriptorProto, FileDescriptorProto} from 'google-protobuf/google/protobuf/descriptor_pb';

import type {Statement} from 'typescript';

import {__UNDEFINED, escape_regex, ode, oderac} from '@blake.regalia/belt';

import {NeutrinoImpl} from './impl-neutrino';
import {findCommentByPath, plugin} from './plugin';
import {importModule, print} from './ts-factory';

const capture_messages = (
	k_impl: RpcImplementor,
	g_proto: FileDescriptorProto.AsObject,
	sr_package: string,
	a_path: number[]=[]
) => (g_msg: DescriptorProto.AsObject, i_msg: number) => {
	// skip anonymous
	const si_msg = g_msg.name;
	if(!si_msg) return;

	const p_msg = `${sr_package}.${si_msg}`;

	// append to path
	const a_local = [...a_path, 4, i_msg];

	// each field
	g_msg.fieldList.forEach((g_field, i_field) => {
		(g_field as FieldDescriptorProtoWithComments).comments = findCommentByPath([...a_local, 2, i_field], g_proto, g_field.name);
	});

	// save to global lookup
	k_impl.msg(p_msg, Object.assign(g_msg as AugmentedDescriptor, {
		source: g_proto,
		index: i_msg,
		comments: findCommentByPath(a_local, g_proto, g_msg.name),
	}));

	// capture nested types
	g_msg.nestedTypeList.forEach(capture_messages(k_impl, g_proto, p_msg, a_local));
};

void plugin((a_protos, h_inputs) => {
	// new impl
	const k_impl = new NeutrinoImpl();

	const h_outputs: Dict = {};

	// each included file
	for(const [, g_proto] of ode(h_inputs)) {
		// skip anonymous
		const si_package = g_proto.pb_package;
		if(!si_package) continue;

		// each message type
		g_proto.messageTypeList.forEach(capture_messages(k_impl, g_proto, '.'+si_package));

		// each enum
		g_proto.enumTypeList.forEach((g_enum, i_enum) => {
			// skip anonymous
			const si_enum = g_enum.name;
			if(!si_enum) return;

			// save to global lookup
			k_impl.enum(`.${si_package}.${si_enum}`, Object.assign(g_enum, {
				source: g_proto,
				index: i_enum,
				comments: findCommentByPath([5, i_enum], g_proto, g_enum.name),
			}));
		});
	}

	// global queue of outputs gathered from service response types
	const a_decoders: AugmentedDescriptor[] = [];

	// each proto file
	for(const g_proto of a_protos) {
		const a_methods = k_impl.file();

		// split path => [vendor, module, version, purpose]
		const a_path = g_proto.name!.split('/');

		const si_vendor = a_path[0]!;

		let si_module = a_path[1];
		let s_version = '';
		let s_purpose = '';

		// determine separation between parts
		for(let i_part=2; i_part<a_path.length-1; i_part++) {
			const s_part = a_path[i_part];

			// found version
			if(/^v\d/.test(s_part)) {
				s_version = s_part;
				s_purpose = a_path.slice(i_part+1).join('/').split('.')[0];
				break;
			}

			// part of module
			si_module += '/'+s_part;
		}

		// services
		g_proto.serviceList.forEach((g_service, i_service) => {
			// skip anonymous services
			const si_service = g_service.name?.toLowerCase();
			if(!si_service) return;

			// find longest path prefix
			let s_path_prefix = '';
			{
				// each method (pre-gen)
				for(const g_method of g_service.methodList) {
					const g_opts = g_method.options as O.Compulsory<MethodOptionsWithHttp>;
					const g_http = g_opts?.http;

					// only interested in GET or POST
					const sr_path = g_http?.get || g_http?.post;

					// no path; skip
					if(!sr_path) continue;

					// initialize
					if(!s_path_prefix) {
						s_path_prefix = sr_path;
						const i_param = sr_path.indexOf('{');
						if(i_param >= 0) s_path_prefix = sr_path.slice(0, sr_path.indexOf('{'));
					}
					// find common substring
					else {
						// each character
						for(let i_char=0; i_char<Math.min(s_path_prefix.length, sr_path.length); i_char++) {
							// end of common substring
							if(sr_path[i_char] !== s_path_prefix[i_char]) {
								s_path_prefix = sr_path.slice(0, i_char);
								break;
							}
						}
					}
				}
			}

			// each method
			g_service.methodList.forEach((g_method, i_method) => {
				// skip functions missing input or output type
				if(!g_method.inputType || !g_method.outputType) return;
				const {
					inputType: sr_input,
					outputType: sr_output,
				} = g_method;

				// locate rpc input
				const g_input = k_impl.msg(sr_input);
				if(!g_input) throw new Error(`Failed to find rpc input ${sr_input} in ${g_proto.name!}`);

				// locate rpc output
				const g_output = k_impl.msg(sr_output);
				if(!g_output) throw new Error(`Failed to find rpc output ${sr_output}`);

				// skip functions missing http options
				const g_opts = g_method.options as O.Compulsory<MethodOptionsWithHttp>;
				const g_http = g_opts?.http;

				// get comment(s)
				const s_comments = findCommentByPath([6, i_service, 2, i_method], g_proto) || '';

				// only interested in GET or POST
				if(g_http?.get || g_http?.post) {
					// generate
					const yn_method = k_impl.generate(
						si_service,
						si_vendor,
						si_module,
						s_version,
						s_path_prefix,
						g_method,
						g_opts,
						g_input,
						g_output,
						s_comments
					);

					a_methods.push(print(yn_method));
				}
				// otherwise, create encoder/decoder
				else {
					k_impl.msgEncoder(g_method, g_input, g_output, s_comments);

					// add decoder to queue
					if(g_output.fieldList.length) {
						a_decoders.push(g_output);
					}
				}
			});
		});

		// interface messages
		const a_encoders: Statement[] = [];
		g_proto.messageTypeList.forEach((g_msg, i_msg) => {
			// skip anonymous messages
			const si_msg = g_msg.name?.toLowerCase();
			if(!si_msg) return;

			const g_opts = g_msg.options as MethodOptionsWithCosmosExtension;

			// implements interface; generate 'any' encoder
			if(g_opts?.implementsInterfaceList) {
				a_encoders.push(k_impl.anyEncoder(g_msg as AugmentedDescriptor)!);
			}
		});


		if(a_methods.length + a_encoders.length) {
			// create file
			const a_parts = [
				`/*
				 * ${'='.repeat(32)}
				 *     GENERATED FILE WARNING
				 * Do not edit this file manually.
				 * ${'='.repeat(32)}
				 */`.replace(/\n\t+/g, '\n'),
				...[
					importModule('@blake.regalia/belt', [
						'F_IDENTITY',
						'__UNDEFINED',
						'base64_to_buffer',
						'buffer_to_base64',
					]),
					importModule('../protobuf-writer.js', [
						'Protobuf',
						'any',
						'coin',
						'timestamp',
					]),
					importModule('../_root', [
						'F_RPC_REQ_NO_ARGS',
						'lcd_query',
					]),
				].map(print),
				...k_impl.lines(),
				...a_methods,
				...a_encoders.map(yn => print(yn)),
			];

			const si_file = s_purpose.split('.')[0]+'/'+si_module.replace(/\//g, '_')+'.ts';
			const sx_contents = a_parts.join('\n\n');

			// if(a_encoders.length) {
			// 	// const sx_encoders = a_encoders.map(w => print(w)).join('\n\n');
			// 	console.warn(sx_contents);
			// 	debugger;
			// }

			// file already in output; merge contents
			if(si_file in h_outputs) {
				console.warn(`CAUTION: Multiple proto defs for ${si_file}; picking longer one`);

				if(sx_contents.length > h_outputs[si_file].length) {
					h_outputs[si_file] = sx_contents;
				}
			}
			// add to new file
			else {
				h_outputs[si_file] = sx_contents;
			}
		}
	}

	// build decoder file
	const a_lines_decoder: string[] = [];
	for(const g_output of a_decoders) {
		const yn_decoder = k_impl.msgDecoder(g_output);

		if(yn_decoder) {
			a_lines_decoder.push(print(yn_decoder));
		}
	}

	h_outputs['decoders.ts'] = a_lines_decoder.join('\n\n');

	// console.warn(a_lines_decoder.join('\n\n'));

	// debugger;

	return oderac(h_outputs, (si_file, sx_contents) => ({
		name: si_file,
		content: sx_contents,
	}));
});
