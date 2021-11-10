const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const version = require('../package.json').version;

const NAME = 'self-upgrading-container';
const composePath = path.resolve('/docker-compose');

const composeCommand = (args, command='docker-compose') => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, { cwd: composePath, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    childProcess.unref();
    childProcess.on('error', (err) => reject(err));
    let err = '';
    let output = '';

    childProcess.stdout.on('data', (chunk) => {
      chunk = chunk.toString();
      console.log(chunk);
      output += `${chunk}\n`;
    });
    childProcess.stderr.on('data', (chunk) => {
      chunk = chunk.toString();
      console.error(chunk);
      err += chunk;
    });

    childProcess.on('exit', (exitCode) => {
      exitCode ? reject(err) : resolve(output);
    });
  });
}

const scaleUp = () => {
  return composeCommand(['up', '-d', '--scale', `${NAME}=2`, '--no-recreate', NAME]);
};

const cleanupAfterUpgrade = async () => {
  try {
    const containerIds = await getCurrentContainerIds();
    const hostname = await composeCommand([], 'hostname');
    if (containerIds.length === 1) {
      return;
    }

    console.log('Cleaning up old containers after an upgrade');
    await killOldContainers(containerIds, hostname);
  } catch (err) {
    console.error('Error while cleaning up old containers', err);
  }
};

const getCurrentContainerIds = async () => {
  const output = await composeCommand(['ps', '-q']);
  return output.split('\n').map((id) => id.trim()).filter(id => id);
}

const startNewContainer = async () => {
  await composeCommand(['pull']);
  await scaleUp();
};

const killOldContainers = async (containerIds, hostname) => {
  const containerToKeep = containerIds.find(id => id.trim().startsWith(hostname.trim()));
  if (!containerToKeep) {
    throw new Error('Cant find container to keep');
  }
  const containersToRemove = containerIds.filter(id => id !== containerToKeep);
  await composeCommand(['stop', ...containersToRemove], 'docker');
  await composeCommand(['rm', ...containersToRemove], 'docker');
};

const app = express();
app.all('*', (req, res, next) => {
  console.log('REQUEST', req.method, req.path, req.query);
  next();
});

app.all('/', (req, res) => {
  res.send(`${NAME} version ${version}`);
});

app.all('/upgrade', async (req, res) => {
  try {
    await startNewContainer();
    const success = `${NAME} upgrade was successful`;
    console.log(success);
    res.send(success);
  } catch (err) {
    console.error(err);
    res.status(500).send(JSON.stringify(err));
  }
});

try {
  cleanupAfterUpgrade();
} catch (err) {
  console.error(err);
}

console.log('listening on port 5800');
app.listen(5800);
