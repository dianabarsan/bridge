const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHT_COMPOSE = 'docker-compose-cht.yml';
const RAPIDPRO_COMPOSE = 'docker-compose-rapidpro.yml';
const sourcePath = path.resolve('source');
const destinationPath = path.resolve('destination');

const composeCommand = (args, fileName = CHT_COMPOSE, command='docker-compose') => {
  return new Promise((resolve, reject) => {
    // -p is so we don't get the orphan warning every time we stop or up
    args = [`-f`, fileName, '-p', fileName, ...args];
    const childProcess = spawn(command, args, { cwd: destinationPath, stdio: ['ignore', 'pipe', 'pipe'] });
    childProcess.on('error', (err) => reject(err));

    let err;

    childProcess.stdout.on('data', console.log);
    childProcess.stderr.on('data', (chunk) => {
      chunk = chunk.toString();
      console.log(chunk);
      err += chunk;
    });

    childProcess.on('exit', (exitCode) => {
      exitCode ? reject(err) : resolve();
    });
  });
};

const stopContainers = async (fileName) => {
  const composePath = path.join(destinationPath, fileName);
  if (fs.existsSync(composePath)) {
    await composeCommand(['stop'], fileName);
  }
};

const overwriteComposeFile = async (sourcePath, destPath) => {
  const contents = await fs.promises.readFile(sourcePath, 'utf-8');
  await fs.promises.writeFile(destPath, contents);
};

const startContainers = async (fileName) => {
  await composeCommand(['pull'], fileName);
  await composeCommand(['up', '-d'], fileName);
};

const startUp = async () => {
  if (fs.existsSync(path.join(destinationPath, CHT_COMPOSE))) {
    await startContainers(CHT_COMPOSE);
  }
  if (fs.existsSync(path.join(destinationPath, RAPIDPRO_COMPOSE))) {
    await startContainers(RAPIDPRO_COMPOSE);
  }
};

const upgrade = async (serviceGroup, composeFileName, req, res) => {
  const version = req.query.version;
  if (!version) {
    return res.status(400).send('Version is required');
  }

  const dockerComposeSourcePath = path.join(sourcePath, `docker-compose-${serviceGroup}-${version}.yml`);
  if (!fs.existsSync(dockerComposeSourcePath)) {
    return res.status(400).send(`Invalid version: docker-compose file for version ${version} was not found`);
  }

  try {
    await stopContainers(composeFileName);
    await overwriteComposeFile(dockerComposeSourcePath, path.join(destinationPath, composeFileName));
    await startContainers(composeFileName);

    const success = `${serviceGroup} upgrade to version ${version} was successfull`;
    console.log(success);
    res.send(success);
  } catch (err) {
    console.error(err);
    res.status(500).send(JSON.stringify(err));
  }
}

const app = express();
app.all('*', (req, res, next) => {
  console.log('REQUEST', req.method, req.path, req.query);
  next();
});

app.all('/upgrade-cht', (req, res) => {
  return upgrade('cht', CHT_COMPOSE, req, res);
});

app.all('/upgrade-rapidpro', (req, res) => {
  return upgrade('rapidpro', RAPIDPRO_COMPOSE, req, res);
});

startUp();
app.listen(5100);
console.log('listening on port 5100');
