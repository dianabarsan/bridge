#!/bin/bash

main()
{
  basedir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  cd $basedir
  cd "container"

  version="$1"

  if [ -z "$version" ]; then
    echo "Version is required"
    exit 1
  fi

  npm version --no-git-tag-version --allow-same-version $version
  docker build . --tag bridge/blue-green:latest
  docker image tag bridge/blue-green:latest localhost:5000/bridge/blue-green:latest
  docker image push localhost:5000/bridge/blue-green:latest
}

main $1
