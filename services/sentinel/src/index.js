const express = require('express');
const app = express();
const { FOO } = process.env;

const version = require('../package.json').version;

app.all('/', (req, res) => res.send(`Sentinel version is ${version} and FOO=${FOO}`));
app.listen(5300);
