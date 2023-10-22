#!/bin/bash

# run mode is either "run" or "debug"
s_run_mode="${1:-run}"


# root build directory
srd_build="build"

# subdir to merged proto files
srd_proto="$srd_build/proto"

# subdir to plugin and support files that will run as protoc plugin
srd_gen="$srd_build/gen"

# subdir to generated/copied typescript files prior to compilation
srd_lib="$srd_build/lib"

# subdir to final output typescript
srd_dist="$srd_build/dist"


# dirs to target proto files
srd_chains=($srd_proto/{secret,akash,gaia,osmosis,cosmos})

# dir to annotations to generate
srd_annotations="$srd_gen/annotations"

# typings output
srd_types="$srd_lib/_types"


# clean outputs
rm -rf "$srd_annotations" "$srd_lib" "$srd_dist"
mkdir -p "$srd_annotations" "$srd_lib" "$srd_dist"


# define function for annotation
add_annotation() {
	sr_path="${1//.//}"
	sr_js="$srd_annotations/${sr_path}_pb.js"

	# generate annotations using js plugin
	protoc \
		--js_out="import_style=commonjs,binary:$srd_annotations" \
		-I ./build/proto/ \
		"./build/proto/$sr_path.proto"

	# verbose
	echo "[INFO] generated annotation: $sr_js"

	# replace relative .js imports
	sed -i.delete -e 's/\(require(['"'"'"]\.[^)]*\)\.js/\1.cjs/' "$sr_js"
	rm "$sr_js.delete"
}

# add annotations
add_annotation google.api.http
add_annotation google.api.annotations
add_annotation gogoproto.gogo
add_annotation cosmos_proto.cosmos
add_annotation amino.amino

# rename all generated .js annotations => .cjs
find "$srd_annotations" -type f -name "*.js" | while read -r file; do
	mv "$file" "${file%.js}.cjs"
done

# delete .js.map files
find "$srd_annotations" -type f -name "*.js.map" | while read -r file; do
	rm "$file"
done


# define options for ts_proto
s_opts="""
env=browser
esModuleInterop=true
exportCommonSymbols=false
forceLong=string
useOptionals=all
oneof=unions
removeEnumPrefix=true
snakeToCamel=false
enumAsLiterals=true
onlyTypes=true
useJsonWireFormat=true
outputServices=false
"""

# ignore certain warnings from protoc
SX_PROTOC_IGNORE_PATTERN="Import .* is unused"


echo "[INFO] generating typings..."

# generate typings
protoc \
	--plugin='protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto' \
	--ts_proto_out="$srd_types" \
	--ts_proto_opt="$(echo -n "${s_opts/$'\n'/}" | tr '\n' ',' | sed 's/,$//')" \
	--proto_path="$srd_proto" \
	$(find "${srd_chains[@]}" -path -prune -o -name '*.proto' -print0 | xargs -0) \
	2> >(grep -v "$SX_PROTOC_IGNORE_PATTERN" >&2)

echo "[INFO] Done"


echo "[INFO] generating module..."

# generate neutrino lib
protoc \
	--plugin="protoc-gen-cosmos=$srd_gen/plugin/${s_run_mode}.js" \
	--cosmos_out="$srd_lib" \
	--proto_path="$srd_proto" \
	$(find "${srd_chains[@]}" -path -prune -o -name '*.proto' -print0 | xargs -0) \
	2> >(grep -v "$SX_PROTOC_IGNORE_PATTERN" >&2)

	# --include_imports \
	# --descriptor_set_out=dist/descriptors.pb \

echo "[INFO] Done"

# copy compiled api to lib
cp -r src/api/* "$srd_lib"


echo "[INFO] running eslint..."

# run through linter with fix-all
yarn eslint --no-ignore --parser-options project:tsconfig.lib.json --fix build/lib

echo "[INFO] Done"
