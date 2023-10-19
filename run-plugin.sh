#!/bin/bash

# dirs to target proto files
sr_protos=(proto/{secret,cosmos})

# dir to annotations to generate
sr_annotations="lib/annotations"

# typings output
sr_types="dist/types"


# clean dir
rm -rf "$sr_annotations"
mkdir -p "$sr_annotations"

# define function for annotation
add_annotation() {
	sr_path="${1//.//}"

	# generate annotations using js plugin
	protoc \
		--js_out="import_style=commonjs,binary:$sr_annotations" \
		-I proto/ \
		"proto/$sr_path.proto"

	# verbose
	echo "generated annotation: $sr_js"

	# replace relative .js imports
	sr_js="$sr_annotations/${sr_path}_pb.js"
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
find "$sr_annotations" -type f -name "*.js" | while read -r file; do
	mv "$file" "${file%.js}.cjs"
done

# delete .js.map files
find "$sr_annotations" -type f -name "*.js.map" | while read -r file; do
	rm "$file"
done


# clean dir
rm -rf "$sr_types"
mkdir -p "$sr_types"

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

# generate typings
protoc \
	--plugin='protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto' \
	--ts_proto_out="$sr_types" \
	--ts_proto_opt="$(echo -n "${s_opts/$'\n'/}" | tr '\n' ',' | sed 's/,$//')" \
	--proto_path=proto \
	$(find "${sr_protos[@]}" -path -prune -o -name '*.proto' -print0 | xargs -0)

# generate neutrino lib
protoc \
	--plugin='protoc-gen-neutrino=./build/gen.js' \
	--neutrino_out=dist \
	--include_imports \
	--descriptor_set_out=dist/descriptors.pb \
	--proto_path=proto \
	$(find "${sr_protos[@]}" -path -prune -o -name '*.proto' -print0 | xargs -0)
