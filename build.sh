#!/bin/bash
mkdir -p proto

function copy() {
	rsync -a submodules/$1/ proto
}

copy wasmd/proto proto
copy wasmd/third_party/proto proto
# copy googleapis
# copy protobuf
# copy cosmos-proto/proto
# copy cosmos-sdk/proto



# function gen_proto() {
# 	file="${1#proto/}"
# 	echo "building $file..."
# 	protoc -I=proto \
# 		--ts_out=lib \
# 		--ts_opt=explicit_override=true \
# 		--ts_opt=no_namespace \
# 		--grpc-web_out=import_style=typescript,mode=grpcweb:lib2 \
# 		"$file"
# 	script_name="${file%.proto}"
# 	export_name="${script_name//\//_}"
# 	echo "export * as $export_name from './$script_name';" >> lib/main.ts
# }

# function gen_all() {
# 	find "proto/$1" -type f -name *.proto -exec bash -c "gen_proto \"{}\"" \;
# }

# mkdir -p lib
# : > lib/main.ts

# export -f gen_proto

# gen_all cosmos
# gen_all cosmwasm


function gen_proto2() {
	dir=$1
	path="proto/$dir"
	echo "building $path..."
	protoc \
		--plugin="protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto" \
		--ts_proto_out="lib" \
		--ts_proto_opt="esModuleInterop=true,forceLong=string,useOptionals=messages,useDate=false,lowerCaseServiceMethods=true,outputClientImpl=grpc-web" \
		--proto_path="proto" \
		$(find "$path" -path -prune -o -name '*.proto' -print0 | xargs -0)
	# script_name="${file%.proto}"
	# export_name="${script_name//\//_}"
	# echo "export * as $export_name from './$script_name';" >> lib/main.ts
}

mkdir -p lib
gen_proto2 cosmos
gen_proto2 cosmwasm

find lib -name '*.ts' | xargs -n 1 perl -i -pe 's/import _m0 from/import * as _m0 from/g'

tsc
# tsc --outDir dist2 lib2/**/*.ts
