
import type {AugmentedEnum, AugmentedMessage} from './env';

import type {Dict} from '@blake.regalia/belt';

import {ode, odv} from '@blake.regalia/belt';

import {NeutrinoImpl} from './impl-neutrino';
import {plugin} from './plugin';
import {importModule, print} from './ts-factory';

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
			'oda',
			'base64_to_buffer',
			'text_to_buffer',
		]),
		importModule('@blake.regalia/belt', [
			'NaiveHexLower',
		], true),
		importModule('@solar-republic/types', [
			'WeakInt64Str',
			'WeakUint64Str',
			'WeakInt128Str',
			'WeakUint128Str',
			'WeakAccountAddr',
			'WeakValidatorAddr',
			'SlimCoin',
			'CwInt64',
			'CwUint64',
			'CwHexLower',
			'CwBase64',
			'CwAccountAddr',
			'CwValidatorAddr',
		], true),
		importModule('#/api/bech32', [
			'bech32_encode',
			'bech32_decode',
		]),
		importModule('#/api/util', [
			'safe_buffer_to_base64',
			'safe_buffer_to_text',
			'safe_base64_to_buffer',
			'safe_base64_to_text',
		]),
		importModule('#/api/json', [
			'parse_duration',
			'parse_timestamp',
			'duration_to_json',
			'timestamp_to_json',
		]),
		importModule('#/api/protobuf-writer', [
			'Protobuf',
			'map',
			'temporal',
			'any',
			'coin',
			'coins',
		]),
		importModule('#/api/protobuf-reader', [
			'decode_protobuf',
			'decode_protobuf_r0',
			'decode_protobuf_r0_0',
			'decode_coin',
			'reduce_temporal',
			'decode_temporal',
		]),
		importModule('#/api/transport', [
			'F_RPC_REQ_NO_ARGS',
			'restful_grpc',
			'restruct_coin',
			'restruct_temporal',
		]),
		importModule('#/api/types', [
			'Encoded',
			'JsonAny',
			'Opt',
			'WeakTimestampStr',
			'WeakDurationStr',
		], true),
	].map(yn => print(yn)),
];


export const main = () => {
	void plugin((a_protos, h_inputs, h_types, h_interfaces, h_params) => {
		// new impl
		const k_impl = new NeutrinoImpl(h_types, h_interfaces, h_params);

		const h_drafts: Dict<{
			enums: Set<string>;
		}> = {};

		const h_outputs: Dict<string> = {};

		type SerializedMessages = Dict<{
			message: AugmentedMessage;
			contents: string[];
		}>;

		// [typePath: string]: serialized message
		const h_encoders: SerializedMessages = {};
		const h_decoders: SerializedMessages = {};
		const h_destructors: SerializedMessages = {};
		const h_accessors: SerializedMessages = {};

		// 
		type ClosureStruct = {
			messages: Dict<AugmentedMessage>;
			enums: Dict<AugmentedEnum>;
		};

		const init_closure = (): ClosureStruct => ({
			messages: {},
			enums: {},
		});

		const g_encoders = init_closure();
		const g_decoders = init_closure();
		const g_destructors = init_closure();
		const g_accessible = init_closure();

		// const h_closure: Dict<AugmentedMessage> = {};
		// const h_enums: Dict<AugmentedEnum> = {};

		/**
		 * add closures from given message type
		 */
		function mark_fields(g_msg: AugmentedMessage, g_coders: ClosureStruct) {
			// ensure message is covered
			g_coders.messages[g_msg.path] = g_msg;

			// ensure every field's type has an encoder
			for(const g_field of g_msg.fieldList) {
				// ref type path
				const si_type = g_field.typeName;

				// no typename; skip
				if(!si_type) continue;

				// resolve type
				const g_resolved = h_types[si_type];

				// type exists, is not encoded, and is not yet defined in closure/enum
				if(!g_coders.messages[si_type] && !g_coders.enums[si_type]) {
					// message; recurse
					if('message' === g_resolved.form) {
						mark_fields(g_resolved, g_coders);
					}
					// enum
					else {
						// save to enums struct
						g_coders.enums[si_type] = g_resolved;

						// TODO: what should happen here between encoders and decoders?

						// if('ProposalStatus' === g_msg.source.name) debugger;

						// add to draft
						(h_drafts[g_resolved.source.name!] ||= {
							enums: new Set(),
						}).enums.add(si_type);
					}
				}
			}
		}


		const h_tmps: Dict<{
			a_gateways: string[];
			a_anys: string[];
			a_decoders: string[];
		}> = {};

		// each proto file
		for(const g_proto of a_protos) {
			// open file for path
			k_impl.open(g_proto);

			// new string lists
			const a_gateways: string[] = [];
			const a_anys: string[] = [];
			const a_decoders: string[] = [];

			h_tmps[k_impl.path] = {
				a_gateways,
				a_anys,
				a_decoders,
			};

			// each top-level messages
			for(const g_msg of g_proto.messageTypeList) {
				// ref message options
				const g_opts = g_msg.options;

				// implements interface
				if(g_opts?.implementsInterfaceList) {
					// produce 'any' encoder
					a_anys.push(k_impl.anyEncoder(g_msg));

					// ensure its fields can be encoded
					mark_fields(g_msg, g_encoders);

					// ensure its fields can be described
					mark_fields(g_msg, g_accessible);

					// ensure response values can be destructured
					mark_fields(g_msg, g_destructors);
				}

				// each encoder pattern
				for(const r_match of h_params.encoders || []) {
					// match found
					if(r_match.test(g_msg.path.slice(1))) {
						// verbose
						console.warn(`INFO: Matched to encoders pattern: "${g_msg.path.slice(1)}"`);

						// add encoder
						h_encoders[g_msg.path] = {
							message: g_msg,
							contents: [k_impl.msgEncoder(g_msg)],
						};

						// ensure its fields can be encoded
						mark_fields(g_msg, g_encoders);
					}
				}

				// each decoder pattern
				for(const r_match of h_params.decoders || []) {
					// match found
					if(r_match.test(g_msg.path.slice(1))) {
						// verbose
						console.warn(`INFO: Matched to decoders pattern: "${g_msg.path.slice(1)}"`);

						const a_decoder = k_impl.msgDecoder(g_msg);
						if(a_decoder) {
							// add decoder
							h_decoders[g_msg.path] = {
								message: g_msg,
								contents: a_decoder,
							};
						}

						// ensure its fields can be decoded
						mark_fields(g_msg, g_decoders);
					}
				}

				// each destructor pattern
				for(const r_match of h_params.destructors || []) {
					// match found
					if(r_match.test(g_msg.path.slice(1))) {
						// verbose
						console.warn(`INFO: Matched to destructors pattern: "${g_msg.path.slice(1)}"`);

						// add encoder
						h_destructors[g_msg.path] = {
							message: g_msg,
							contents: k_impl.msgDestructor(g_msg),
						};

						// ensure its fields can be destructed
						mark_fields(g_msg, g_destructors);
					}
				}

				// each accessor pattern
				for(const r_match of h_params.accessors || []) {
					// match found
					if(r_match.test(g_msg.path.slice(1))) {
						// verbose
						console.warn(`INFO: Matched to accessors pattern: "${g_msg.path.slice(1)}"`);

						// add accessor
						h_accessors[g_msg.path] = {
							message: g_msg,
							contents: k_impl.msgAccessor(g_msg),
						};

						// ensure its fields can be accessed
						mark_fields(g_msg, g_accessible);
					}
				}
			}

			// each service
			for(const g_service of g_proto.serviceList) {
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
				for(const g_method of g_service.methodList) {
					// skip functions missing input or output type
					if(!g_method.inputType || !g_method.outputType) continue;
					const {
						inputType: sr_input,
						outputType: sr_output,
					} = g_method;

					// locate rpc input
					const g_input = h_types[sr_input];
					if('message' !== g_input?.form) throw new Error(`Failed to find rpc input ${sr_input} in ${g_proto.name!}`);

					// locate rpc output
					const g_output = h_types[sr_output];
					if('message' !== g_output?.form) throw new Error(`Failed to find rpc output ${sr_output}`);

					// gRPC-gateway method
					const g_http = g_method.options?.http;
					if(g_http?.get || g_http?.post) {
						const sx_gateway = k_impl.gateway(
							s_path_prefix,
							g_method,
							g_input,
							g_output
						);

						// add gateway method
						a_gateways.push(sx_gateway);

						// ensure its output can be destructured
						mark_fields(g_output, g_destructors);

						// ensure its output can be described
						mark_fields(g_output, g_accessible);

						// ensure its inputs are typed and enums accessible
						mark_fields(g_input, g_accessible);
					}
					// otherwise, ensure user can encode method inputs and decode method outputs
					else {
						// add input encoder
						h_encoders[g_input.path] = {
							message: g_input,
							contents: [k_impl.msgEncoder(g_input)],
						};

						// ensure its fields can be encoded
						mark_fields(g_input, g_encoders);

						// method output has content
						if(g_output.fieldList.length) {
							// render decoder
							const a_decoder = k_impl.msgDecoder(g_output);

							// decoder is OK
							if(a_decoder) {
								// add decoder
								a_decoders.push(...a_decoder);

								// ensure its fields can be decoded
								mark_fields(g_output, g_decoders);
							}
						}
					}
				}
			}
		}


		// each message in need of an encoder
		for(const [, g_msg] of ode(g_encoders.messages)) {
			// add encoder
			h_encoders[g_msg.path] = {
				message: g_msg,
				contents: [k_impl.msgEncoder(g_msg)],
			};
		}

		debugger;
		// each message in need of a decoder
		for(const [, g_msg] of ode(g_decoders.messages)) {
			const a_decoder = k_impl.msgDecoder(g_msg);

			if(a_decoder) {
				// add decoder
				h_decoders[g_msg.path] = {
					message: g_msg,
					contents: a_decoder,
				};
			}
			else {
				// debugger;
				console.warn(`WARNING: Skipping decoder for ${g_msg.path}`);
			}

			const a_destructor = k_impl.msgDestructor(g_msg);
			if(a_destructor) {
				h_destructors[g_msg.path] = {
					message: g_msg,
					contents: a_destructor,
				};
			}
		}

		// each message in need of a destructor
		for(const [, g_msg] of ode(g_destructors.messages)) {
			const a_destructor = k_impl.msgDestructor(g_msg);
			if(a_destructor) {
				h_destructors[g_msg.path] = {
					message: g_msg,
					contents: a_destructor,
				};
			}
		}

		// each message in need of an accessor
		for(const [, g_msg] of ode(g_accessible.messages)) {
			const a_accessors = k_impl.msgAccessor(g_msg);
			if(a_accessors) {
				h_accessors[g_msg.path] = {
					message: g_msg,
					contents: a_accessors,
				};
			}
		}

		debugger;
		// every file
		for(const [, g_proto] of ode(h_inputs)) {
			// open
			k_impl.open(g_proto);
			const p_output = k_impl.path;

			const {
				a_gateways,
				a_anys,
			} = h_tmps[k_impl.path] || {};

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
			if(a_gateways?.length) {
				g_parts.head.push(...k_impl.head('lcd'));

				a_body.push(
					...k_impl.body('lcd'),
					...a_gateways
				);
			}

			// anys
			if(a_anys?.length) {
				g_parts.head.push(...k_impl.head('any'));

				a_body.push(
					...k_impl.body('any'),
					...a_anys
				);
			}

			// encoders
			const a_encoders: string[] = [];
			for(const g_encoder of odv(h_encoders)) {
				if(g_proto === g_encoder.message.source) {
					a_encoders.push(...g_encoder.contents);
				}
			}

			if(a_encoders.length) {
				g_parts.head.push(...k_impl.head('encoder'));

				a_body.push(
					...k_impl.body('encoder'),
					...a_encoders
				);
			}

			// decoders
			const a_decoders: string[] = [];
			for(const g_decoder of odv(h_decoders)) {
				if(g_proto === g_decoder.message.source) {
					a_decoders.push(...g_decoder.contents);
				}
			}

			if(a_decoders.length) {
				g_parts.head.push(...k_impl.head('decoder'));

				a_body.push(
					...k_impl.body('decoder'),
					...a_decoders
				);
			}

			// destructors
			const a_destructors: string[] = [];
			for(const g_destructor of odv(h_destructors)) {
				if(g_proto === g_destructor.message.source) {
					a_destructors.push(...g_destructor.contents);
				}
			}

			if(a_destructors.length) {
				a_body.push(
					...a_destructors
				);
			}


			// accessors
			const a_accessors: string[] = [];
			for(const [p_accessor, g_accessor] of ode(h_accessors)) {
				// skip redundant
				if(h_destructors[p_accessor]) continue;

				if(g_proto === g_accessor.message.source) {
					a_accessors.push(...g_accessor.contents);
				}
			}

			if(a_accessors.length) {
				a_body.push(
					...a_accessors
				);
			}

			// // decoders
			// if(a_decoders?.length) {
			// 	g_parts.head.push(...k_impl.head('decoder'));

			// 	a_body.push(
			// 		...k_impl.body('decoder'),
			// 		...a_decoders
			// 	);
			// }


			const g_draft = h_drafts[g_proto.name!] || {};

			// enums
			const as_enums = g_draft.enums;
			if(as_enums) {
				for(const si_enum of as_enums) {
					const g_enum = h_types[si_enum] as AugmentedEnum;

					a_body.push(...k_impl.enums(g_enum));
				}
			}

			// there are contents to write to the file
			if(a_body.length) {
				h_outputs[p_output] = [[...new Set(g_parts.head)].join('\n'), ...g_parts.body].join('\n\n');
			}
		}

		debugger;

		return h_outputs;
	});
};
