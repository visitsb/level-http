#!/usr/bin/env node

var multilevel2 = require('../lib/server')
var optimist = require('optimist')
var express = require('express')

var argv = optimist
  .usage('$0 [OPTIONS] path-to-db')

  .describe('host', 'The host IP address to use')
  .default('host', '127.0.0.1')
  .alias('host', 'h')

  .describe('port', 'The port to listen on')
  .default('port', 3000)
  .alias('port', 'p')

  .describe('help', 'Print usage instructions')
  .alias('?', 'help')

  .argv


if (argv.help || argv._.length != 1) return optimist.showHelp()

multilevel2(argv._[0]).listen(argv.port, argv.host, function () {
  console.log(`multilevel2-http listening on ${argv.host}:${argv.port}`)
})
