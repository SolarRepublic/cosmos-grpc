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

function gen_proto() {
	file="${1#proto/}"
	echo "building $file..."
	protoc -I=proto \
		--ts_out=lib \
		--ts_opt=explicit_override=true \
		--ts_opt=no_namespace \
		"$file"
	script_name="${file%.proto}"
	export_name="${script_name//\//_}"
	echo "export * as $export_name from './$script_name';" >> lib/main.ts
}

function gen_all() {
	find "proto/$1" -type f -name *.proto -exec bash -c "gen_proto \"{}\"" \;
}

mkdir -p lib
: > lib/main.ts

export -f gen_proto

gen_all cosmos
gen_all cosmwasm

tsc
