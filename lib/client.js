var JSONStream = require('JSONStream')
var through = require('through')
var StreamToArray = require('stream-to-array')
var StreamFromPromise = require('../utils/StreamFromPromise')
var duplex = require('duplexer')
var request = require('request')

module.exports = db

function db(addr) {
  if (!(this instanceof db)) return new db(addr)
  if (!addr.match(/http/)) addr = 'http://' + addr
  if (addr[addr.length - 1] != '/') addr += '/'

  this.addr = addr
  this.request = request
}

function getOpts(opts, cb) {
  return typeof opts != 'function' ?
    opts : {}
}

function getCallback(opts, cb) {
  if (cb) return cb
  if (typeof opts == 'function') return opts
  return function () { /* noop */ }
}

db.prototype.open = function (opts, cb) {
  cb = getCallback(opts, cb)
  cb()
}

db.prototype.close = function (options, callback) {
  cb = getCallback(opts, cb)
  cb()
}

db.prototype.put = function (key, value, opts, cb) {
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
    body: value
  }, function (err, res) {
    cb(err)
  })
}

db.prototype.get = function (key, opts, cb) {
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

db.prototype.del = function (key, opts, cb) {
  cb = getCallback(opts, cb)
  opts = getOpts(opts)

  this.request.del(this.addr + 'data/' + key, function (err, res, body) {
    cb(err, body)
  })
}

db.prototype.batch = function (ops, opts, cb) {
  cb = getCallback(opts, cb)
  opts = getOpts(opts)

  this.request.post({
    uri: this.addr + 'data',
    json: ops
  }, cb)
}

db.prototype.approximateSize = function (from, to, cb) {
  this.request(this.addr + 'approximateSize/' + from + '..' + to, function (err, res, body) {
    if (err) return cb(err)
    if (res.statusCode != 200) return cb(body)
    if (cb) cb(null, Number(body))
  })
}

db.prototype.createWriteStream = function (opts) {
  var parser = JSONStream.stringify()
  var req = this.request.put({
    uri: this.addr + 'data',
    qs: opts || {}
  })
  parser.pipe(req)
  return duplex(parser, req)
}

db.prototype.createReadStream = function (opts) {
  return StreamFromPromise.obj(
    StreamToArray(
      this.request({
        uri: this.addr + 'data',
        qs: opts || {}
      })
      .pipe(JSONStream.parse())
      .pipe(through(function (arr) {
        arr.forEach(this.emit.bind(this, 'data'))
      }))
    )
  )
}

db.prototype.createKeyStream = function (opts) {
  if (!opts) opts = {}
  opts.keys = true
  opts.values = false
  return this.createReadStream(opts)
}

db.prototype.createValueStream = function (opts) {
  if (!opts) opts = {}
  opts.keys = false
  opts.values = true
  return this.createReadStream(opts)
}
