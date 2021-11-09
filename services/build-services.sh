#!/bin/bash

main()
{
  basedir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  cd $basedir

  version="$1"

  if [ -z "$version" ]; then
    echo "Version is required"
    exit 1
  fi

  build_version $version "api"
  build_version $version "sentinel"

  sed "s/<version>/$version/g" ./docker-compose-cht.yml.template > ./docker-compose-cht-$version.yml

  build_version $version "rapidpro"
  sed "s/<version>/$version/g" ./docker-compose-rapidpro.yml.template > ./docker-compose-rapidpro-$version.yml
}

build_version()
{
  local version="$1"
  local service="$2"

  cd ./$service
  npm version --no-git-tag-version --allow-same-version $version
  docker build . --tag bridge/$service:$version
  docker image tag bridge/$service:$version localhost:5000/bridge/$service:$version
  docker image push localhost:5000/bridge/$service:$version
  cd ../
}

main $1
