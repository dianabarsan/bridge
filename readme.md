# Proof of Concept for a bridge container that manages starting and upgrading other containers

For simplicity all ports are hardcoded for now. Required open ports are: 
- `5000` for the docker registry
- `5100` for the bridge service
- `5200` for the "api" service
- `5300` for the "sentinel" service

## Local Docker Registry

This project relies on using a local Docker registry. There's a template for one in `/registry`. Start it with `docker-compose up -d`. 
The registry listens on port `5000`.

## Two services

There are two dummy services included, symbolically named "api" and "sentinel". These just expose an express app on port `5200` (api) and `5300` (sentinel) and only answer to `GET /`. 
The response to `GET /` should look like: 
```
<Service name> version is <version> and FOO=<environment variable value>
```

Images for these services need to be build and pushed to the local docker registry. 
There's a helper shell file that will upgrade the versions, build the images and push them. 
Please run: 
```sh
cd services
./build-services.sh 1.0.0 
./build-services.sh 2.0.0
./build-services.sh 3.0.0
./build-services.sh 4.0.0
```

The only required parameter is the version to push, because we use `npm version` in the background, please use a semver valid version. These commands will update `package.json` files, build the images, push them to the registry and create a `./services/docker-compose-<version>.yml` file that will be used by the bridge.  

The version will be part of the response to the endpoint (directly read from `package.json`) and is the way we verify that the service container was actually updated.

## The bridge container

Find the bridge container in `/bridge` . This is the only interesting part of this project.
This container mounts three locations: 

1. the docker socket (required so we run `docker-compose` commands from inside the docker container)
2. a local folder named `./docker-compose`. This folder already exists in the repo just to hold an `.env` file and simulate how environment variable values are resolved. 
3. the `./services` folder, to get the `./services/docker-compose-<version>.yml`. In "production", these will be hosted on staging.dev or something. 

Build and run the bridge by: 
```sh
cd bridge
docker-compose build
docker-compose up
```

`docker-compose up` will actually try to start your containers if you have a `docker-compose.yml` file in the `./docker-compose` folder. If not, you'll have to run the "upgrade". 

The bridge exposes an express app on port `5100` and one endpoint `/upgrade?version=<version>`. 
Call with:
```
curl http://127.0.0.1:5100/upgrade?version=2.0.0
```
This will:
1. Set the working directory to the mounted `/docker-compose`
2. Run `docker-compose down --remove-orphans`
3. Overwrite `/docker-compose/docker-compose.yml` with `./services/docker-compose-2.0.0.yml`
4. Run `docker-compose pull`
5. Run `docker-compose up -d`
 
As a result:
```
curl http://127.0.0.1:5200 
> API version is 2.0.0 and FOO=baz
```

Similarly:
```
curl http://127.0.0.1:5300 
> Sentinel version is 2.0.0 and FOO=baz
```

Notice that the `FOO` is `baz`, which is the value from the `.env` file in `./bridge` and *not* the value from the `.env` file from `./docker-compose`. This is me experimenting with passing environment variables through, with the idea that this "container" might end up being our installer, so most users won't ever need to run `docker-compose up` manually.  

```
curl http://127.0.0.1:5100/upgrade?version=3.0.0
```
will get you to
```
curl http://127.0.0.1:5200 
> API version is 3.0.0 and FOO=baz
curl http://127.0.0.1:5300 
> Sentinel version is 3.0.0 and FOO=baz
```
