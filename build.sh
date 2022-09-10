#!/bin/bash
mkdir -p proto

function copy() {
	rsync -a submodules/$1/ proto
}

copy wasmd/proto proto
copy wasmd/third_party/proto proto
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

find lib -name '*.ts' | xargs -n 1 perl -i -pe 's/import _m0 from/import * as _m0 from/g'

tsc