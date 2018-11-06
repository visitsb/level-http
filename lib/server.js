const express = require('express')
const passport = require('passport')
const { BasicStrategy } = require('passport-http')
const bodyParser = require('body-parser')
const multer = require('multer')
const cors = require('cors')
const JSONStream = require('JSONStream')
const debug = require('debug')('multilevel2-http/server')

// Buffer returned when String inserted
// https://github.com/Level/levelup/issues/527
// Use level which conveniently bundles levelup+leveldown+encoding-down
const level = require('level')

// https://github.com/Level/levelup#what-happened-to-dbcreatewritestream
const levelwritestream = require('level-writestream')

// https://stackoverflow.com/a/23243588
// How to find out if controller should return JSON using wantsJSON
// https://github.com/balderdashy/sails/blob/adf3babe1d1d2f7313f7b42c94d8aa05b1460c82/lib/hooks/request/qualifiers.js#L24
const _mixinReqQualifiers = function (req, res, next) {
  // Only apply HTTP-focused middleware if it makes sense
  // (i.e. if this is an HTTP request)
  if (req.protocol === 'http' || req.protocol === 'https') {
    let accept = req.get('Accept') || ''

    // Flag indicating whether HTML was explicitly mentioned in the Accepts header
    req.explicitlyAcceptsHTML = (accept.indexOf('html') !== -1)

    // Flag indicating whether a request would like to receive a JSON response
    //
    // This qualification is determined based on a handful of heuristics, including:
    // • if this looks like an AJAX request
    // • if this is a virtual request from a socket
    // • if this request DOESN'T explicitly want HTML
    // • if this request has a "json" content-type AND ALSO has its "Accept" header set
    // • if this request has the option "wantsJSON" set
    req.wantsJSON = req.xhr
    req.wantsJSON = req.wantsJSON || req.isSocket
    req.wantsJSON = req.wantsJSON || !req.explicitlyAcceptsHTML
    req.wantsJSON = req.wantsJSON || (req.is('json') && req.get('Accept'))
    req.wantsJSON = req.wantsJSON || req.options.wantsJSON
  }

  next()
}

const _mixinDebug = function (req, res, next) {
  debug(`${req.method} ${req.protocol}://${req.hostname}${req.originalUrl} called from ${req.ip}`)
  next()
}

function getOpts(opts) {
  if (opts.limit) opts.limit = Number(opts.limit)

  // https://github.com/level/levelup#dbcreatereadstreamoptions
  // start: instead use gte
  // end: instead use lte
  if (opts.start) {
    opts.gte = String(opts.start)
    delete opts.start
  }

  if (opts.end) {
    opts.lte = String(opts.end)
    delete opts.end
  }

  // Conversions to real types for specific keys
  ['limit', 'highWaterMark', 'reverse', 'keys', 'values', 'fillCache'].forEach((key, index) => {
    if (opts[key]) opts[key] = JSON.parse(opts[key])
  })

  return opts
}

module.exports = function (db, opts = {}, meta = {}) {
  if (typeof db == 'string') db = levelwritestream(level(db, opts))

  const app = express()

  // req.body parsing (mightneed CSRF handling at some point)
  // https://fosterelli.co/dangerous-use-of-express-body-parser.html
  app.use(bodyParser.text()) // support text encoded bodies
  app.use(bodyParser.json()) // support json encoded bodies
  app.use(bodyParser.urlencoded({ extended: true })) // support encoded bodies
  app.use(multer().none()) // handle a text-only multipart form

  app.use(passport.initialize())

  // Enable All CORS Requests
  // https://github.com/expressjs/cors#configuration-options
  app.use(cors())
  app.use(_mixinReqQualifiers)
  app.use(_mixinDebug)

  let authUsername = opts.username || (process.env.USER || 'admin')
  let authPassword = opts.password || (process.env.PASS || 'test')

  debug(`Running server as username - ${authUsername}`)

  /*
   * Passport setup
   */
  passport.use(new BasicStrategy(
    function (username, password, done) {
      debug(`Authenticating username - ${username}`)
      if (username !== authUsername) return done(null, false)
      if (password !== authPassword) return done(null, false)
      debug(`Successfully authenticated username - ${username}`)
      return done(null, { username })
    }
  ))

  /*
   * Authentication
   */
  app.post('/login', passport.authenticate('basic', { session: false }), function (req, res) {
    // We don't use sessions either through url or cookies.
    // Instead Basic Authentication in our current implementation *always* requires username, password to be passed
    // Thus, recommendation is to secure multilevel2 over https
    // TODO: Enable Digest Authentication
    return res.send()
  })

  app.post('/logout', passport.authenticate('basic', { session: false }), function (req, res) {
    // Nothing really happens on logout
    // req.logout()
    return res.send()
  })

  // Any routes declared before below all will get first dibs at handling the incoming requests
  app.all('*', passport.authenticate('basic', { session: false }))

  /*
   * API
   */
  app.get('/', function (req, res) {
    res.redirect('meta')
  })

  app.get('/meta', function (req, res) {
    res.json(meta)
  })

  app.get('/data/:key', function (req, res, next) {
    db.get(req.params['key'], req.query, function (err, value) {
      if (err && err.name == 'NotFoundError') res.status(404)
      if (err) return next(err)
      res.send((typeof value === 'number' ? '' + value : value))
    })
  })

  app.post('/data/:key', function (req, res, next) {
    var body = req.body

    db.put(req.params['key'], body, req.query, function (err) {
      if (err) return next(err)

      if (req.wantsJSON) return res.json('ok')
      res.send('ok')
    })
  })

  app.put('/data', function (req, res) {
    var ws = db.createWriteStream(req.query)
    ws.on('close', req.wantsJSON ? res.json.bind(res, 'ok') : res.end.bind(res, 'ok'))
    let chunks = [].concat(req.body)
    chunks.forEach(chunk => ws.write(chunk))
    ws.end()
  })

  app.post('/data', function (req, res, next) {
    var ops = [].concat(req.body)

    db.batch(ops, req.query, function (err) {
      if (err) return next(err)

      if (req.wantsJSON) return res.json('ok')
      res.send('ok')
    })
  })

  app.delete('/data/:key', function (req, res, next) {
    db.del(req.params['key'], req.query, function (err) {
      if (err) return next(err)

      if (req.wantsJSON) return res.json('ok')
      res.send('ok')
    })
  })

  app.get('/approximateSize/:from..:to', function (req, res, next) {
    // https://github.com/Level/abstract-leveldown/issues/8
    //deprecated db.approximateSize() in LevelUP in favour of db.db.approximateSize()
    db.db.approximateSize(req.params['from'], req.params['to'], function (err, size) {
      if (err) return next(err)
      res.end(size + '')
    })
  })

  app.get('/data', function (req, res) {
    var opts = getOpts(req.query)
    res.type('json')
    db.createReadStream(opts)
      .pipe(JSONStream.stringify())
      .pipe(res)
  })

  app.get('/range/:from..:to', function (req, res) {
    var opts = getOpts(req.query)
    opts.gte = req.params['from']
    opts.lte = req.params['to']

    res.type('json')
    db.createReadStream(opts)
      .pipe(JSONStream.stringify())
      .pipe(res)
  })

  app.get('/keys/:from..:to', function (req, res) {
    var opts = getOpts(req.query)
    opts.gte = req.params['from']
    opts.lte = req.params['to']

    res.type('json')
    db.keyStream(opts)
      .pipe(JSONStream.stringify())
      .pipe(res)
  })

  app.get('/keys', function (req, res) {
    var opts = getOpts(req.query)

    res.type('json')
    db.createKeyStream(opts)
      .pipe(JSONStream.stringify())
      .pipe(res)
  })

  app.get('/values/:from..:to', function (req, res) {
    var opts = getOpts(req.query)
    opts.gte = req.params['from']
    opts.lte = req.params['to']

    res.type('json')
    db.createValueStream(opts)
      .pipe(JSONStream.stringify())
      .pipe(res)
  })

  app.get('/values', function (req, res) {
    var opts = getOpts(req.query)

    res.type('json')
    db.createValueStream(opts)
      .pipe(JSONStream.stringify())
      .pipe(res)
  })

  app.db = db
  app.meta = meta

  return app
}
