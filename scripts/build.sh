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
# noble: https://github.com/noble-assets/noble
# secret: https://github.com/scrtlabs/SecretNetwork

###############################
# protos from submodules
###############################
function copy() {
	echo "> rsync -a --include="*/" --include="*.proto" --exclude="*" submodules/$1/ build/proto/$2"
	rsync -a --include="*/" --include="*.proto" --exclude="*" submodules/$1/ build/proto/$2
}

tmpdir=$(mktemp -d "${TMPDIR:-/tmp/}$(basename $0).XXXXXXXXXXXX")
tmpfile="$tmpdir/buffer.proto"

function merge() {
	find submodules/$1 -type f -name "*.proto" | while read -r file; do
		dest="build/proto/$2/${file#submodules/$1/}"

		mkdir -p $(dirname $dest)

		if [[ -f "$dest" ]]; then
			# copy to tmp file
			cp "$dest" "$tmpfile"

			# merge
			echo "./merge.ts" "$file" "$dest"
			bun run ./scripts/merge.ts "$file" "$tmpfile" > "$dest"
			exit_status=$?
			if [ $exit_status -ne 0 ]; then
				exit 1
			fi
		else
			echo cp "$file" "$dest"
			cp "$file" "$dest"
		fi
	done
}

copy protobuf
copy googleapis
copy cosmos-proto/proto
copy cosmos-sdk/proto

copy cometbft/proto
copy tendermint/proto
merge cometbft/proto/tendermint tendermint

# copy cometbft/proto
# # copy tendermint/proto
# merge tendermint/proto/tendermint tendermint

copy wasmd/proto
copy ibc/proto
copy ics23/proto

merge secret/third_party/proto/cosmos cosmos

copy gaia/proto/gaia gaia
copy akash/proto/node/akash akash
copy axelar/proto/axelar axelar
copy juno/proto/juno juno
copy osmosis/proto/osmosis osmosis
copy noble/proto
copy noble-cctp/proto/circle circle
copy noble-authority/proto/noble noble
copy noble-forwarding/proto/noble/forwarding noble/forwarding
copy secret/proto

merge juno/proto/gaia gaia
merge juno/proto/osmosis osmosis

copy gogoproto


rm -rf "$tmpdir"