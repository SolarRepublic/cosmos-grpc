#!/bin/bash
mkdir -p build/proto

###############################
# chains to build from
###############################
# gaia: https://github.com/cosmos/gaia
# akash: https://github.com/akash-network/akash-api
# axelar: https://github.com/axelarnetwork/axelar-core
# juno: https://github.com/CosmosContracts/juno
# osmosis: https://github.com/osmosis-labs/osmosis
# secret: https://github.com/scrtlabs/SecretNetwork

###############################
# protos from submodules
###############################
function copy() {
	rsync -a --include="*/" --include="*.proto" --exclude="*" submodules/$1/ build/proto/$2
}

copy protobuf
copy googleapis
copy cosmos-proto/proto
copy cosmos-sdk/proto
copy wasmd/proto
copy ibc/proto
copy ics23/proto

# TODO: perform additive merging of protobufs from different projects
# copy secret/third_party/proto/cosmos cosmos
merge() {
	find submodules/$1 -type f -name "*.proto" | while read -r file; do
		mv "$file" "${file%.js}.cjs"
	done
}

merge secret/third_party/proto/cosmos cosmos

copy gaia/proto/gaia gaia
copy akash/proto/node/akash akash
copy axelar/proto/axelar axelar
copy juno/proto/juno juno
copy osmosis/proto/osmosis osmosis
copy secret/proto

merge juno/proto/gaia gaia
merge juno/proto/osmosis osmosis

copy gogoproto


# ###############################
# # annotations
# ###############################
# sr_annotations="lib/_annotations"
# rm -rf "$sr_annotations"
# mkdir -p "$sr_annotations"

# add_annotation() {
# 	sr_path="${1//.//}"
# 	echo "copying annotations at $sr_path..."

# 	protoc "--js_out=import_style=commonjs,binary:$sr_annotations" \
# 		-I proto/ \
# 		"proto/$sr_path.proto"
# }

# add_annotation google.api.http
# add_annotation gogoproto.gogo



# ###############################
# # plugin
# ###############################
# protoc \
# 	--plugin='protoc-gen-neutrino=./dist/gen.js' \
# 	--neutrino_out=generated \
# 	--include_imports \
# 	--descriptor_set_out=dist/descriptors.pb \
# 	--proto_path=proto \
# 	$(find proto/{cosmos,secret} -path -prune -o -name '*.proto' -print0 | xargs -0)



# function gen_proto() {
# 	dir=$1
# 	path="proto/$dir"
# 	echo "building $path..."
# 	protoc \
# 		--plugin="protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto" \
# 		--ts_proto_out="lib" \
# 		--ts_proto_opt="esModuleInterop=true,forceLong=string,useOptionals=messages,useDate=false,lowerCaseServiceMethods=true,outputClientImpl=grpc-web" \
# 		--proto_path="proto" \
# 		$(find "$path" -path -prune -o -name '*.proto' -print0 | xargs -0)
# }

# mkdir -p lib
# gen_proto cosmos
# gen_proto cosmwasm
# gen_proto secret

# function replace() {
# 	find lib -name '*.ts' | xargs -n 1 perl -i -pe "s/$1/$2/g"
# }

# # find lib -name '*.ts' | xargs -n 1 perl -i -pe 's/import _m0 from/import * as _m0 from/g'
# # find lib -name '*.ts' | xargs -n 1 perl -i -pe 's/\@improbable-eng\/grpc-web/\@solar-republic\/grpc-web/g'
# # find lib -name '*.ts' | xargs -n 1 perl -i -pe 's/"browser-headers"/"\@solar-republic\/js-browser-headers"/g'

# replace 'import _m0 from' 'import * as _m0 from'
# replace '\@improbable-eng\/grpc-web' '\@solar-republic\/grpc-web'
# replace '"browser-headers"' '"\@solar-republic\/js-browser-headers"'

# replace 'export const FileDescriptorsResponse ' 'export const FileDescriptorsResponse: any '
# replace 'export const FileDescriptorSet ' 'export const FileDescriptorSet: any '
# replace 'export const FileDescriptorProto ' 'export const FileDescriptorProto: any '
# replace 'export const DescriptorProto ' 'export const DescriptorProto: any '

# tsc