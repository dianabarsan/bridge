const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve('source');
const destinationPath = path.resolve('destination');
const dockerComposeFilePath = path.join(destinationPath, 'docker-compose.yml');

const composeCommand = (options, command='docker-compose') => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, options, { cwd: destinationPath, stdio: ['ignore', 'pipe', 'pipe'] });
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

const stopContainers = async () => {
  if (fs.existsSync(dockerComposeFilePath)) {
    await composeCommand(['down', '--remove-orphans']);
  }
};

const overwriteComposeFile = async (sourcePath, destPath) => {
  const contents = await fs.promises.readFile(sourcePath, 'utf-8');
  await fs.promises.writeFile(destPath, contents);
};

const startContainers = async () => {
  await composeCommand(['pull']);
  await composeCommand(['up', '-d']);
};

const startUp = async () => {
  if (!fs.existsSync(dockerComposeFilePath)) {
    return;
  }
  await startContainers();
};

const app = express();
app.all('*', (req, res, next) => {
  console.log('REQUEST', req.method, req.path, req.query);
  next();
});

app.all('/upgrade', async (req, res) => {
  const version = req.query.version;
  if (!version) {
    return res.status(400).send('Version is required');
  }

  const dockerComposeSourcePath = path.join(sourcePath, `docker-compose-${version}.yml`);
  if (!fs.existsSync(dockerComposeSourcePath)) {
    return res.status(400).send(`Invalid version: docker-compose file for version ${version} was not found`);
  }

  try {
    await stopContainers();
    await overwriteComposeFile(dockerComposeSourcePath, dockerComposeFilePath);
    await startContainers();

    const success = `Upgrade to version ${version} was successfull`;
    console.log(success);
    res.send(success);
  } catch (err) {
    console.error(err);
    res.status(500).send(JSON.stringify(err));
  }
});

startUp();
app.listen(5100);
console.log('listening on port 5100');
