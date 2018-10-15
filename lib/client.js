const { inherits } = require('util')
const { AbstractLevelDOWN } = require('abstract-leveldown')
const JSONStream = require('JSONStream')
const LazyThrough = require('../utils/LazyThrough')
const LevelStreamIterator = require('../utils/LevelStreamIterator')
const duplex = require('duplexer')
const request = require('request')

function MultiLevelHttpClient(addr, opts = {}) {
  if (!(this instanceof MultiLevelHttpClient)) return new MultiLevelHttpClient(addr, opts)

  AbstractLevelDOWN.call(this, addr)

  if (!addr.match(/http/)) addr = 'http://' + addr
  if (addr[addr.length - 1] != '/') addr += '/'

  this.addr = addr
  this.opts = opts
  this.request = request.defaults({ jar: true })
}

inherits(MultiLevelHttpClient, AbstractLevelDOWN)

function getOpts(opts, cb) {
  return typeof opts != 'function' ?
    opts : {}
}

function getCallback(opts, cb) {
  if (cb) return cb
  if (typeof opts == 'function') return opts
  return function () { /* noop */ }
}

MultiLevelHttpClient.prototype._open = function (opts, callback) {
  let username = opts.username || (this.opts.username || '')
  let password = opts.password || (this.opts.password || '')

  this.request.post({
    uri: this.addr + 'login',
    // json: { username, password } // passport supports header Content-Type: application/x-www-form-urlencoded
    form: { username, password }
  }, function (err, res) {
    process.nextTick(callback.bind(res, err))
  })
}

MultiLevelHttpClient.prototype._close = function (callback) {
  this.request.post({
    uri: this.addr + 'logout'
  }, function (err, res) {
    process.nextTick(callback.bind(res, err))
  })
}

MultiLevelHttpClient.prototype._get = function (key, opts, cb) {
  cb = getCallback(opts, cb)
  opts = getOpts(opts)

  var isJSON = opts.encoding == 'json' || opts.valueEncoding == 'json'
  var isBinary = opts.encoding == 'binary' || opts.valueEncoding == 'binary'
  delete opts.encoding

  this.request(this.addr + 'data/' + key, function (err, res, body) {
    if (err) return cb(err)
    if (res.statusCode != 200) return cb(body)
    if (isJSON) body = JSON.parse(body)
    if (isBinary) body = new Buffer(body)
    cb(null, body)
  })
}

MultiLevelHttpClient.prototype._put = function (key, value, opts, cb) {
  cb = getCallback(opts, cb)
  opts = getOpts(opts)

  if (opts.encoding == 'json' || opts.valueEncoding == 'json') {
    value = JSON.stringify(value)
    delete opts.encoding
    delete opts.valueEncoding
  }

  this.request.post({
    uri: this.addr + 'data/' + key,
    qs: opts,
    body: value,
    headers: {
      'Content-Type': 'text/plain'
    }
  }, function (err, res) {
    cb(err)
  })
}

MultiLevelHttpClient.prototype._del = function (key, opts, cb) {
  cb = getCallback(opts, cb)
  opts = getOpts(opts)

  this.request.del(this.addr + 'data/' + key, function (err, res, body) {
    cb(err, body)
  })
}

MultiLevelHttpClient.prototype._batch = function (ops, opts, cb) {
  cb = getCallback(opts, cb)
  opts = getOpts(opts)

  this.request.post({
    uri: this.addr + 'data',
    json: ops
  }, cb)
}

MultiLevelHttpClient.prototype._iterator = function (opts) {
  return LevelStreamIterator(opts, /* db */ this)
}

MultiLevelHttpClient.prototype._serializeKey = function (key) {
  return key
}

MultiLevelHttpClient.prototype._serializeValue = function (value) {
  return value
}

// Not present within AbstractLevelDOWN but are needed (hence missing _ in front of them)
MultiLevelHttpClient.prototype.approximateSize = function (from, to, cb) {
  this.request(this.addr + 'approximateSize/' + from + '..' + to, function (err, res, body) {
    if (err) return cb(err)
    if (res.statusCode != 200) return cb(body)
    if (cb) cb(null, Number(body))
  })
}

MultiLevelHttpClient.prototype.writeStream = MultiLevelHttpClient.prototype.createWriteStream = function (opts) {
  var parser = JSONStream.stringify()
  var req = this.request.put({
    uri: this.addr + 'data',
    qs: opts || {},
    headers: {
      "Content-Type": "application/json"
    }
  })

  parser.pipe(req)
  return duplex(parser, req)
}

MultiLevelHttpClient.prototype.readStream = MultiLevelHttpClient.prototype.createReadStream = function (opts) {
  return this.request({
      uri: this.addr + 'data',
      qs: opts || {}
    })
    .pipe(JSONStream.parse())
    .pipe(LazyThrough.obj())
}

MultiLevelHttpClient.prototype.keyStream = MultiLevelHttpClient.prototype.createKeyStream = function (opts) {
  if (!opts) opts = {}

  opts.keys = true
  opts.values = false

  return this.createReadStream(opts)
}

MultiLevelHttpClient.prototype.valueStream = MultiLevelHttpClient.prototype.createValueStream = function (opts) {
  if (!opts) opts = {}

  opts.keys = false
  opts.values = true

  return this.createReadStream(opts)
}

module.exports = exports = MultiLevelHttpClient
