#!/bin/bash
mkdir -p proto

function copy() {
	rsync -a submodules/$1/ proto
}

copy protobuf proto
copy googleapis proto
copy cosmos-proto/proto proto
copy cosmos-sdk/proto proto
copy wasmd/proto proto
copy secret/proto proto

function gen_proto() {
	dir=$1
	path="proto/$dir"
	echo "building $path..."
	protoc \
		--plugin="protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto" \
		--ts_proto_out="lib" \
		--ts_proto_opt="esModuleInterop=true,forceLong=string,useOptionals=messages,useDate=false,lowerCaseServiceMethods=true,outputClientImpl=grpc-web" \
		--proto_path="proto" \
		$(find "$path" -path -prune -o -name '*.proto' -print0 | xargs -0)
}

mkdir -p lib
gen_proto cosmos
gen_proto cosmwasm
gen_proto secret

function replace() {
	find lib -name '*.ts' | xargs -n 1 perl -i -pe "s/$1/$2/g"
}

# find lib -name '*.ts' | xargs -n 1 perl -i -pe 's/import _m0 from/import * as _m0 from/g'
# find lib -name '*.ts' | xargs -n 1 perl -i -pe 's/\@improbable-eng\/grpc-web/\@solar-republic\/grpc-web/g'
# find lib -name '*.ts' | xargs -n 1 perl -i -pe 's/"browser-headers"/"\@solar-republic\/js-browser-headers"/g'

replace 'import _m0 from' 'import * as _m0 from'
replace '\@improbable-eng\/grpc-web' '\@solar-republic\/grpc-web'
replace '"browser-headers"' '"\@solar-republic\/js-browser-headers"'

replace 'export const FileDescriptorsResponse ' 'export const FileDescriptorsResponse: any '
replace 'export const FileDescriptorSet ' 'export const FileDescriptorSet: any '
replace 'export const FileDescriptorProto ' 'export const FileDescriptorProto: any '
replace 'export const DescriptorProto ' 'export const DescriptorProto: any '

tsc