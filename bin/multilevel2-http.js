#!/usr/bin/env node

var multilevel2 = require('../lib/server')
var optimist = require('optimist')

var argv = optimist
  .usage('$0 [OPTIONS] path-to-db')

  .describe('host', 'The host IP address to use')
  .default('host', '127.0.0.1')
  .alias('host', 'h')

  .describe('port', 'The port to listen on')
  .default('port', 3000)
  .alias('port', 'P')

  .describe('username', 'The user who will be allowed to login to this server')
  .default('username', process.env.USER)
  .alias('username', 'u')

  .describe('password', 'The password for user will be allowed to login to this server')
  .default('password', 'test')
  .alias('password', 'p')

  .describe('help', 'Print usage instructions')
  .alias('?', 'help')

  .argv


if (argv.help || argv._.length != 1) return optimist.showHelp()

// DEBUG=multilevel2-http/server will enable simplistic logging on your console
multilevel2(argv._[0], { username: argv.username, password: argv.password })
  .listen(argv.port, argv.host, function () {
    console.log(`multilevel2-http listening on ${argv.host}:${argv.port}`)
  })
