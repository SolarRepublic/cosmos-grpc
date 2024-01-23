#!/bin/bash

# run mode is either "run" or "debug"
s_run_mode="${1:-run}"


# root build directory
srd_build="./build"

# dir to merged proto files
srd_proto="$srd_build/proto"

# dir to plugin and support files that will run as protoc plugin
srd_gen="$srd_build/gen"

# dir to generated/copied typescript files prior to compilation
srd_lib="$srd_build/lib"

# dir to final output typescript
srd_dist="$srd_build/dist"


# dirs to target proto files
srd_chains=($srd_proto/{tendermint,cosmos,secret,akash,gaia,osmosis})

# subdir to annotations to generate
srd_annotations="$srd_gen/annotations"

# subdir to plugin
srd_plugin="$srd_gen/plugin"

# subdir to generated ts proto sources
srd_lib_cosmos="$srd_lib/proto"

# subdir to copied api ts sources
srd_lib_api="$srd_lib/api"


# method for joining a multiline string list using a delimiter
join() {
	s_list=$1; s_delim=$2

	echo -n "${s_list/$'\n'/}" | tr '\n' "$s_delim" | sed "s/$s_delim$//"
}


# portable method for getting current datetime
now() {
	date +%s
}

# define functions for printing messages to console
xt_start=$(now)
log() {
	channel="$1"; shift
	xt_elapsed=$(echo "$(now) - $xt_start" | bc | awk '{printf "%.3f", $0}')
	echo "[+${xt_elapsed}s $channel] $@"
}

# alias printing info
info() {
	log INFO $1
}



# clean outputs
rm -rf "$srd_dist" "$srd_gen" "$srd_lib"
mkdir -p "$srd_dist" "$srd_annotations" "$srd_plugin" "$srd_lib_cosmos" "$srd_lib_api"


# compile plugin
tsc -p tsconfig.gen.json

# fix
yarn tsc-esm-fix --target="$srd_gen"

# chmod
chmod u+x $srd_plugin/{run,debug}.js


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
	info "generated annotation: $sr_js"

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


# ignore certain warnings from protoc
SX_PROTOC_IGNORE_PATTERN="Import .* is unused"


info "generating module..."

s_core="""
cosmos.*
tendermint.*
cosmwasm.*
akash.*
axelar.*
gaia.*
secret.*
osmosis.*
"""

# prep list of forced encoders
s_encoders="""
$s_core
"""

# /^cosmos\.tx\.v1beta1\.(.*)(?<!Request|Response)$/
# cosmos.tx.*
# cosmos.base.*
# cosmos.crypto.ed25519.PubKey
# cosmos.crypto.secp256k1.PubKey
# cosmos.crypto.secp256r1.PubKey

# prep list of forced decoders
s_decoders="""
$s_core
"""

# cosmos.tx.v1beta1.*

# prep list of forced destructors
s_destructors="""
cosmos.base.abci.*
cosmos.base.kv.*
/^cosmos\.base\.tendermint\.(Block|Header)$/
/^tendermint\.abci\..*(Response|Result)/
"""

# override types of specific decoders. format is MSG_ID:TYPE_REF
# for example: cosmos.tx.v1beta1.ModeInfo:DecodedModeInfo
s_decoder_types="""
"""

# file-specific augmentations. format is PROTO_PATH:AUGMENTATION_FILE
# for example: cosmos/tx/v1beta1/tx:scripts/augmentations/cosmos-tx-v1beta1-tx.ts.txt
s_augmentations="""
"""

# define options for plugin
s_opts="""
encoders=$(join "$s_encoders" ';')
decoders=$(join "$s_decoders" ';')
destructors=$(join "$s_destructors" ';')
decoder_types=$(join "$s_decoder_types" ';')
augmentations=$(join "$s_augmentations" ';')
"""


# generate neutrino lib
protoc \
	--plugin="protoc-gen-cosmos=$srd_plugin/${s_run_mode}.js" \
	--cosmos_out="$srd_lib_cosmos" \
	--cosmos_opt="$(join "$s_opts" ',')" \
	--proto_path="$srd_proto" \
	$(find "${srd_chains[@]}" -path -prune -o -name '*.proto' -print0 | xargs -0) \
	2> >(grep -v "$SX_PROTOC_IGNORE_PATTERN" >&2)

if [[ $? -ne 0 ]]; then
	>&2 echo "[ERROR] Errors encountered during generation"
	exit 1
fi

info "Done"


# copy compiled api to lib
cp -r src/api/* "$srd_lib_api"

# for inspection
inspect_lib() {
	cp .eslintrc.cjs "$srd_lib"
	cp tsconfig.dist.json "$srd_lib/tsconfig.json"
}


# run through linter with fix-all
info "running eslint..."
yarn eslint --no-ignore --parser-options project:tsconfig.lib.json --color --fix "$srd_lib" \
	| grep -v "warning"  # ignore warnings from initial lint cycle

if [[ $? -ne 0 ]]; then
	>&2 echo "[ERROR] Errors encountered during linting"
	inspect_lib
	exit 1
fi

info " "
info "---- end of first lint cycle ----"
info " "

# run through linter again with fix-all
yarn eslint --no-ignore --parser-options project:tsconfig.lib.json --fix "$srd_lib"

info ""
info "---- end of repeated lint cycle ----"
info ""


inspect_lib


info "compiling to dist..."

# compile to dist
tsc -p tsconfig.lib.json

info "Done"


info "fixing import specifiers..."

# copy terminal tsconfig
cp tsconfig.dist.json "$srd_dist/tsconfig.json"

# resolve tsconfig paths
yarn resolve-tspaths -s "$srd_dist" -p "$srd_dist/tsconfig.json"

# fix relative paths
yarn tsc-esm-fix --target="$srd_dist"

info "Done"
