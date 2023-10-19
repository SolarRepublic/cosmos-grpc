// import {default as pluginPb} from 
import type {Dict, Promisable} from '@blake.regalia/belt';
import type {CodeGeneratorRequest as CodeGenReq, CodeGeneratorResponse as CodeGenRes} from 'google-protobuf/google/protobuf/compiler/plugin_pb';
import type {FileDescriptorProto, SourceCodeInfo} from 'google-protobuf/google/protobuf/descriptor_pb';

import {fold, concat2} from '@blake.regalia/belt';

import pluginPb from 'google-protobuf/google/protobuf/compiler/plugin_pb';

// import anotations
import '../lib/annotations/gogoproto/gogo_pb.cjs';
import '../lib/annotations/google/api/annotations_pb.cjs';
import '../lib/annotations/cosmos_proto/cosmos_pb.cjs';
import '../lib/annotations/amino/amino_pb.cjs';

const {
	CodeGeneratorRequest,
	CodeGeneratorResponse,
} = pluginPb;

/**
 * Construct a simple protoc plugin from a promise
 * @param  {Function} f_plugin A function that returns a promise or value
 * @return {promise}     Resolves on success
 */
export const plugin = async(
	f_plugin: (
		a_protos: FileDescriptorProto.AsObject[],
		a_includes: Dict<FileDescriptorProto.AsObject>
	) => Promisable<CodeGenRes.File.AsObject[]>
) => {
	let atu8_accumulate = new Uint8Array();
	for await(const atu8_chunk of process.stdin) {
		atu8_accumulate = concat2(atu8_accumulate, atu8_chunk as Uint8Array);
	}

	const g_req: CodeGenReq.AsObject = pluginPb.CodeGeneratorRequest.deserializeBinary(atu8_accumulate).toObject();

	const y_res = new pluginPb.CodeGeneratorResponse();
	y_res.setSupportedFeatures(CodeGeneratorResponse.Feature.FEATURE_PROTO3_OPTIONAL);

	const h_files = fold(g_req.protoFileList, (g_proto) => {
		const si_file = g_proto.name;
		if(!si_file) throw new Error(`An included proto file is missing a name`);

		return {
			[si_file]: g_proto,
		};
	});

	const a_protos = g_req.fileToGenerateList.map(sr_file => h_files[sr_file]);

	const a_results = await f_plugin(a_protos, h_files);

	try {
		a_results.forEach((g_file, i_file) => {
			const y_file = new pluginPb.CodeGeneratorResponse.File();
			if(g_file.name) y_file.setName(g_file.name);
			if(g_file.content) y_file.setContent(g_file.content);
			if(g_file.insertionPoint) y_file.setInsertionPoint(g_file.insertionPoint);
			y_res.addFile(y_file);
		});

		process.stdout.write(y_res.serializeBinary());
	}
	catch(e_generate) {
		const y_out = new pluginPb.CodeGeneratorResponse();
		y_out.setError((e_generate as Error)?.stack || e_generate+'');
	}
};

/**
 * Find leadingComments in locationList, by pathList
 * @param  {number[]} a_path       path of comment
 * @param  {object} a_loc_list comment optioct from protobuf
 * @return {string}              the comment that you requested
 * examples paths:
 * [4, m] - message comments
 * [4, m, 2, f] - field comments in message
 * [6, s] - service comments
 * [6, s, 2, r] - rpc comments in service
 */
export const findCommentByPath = (
	a_path: number[],
	g_proto: FileDescriptorProto.AsObject
) => ((g_proto.sourceCodeInfo?.locationList || []).filter((g_loc) => {
	if(g_loc.pathList.length !== a_path.length) return false;
	let b_ans = true;

	for(let i_path=0; i_path<a_path.length; i_path++) {
		b_ans = b_ans && a_path[i_path] === g_loc.pathList[i_path];
	}

	return b_ans;
})
	.map(l => l.leadingComments)
	.pop() || '')
	.trim();

