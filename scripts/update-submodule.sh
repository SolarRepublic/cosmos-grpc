#!/bin/bash
SUBMODULE="$1"
TAG="$2"

print_eval() {
	echo "> $@"
	"$@"
}

print_eval cd "submodules/$SUBMODULE" && git fetch --tags && git checkout "tags/$TAG" && cd - && git submodule
