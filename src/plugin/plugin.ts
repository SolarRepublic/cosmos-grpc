// import {default as pluginPb} from 
import type {AugmentedEnum, AugmentedField, AugmentedFile, AugmentedFormOf, AugmentedMessage, AugmentedService, ProtoElement} from './env';
import type {Dict, Promisable} from '@blake.regalia/belt';
import type {CodeGeneratorRequest as CodeGenReq} from 'google-protobuf/google/protobuf/compiler/plugin_pb';
import type {DescriptorProto, EnumDescriptorProto, FileDescriptorProto} from 'google-protobuf/google/protobuf/descriptor_pb';

import {fold, concat2, escape_regex, fodemtv, ode} from '@blake.regalia/belt';

import pluginPb from 'google-protobuf/google/protobuf/compiler/plugin_pb';

import {default as pb} from 'google-protobuf/google/protobuf/descriptor_pb';

// import anotations
import '../annotations/gogoproto/gogo_pb.cjs';
import '../annotations/google/api/annotations_pb.cjs';
import '../annotations/cosmos_proto/cosmos_pb.cjs';
import '../annotations/amino/amino_pb.cjs';

export type RefableType = AugmentedMessage | AugmentedEnum;

export type TypesDict = Dict<RefableType>;

export type InterfacesDict = Dict<AugmentedMessage[]>;

export type Params = {
	encoders?: RegExp[];
};

const {
	CodeGeneratorRequest,
	CodeGeneratorResponse,
} = pluginPb;

const {
	FieldDescriptorProto: {
		Label: FieldLabel,
	},
} = pb;


/**
 * Augments the given element
 */
function augment<
	g_input extends ProtoElement,
	g_output extends AugmentedFormOf<g_input>,
>(g_element: g_input, g_augments: Omit<g_output, keyof g_input>): g_output {
	return Object.assign(g_element, g_augments) as unknown as g_output;
}


/**
 * Visits each enum, augmenting them and saving to types lookup
 */
function preprocess_enums(
	a_enums: EnumDescriptorProto.AsObject[],
	g_proto: AugmentedFile,
	sr_package: string,
	h_types: TypesDict,
	a_path: number[]=[]
) {
	// each enum
	a_enums.forEach((g_enum, i_enum) => {
		// skip anonymous
		const si_enum = g_enum.name;
		if(!si_enum) return;

		// path to enum
		const p_enum = `${sr_package}.${si_enum}`;

		// append to path
		const a_local = [...a_path, 5, i_enum];

		// each value
		g_enum.valueList.forEach((g_value, i_value) => {
			// augment value
			augment(g_value, {
				comments: comments_at([...a_local, 2, i_value], g_proto, g_value.name),
				enum: g_enum as AugmentedEnum,
			});
		});

		// augment enum type and save to global lookup
		h_types[p_enum] = augment(g_enum, {
			form: 'enum',
			path: p_enum,
			source: g_proto,
			comments: comments_at(a_local, g_proto, si_enum),
		});
	});
}


/**
 * Visits each message and all nested elements recursively, augmenting them and saving types to lookup
 */
function preprocess_messages(
	a_msgs: DescriptorProto.AsObject[],
	g_proto: AugmentedFile,
	sr_package: string,
	h_types: TypesDict,
	h_interfaces: InterfacesDict,
	a_path: number[]=[]
) {
	// each message
	a_msgs.forEach((g_msg, i_msg) => {
		// skip anonymous
		const si_msg = g_msg.name;
		if(!si_msg) return;

		// path to message
		const p_msg = `${sr_package}.${si_msg}`;

		// append to path
		const a_local = [...a_path, 4, i_msg];

		// save data for implemented_by
		for(const si_implements of (g_msg as AugmentedMessage).options?.implementsInterfaceList || []) {
			(h_interfaces[si_implements] ||= []).push(g_msg as AugmentedMessage);
		}

		// each field
		g_msg.fieldList.forEach((g_field, i_field) => {
			// whether the field has the repeated modifier
			const b_repeated = FieldLabel.LABEL_REPEATED === g_field.label;

			// whether the field is deemed optional (true by default)
			let b_optional = true;

			// explicitly not nullable
			if(false === (g_field as AugmentedField).options?.nullable) {
				// explictly optional
				if(g_field.proto3Optional) {
					debugger;
					throw new Error(`Unsupported proto3Optional on ${g_field.typeName}`);
				}
				// not repeated
				else if(!(g_field as AugmentedField).repeated) {
					b_optional = true;
				}
			}

			// augment it
			augment(g_field, {
				repeated: b_repeated,
				optional: b_optional,
				comments: comments_at([...a_local, 2, i_field], g_proto, g_field.name),
			});
		});

		// process nested enums
		preprocess_enums(g_msg.enumTypeList, g_proto, p_msg, h_types, a_local);

		// process nested types
		preprocess_messages(g_msg.nestedTypeList, g_proto, p_msg, h_types, h_interfaces, a_local);

		// augment message type and save to global lookup
		h_types[p_msg] = augment(g_msg, {
			form: 'message',
			path: p_msg,
			source: g_proto,
			comments: comments_at(a_local, g_proto, si_msg),
		});
	});
}

export function parse_package_parts(si_thing: string, s_char: string) {
	const a_path = si_thing.split(s_char);

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
			s_purpose = a_path.slice(i_part+1).join(s_char).split(/[./]/)[0];
			break;
		}

		// part of module
		si_module += s_char+s_part;
	}

	// save path parts to file
	return {
		vendor: si_vendor,
		module: si_module,
		version: s_version,
		purpose: s_purpose,
	};
}


function parse_file_parts(g_proto_raw: FileDescriptorProto.AsObject): AugmentedFile {
	// split path => [vendor, module, version, purpose]
	const a_path = g_proto_raw.name!.split('/');

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
	return Object.assign(g_proto_raw, {
		parts: {
			vendor: si_vendor,
			module: si_module,
			version: s_version,
			purpose: s_purpose,
		},
	}) as unknown as AugmentedFile;
}


export const plugin = async(
	f_plugin: (
		a_protos: AugmentedFile[],
		a_includes: Dict<AugmentedFile>,
		h_types: TypesDict,
		h_interfaces: InterfacesDict,
		h_params: Params
	) => Promisable<Dict>
): Promise<void> => {
	// parse stdin
	let atu8_accumulate = new Uint8Array();
	for await(const atu8_chunk of process.stdin) {
		atu8_accumulate = concat2(atu8_accumulate, atu8_chunk as Uint8Array);
	}

	// deserialize and convert to object form
	const g_req: CodeGenReq.AsObject = pluginPb.CodeGeneratorRequest.deserializeBinary(atu8_accumulate).toObject();

	// parse params
	const h_params: Params = fold((g_req.parameter || '').split(','), (sx_param) => {
		const m_param = /^([^=]+)=(.*)$/.exec(sx_param);
		if(!m_param) throw new Error(`Failed to parse param option ${sx_param}`);

		const [, si_opt, s_value] = m_param;

		const a_values = s_value.split(';');

		let z_return: string[] | RegExp[] = a_values;

		if(['encoders'].includes(si_opt)) {
			z_return = a_values.map(s => /^\/.*\/$/.test(s)
				? new RegExp(s.slice(1, -1))
				: new RegExp('^'+escape_regex(s).replace(/\\\*/g, '.*')+'$'));
		}

		return {
			[si_opt]: z_return,
		};
	});


	// prep response
	const y_res = new pluginPb.CodeGeneratorResponse();
	y_res.setSupportedFeatures(CodeGeneratorResponse.Feature.FEATURE_PROTO3_OPTIONAL);

	// convert list of files to dict of proto files
	const h_files = fold(g_req.protoFileList, (g_proto) => {
		const si_file = g_proto.name;
		if(!si_file) throw new Error(`An included proto file is missing a name`);

		return {
			[si_file]: g_proto,
		};
	});

	// prep global lookup for types
	const h_types: TypesDict = {};
	const h_interfaces: InterfacesDict = {};

	// each included file
	const h_augmented = fodemtv(h_files, (g_proto_raw) => {
		// skip anonymous
		const si_package = g_proto_raw.pb_package;
		if(!si_package) throw new Error(`Proto file missing name: ${JSON.stringify(g_proto_raw)}`);

		// augment file parts and cast to augmented type
		const g_proto = parse_file_parts(g_proto_raw);

		// preprocess each message type
		preprocess_messages(g_proto_raw.messageTypeList, g_proto, '.'+si_package, h_types, h_interfaces);

		// preprocess each enum
		preprocess_enums(g_proto_raw.enumTypeList, g_proto, '.'+si_package, h_types);

		// each service
		g_proto_raw.serviceList.forEach((g_service, i_service) => {
			// augment it
			augment(g_service, {
				source: g_proto,
				comments: comments_at([6, i_service], g_proto, g_service.name),
			});

			// each of its methods
			g_service.methodList.forEach((g_method, i_method) => {
				// augment it
				augment(g_method, {
					service: g_service as AugmentedService,
					comments: comments_at([6, i_service, 2, i_method], g_proto, g_method.name),
				});
			});
		});

		// type-cast
		return g_proto;
	});

	// convert list of file paths to dict of proto files
	const a_protos = g_req.fileToGenerateList.map(sr_file => h_augmented[sr_file]);

	// call plugin
	const h_results = await f_plugin(a_protos, h_augmented, h_types, h_interfaces, h_params);

	// process results
	try {
		for(const [sr_file, sx_contents] of ode(h_results)) {
			const y_file = new pluginPb.CodeGeneratorResponse.File();
			y_file.setName(sr_file);
			y_file.setContent(sx_contents);
			y_res.addFile(y_file);
		}

		// a_results.forEach((g_file, i_file) => {
		// 	const y_file = new pluginPb.CodeGeneratorResponse.File();
		// 	if(g_file.name) y_file.setName(g_file.name);
		// 	if(g_file.content) y_file.setContent(g_file.content);
		// 	if(g_file.insertionPoint) y_file.setInsertionPoint(g_file.insertionPoint);
		// 	y_res.addFile(y_file);
		// });

		process.stdout.write(y_res.serializeBinary());
	}
	catch(e_generate) {
		const y_out = new pluginPb.CodeGeneratorResponse();
		y_out.setError((e_generate as Error)?.stack || e_generate+'');
	}
};


export const comments_at = (
	a_path: number[],
	g_proto: FileDescriptorProto.AsObject | AugmentedFile,
	s_name?: string
): string => ((g_proto.sourceCodeInfo?.locationList || []).filter((g_loc) => {
	if(g_loc.pathList.length !== a_path.length) return false;
	let b_ans = true;

	for(let i_path=0; i_path<a_path.length; i_path++) {
		b_ans = b_ans && a_path[i_path] === g_loc.pathList[i_path];
	}

	return b_ans;
})
	.map(l => l.leadingComments)
	.pop() || '')
	.replace(/\s*\n\s*/g, ' ')
	.replace(s_name? new RegExp('^\\s*'+escape_regex(s_name || '')+'(\\s+(is|are)\\s+)?'): /^/i, '')
	.trim();

