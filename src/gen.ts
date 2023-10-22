#!/usr/bin/env node --inspect-brk

import type {AugmentedEnum, AugmentedField, AugmentedFile, AugmentedMessage, AugmentedMethod, AugmentedService, EnumAugmentations, FieldAugmentations, MessageAugmentations, MethodAugmentations, ServiceAugmentations} from './env';

import type {RpcImplementor} from './rpc-impl';
import type {Dict} from '@blake.regalia/belt';

import type {
	FileDescriptorProto,
	ServiceDescriptorProto,
	MethodDescriptorProto,
	DescriptorProto,
	EnumDescriptorProto,
	FieldDescriptorProto,
} from 'google-protobuf/google/protobuf/descriptor_pb';
import type {Statement} from 'typescript';

import {__UNDEFINED, escape_regex, ode, oderac} from '@blake.regalia/belt';

import {default as pb} from 'google-protobuf/google/protobuf/descriptor_pb';

import {map_proto_path, version_supercedes} from './common';
import {NeutrinoImpl} from './impl-neutrino';
import {findCommentByPath, plugin} from './plugin';
import {importModule, print} from './ts-factory';

const {
	FieldDescriptorProto: {
		Label: FieldLabel,
	},
} = pb;

// inject into preamble of any file, allow linter to delete unused imports
const A_GLOBAL_PREAMBLE = [
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
			'text_to_buffer',
			'buffer_to_text',
		]),
		importModule('#/protobuf-writer', [
			'Protobuf',
			'map',
			'temporal',
			'any',
			'coin',
			'coins',
		]),
		importModule('#/protobuf-reader', [
			'decode_protobuf',
			'decode_protobuf_r0',
			'decode_protobuf_r0_0',
			'decode_coin',
			'reduce_temporal',
		]),
		importModule('#/lcd', [
			'F_RPC_REQ_NO_ARGS',
			'lcd_query',
		]),
		importModule('#/types', [
			'WeakInt64Str',
			'WeakUint64Str',
			'WeakInt128Str',
			'WeakUint128Str',
			'Int64Str',
			'Uint64Str',
			'Int128Str',
			'Uint128Str',
			'WeakAccountAddr',
			'WeakValidatorAddr',
			'AccountAddr',
			'ValidatorAddr',
			'HexLower',
			'ImplementsInterface',
		], true),
	].map(print),
];

const augment_service = (
	g_service: ServiceDescriptorProto.AsObject,
	g_augments: Omit<ServiceAugmentations, keyof ServiceDescriptorProto.AsObject>
): AugmentedService => Object.assign(g_service, g_augments) as unknown as AugmentedService;

const augment_method = (
	g_method: MethodDescriptorProto.AsObject,
	g_augments: Omit<MethodAugmentations, keyof MethodDescriptorProto.AsObject>
): AugmentedMethod => Object.assign(g_method, g_augments) as unknown as AugmentedMethod;

const augment_enum = (
	g_enum: EnumDescriptorProto.AsObject,
	g_augments: Omit<EnumAugmentations, keyof EnumDescriptorProto.AsObject>
): AugmentedEnum => Object.assign(g_enum, g_augments);

const augment_message = (
	g_msg: DescriptorProto.AsObject,
	g_augments: Omit<MessageAugmentations, keyof DescriptorProto.AsObject>
): AugmentedMessage => Object.assign(g_msg, g_augments) as unknown as AugmentedMessage;

const augment_field = (
	g_field: FieldDescriptorProto.AsObject,
	g_augments: Omit<FieldAugmentations, keyof FieldDescriptorProto.AsObject>
): AugmentedField => Object.assign(g_field, g_augments) as AugmentedField;

const capture_messages = (
	k_impl: RpcImplementor,
	g_proto: AugmentedFile,
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
		augment_field(g_field, {
			repeated: FieldLabel.LABEL_REPEATED === g_field.label,
			comments: findCommentByPath([...a_local, 2, i_field], g_proto, g_field.name),
		});
	});

	// save to global lookup
	k_impl.msg(p_msg, augment_message(g_msg, {
		source: g_proto,
		index: i_msg,
		comments: findCommentByPath(a_local, g_proto, g_msg.name),
	}));

	// capture nested types
	g_msg.nestedTypeList.forEach(capture_messages(k_impl, g_proto, p_msg, a_local));
};

type OutputFile = Dict<string>;

void plugin((a_protos, h_inputs) => {
	// new impl
	const k_impl = new NeutrinoImpl();

	const h_outputs: Dict<OutputFile> = {};

	// each included file
	for(const [, g_proto_raw] of ode(h_inputs)) {
		// force cast type of proto file
		const g_proto = g_proto_raw as unknown as AugmentedFile;

		// skip anonymous
		const si_package = g_proto.pb_package;
		if(!si_package) continue;

		// split path => [vendor, module, version, purpose]
		const a_path = g_proto.name!.split('/');

		// prep path parts
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

		// save path parts to file
		Object.assign(g_proto, {
			parts: {
				vendor: si_vendor,
				module: si_module,
				version: s_version,
				purpose: s_purpose,
			},
		});

		// each message type
		g_proto_raw.messageTypeList.forEach(capture_messages(k_impl, g_proto, '.'+si_package));

		// each enum
		g_proto.enumTypeList.forEach((g_enum, i_enum) => {
			// skip anonymous
			const si_enum = g_enum.name;
			if(!si_enum) return;

			// save to global lookup
			k_impl.enum(`.${si_package}.${si_enum}`, augment_enum(g_enum, {
				source: g_proto,
				index: i_enum,
				comments: findCommentByPath([5, i_enum], g_proto, g_enum.name),
			}));
		});

		// each service
		g_proto.serviceList.forEach((g_service, i_service) => {
			// augment service
			augment_service(g_service, {
				source: g_proto,
				index: i_service,
				comments: findCommentByPath([6, i_service], g_proto),
			});

			// each method
			g_service.methodList.forEach((g_method, i_method) => {
				// augment method
				augment_method(g_method, {
					service: g_service,
					comments: findCommentByPath([6, i_service, 7, i_method], g_proto),
				});
			});
		});
	}

	// each proto file
	for(const g_proto of a_protos as unknown as AugmentedFile[]) {
		// reset instance's internal file stuff
		k_impl.reset();

		// new string lists
		const a_lcds: string[] = [];
		const a_encoders: string[] = [];
		const a_decoders: string[] = [];

		// destructure path parts
		const {
			vendor: si_vendor,
			module: si_module,
			version: si_version,
		} = g_proto.parts;

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
					const g_opts = g_method.options;
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
				const g_opts = g_method.options;
				const g_http = g_opts?.http;

				// get comment(s)
				const s_comments = findCommentByPath([6, i_service, 2, i_method], g_proto) || '';

				// LCD implementation
				if(g_http?.get || g_http?.post) {
					const sx_lcd = k_impl.lcd(
						si_service,
						s_path_prefix,
						g_method,
						g_input,
						g_output,
						s_comments
					);

					a_lcds.push(sx_lcd);
				}
				// otherwise, create encoder/decoder
				else {
					// add encoder
					a_encoders.push(k_impl.msgEncoder(g_method, g_input, g_output, s_comments));

					// message has output; add decoder to queue
					if(g_output.fieldList.length) {
						const sx_decoder = k_impl.msgDecoder(g_output);

						if(sx_decoder) a_decoders.push(sx_decoder);
					}
				}
			});
		});

		// interface messages
		g_proto.messageTypeList.forEach((g_msg, i_msg) => {
			// skip anonymous messages
			const si_msg = g_msg.name?.toLowerCase();
			if(!si_msg) return;

			// implements interface; generate 'any' encoder
			const g_opts = g_msg.options;
			if(g_opts?.implementsInterfaceList) {
				a_encoders.push(k_impl.anyEncoder(g_msg)!);
			}
		});

		// would-be file name
		const si_file = map_proto_path(g_proto)+'.ts';

		// body
		const a_body: string[] = [];

		// prep file parts
		const g_parts = {
			head: [
				...A_GLOBAL_PREAMBLE,
				...k_impl.imports(),
			],
			body: a_body,
		};

		// lcd methods
		if(a_lcds.length) {
			g_parts.head.push(...k_impl.head('lcd'));

			a_body.push(
				...k_impl.body('lcd'),
				...a_lcds
			);
		}

		// encoders
		if(a_encoders.length) {
			g_parts.head.push(...k_impl.head('encoder'));

			a_body.push(
				...k_impl.body('encoder'),
				...a_encoders
			);
		}

		// decoders
		if(a_decoders.length) {
			g_parts.head.push(...k_impl.head('decoder'));

			a_body.push(
				...k_impl.body('decoder'),
				...a_decoders
			);
		}

		if(a_body.length) {
			(h_outputs[si_file] ||= {})[si_version] = [g_parts.head.join('\n'), ...g_parts.body].join('\n\n');
		}
	}

	// // build decoder file
	// const a_lines_decoder: string[] = [];
	// for(const g_output of a_decoders) {
	// 	const yn_decoder = k_impl.msgDecoder(g_output);

	// 	if(yn_decoder) {
	// 		a_lines_decoder.push(print(yn_decoder));
	// 	}
	// }

	// h_outputs['decoders.ts'][''] = a_lines_decoder.join('\n\n');

	// console.warn(a_lines_decoder.join('\n\n'));

	debugger;


	return oderac(h_outputs, (si_file, h_versions) => ({
		name: si_file,
		content: (() => {
			// all versions generated
			const a_versions = Object.keys(h_versions);

			// default current best pick to first one
			let s_picked = a_versions[0] || '';

			// multiple versions
			if(a_versions.length > 1) {
				// each version
				for(const si_version of a_versions) {
					if(version_supercedes(si_version, s_picked)) {
						s_picked = si_version;
					}
				}

				console.warn(`Multiple versions of '${si_file}' were generated from: [${a_versions.join(', ')}];\n    └─ picked latest: ${s_picked}`);
			}

			// return best pick
			return h_versions[s_picked] || '';
		})(),
	}));
});
