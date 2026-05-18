#!/bin/bash

set -o errexit
set -o nounset

script_path="$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

root_dir="$script_path/../.."

pushd "$root_dir" > /dev/null
pwd
exec "$script_path/oftw.sh" trace
