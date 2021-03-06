# Self-upgrading container

Requires 2 open ports, `5800` and `5801` and a local Docker registry at `localhost:5000`.

It opens two endpoints: 
```
curl localhost:5800
> self-upgrading-container version <version in package.json>
``` 

and 
```
curl localhost:5800/upgrade
> self-upgrading-container upgrade was successful
```

To push a new image do `./build.sh <semver version>`. This does an `npm version` in the background so that the running version can be identified easily. Every image push is tagged `:latest` and will overwrite the previous tag.

To start the container, open `./docker-compose/docker-compose.yml` and change `<absolute path to this file>` to the absolute path to that file.

To start the initial container, run `docker-compose -f ./docker-compose/docker-compose.yml up`. This should start a container that responds to `localhost:5800` and should be on the last version you pushed. 

### Upgrading process: 
1. Push a new image for a new version `./build.sh 2.0.0`
2. `curl localhost:5800/upgrade`. This will:
  - do a pull
  - do a scale up (--scale service=2)
  - the new container should be answering on `localhost:5081`. Check that it runs the new version.  
  - the container has a startup mechanism where it:
    - lists all running relevant containers
    - stops and removes all containers except for itself (removal is required so docker-compose doesn't reuse on next scale-up). 

You can repeat these steps, toggling between ports. 

### Caveats: 
- You must use `docker-compose` v1, otherwise range port mapping won't work (see https://github.com/docker/compose/issues/8530) and you won't be able to scale up. 
- You must place an absolute path to your docker compose file in the docker compose file, otherwise the scale up container volume doesn't resolve correctly. (at startup time, docker-compose transforms relative paths to absolute paths, and it will resolve this path relative to the container instead of the host, and as a result the path will be broken).   
- nginx should direct traffic to the running container

