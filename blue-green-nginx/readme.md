# Blue-Green self-upgrading container with nginx proxy

Requires port `5800` and a local Docker registry at `localhost:5000`.

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

To start the initial container, run `docker-compose -f ./docker-compose/docker-compose.yml up`. This should start one container on a random open port and an nginx that proxies traffic from `localhost:5800` to that container. `localhost:5800` should be on the last version you pushed. 

### Upgrading process: 
1. Push a new image for a new version `./build.sh 2.0.0`
2. `curl localhost:5800/upgrade`. This will:
  - do a pull
  - do a scale up (--scale service=2)
  - the container has a startup mechanism where it:
    - stops and removes all containers except for itself and nginx (removal is required so docker-compose doesn't reuse on next scale-up) (this takes a few seconds)
    - restarts nginx
3. as a result `curl localhost:5800` > `blue-green version 2.0.0`

You can repeat these steps changing versions.  

### Caveats:
- You must place an absolute path to your docker compose file in the docker compose file, otherwise the scale up container volume doesn't resolve correctly. (at startup time, docker-compose transforms relative paths to absolute paths, and it will resolve this path relative to the container instead of the host, and as a result the path will be broken).
- This should work with both docker-compose v1 and docker-compose v2, BUT docker-compose v2 will throw an error in the `docker-compose up` process when the old container is killed, where v1 knows how to handle that and continues to pipe logs.  
- While there are two containers active, nginx could route to both of them. 
- the container uses docker-compose v1 because it's the stable release
