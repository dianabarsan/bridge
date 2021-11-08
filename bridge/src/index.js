const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve('source');
const destinationPath = path.resolve('destination');
const dockerComposeFilePath = path.join(destinationPath, 'docker-compose.yml');

const composeCommand = (options, command='docker-compose') => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, options, { cwd: destinationPath });
    childProcess.on('error', (err) => reject(err));

    const result = {
      exitCode: null,
      err: '',
      out: ''
    };

    childProcess.stdout.on('data', (chunk) => result.out += chunk.toString());
    childProcess.stderr.on('data', (chunk) => result.err += chunk.toString());

    childProcess.on('exit', (exitCode) => {
      result.exitCode = exitCode;
      console.log(result);
      exitCode ? reject(result) : resolve(result);
    });
  });
};

const stopContainers = async () => {
  await composeCommand(['down', '--remove-orphans']);
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

    res.send('Upgrade successful');
  } catch (err) {
    console.error(err);
    res.status(500).send(JSON.stringify(err));
  }
});

startUp();
app.listen(6200);
console.log('listening on port 6200');
