var express = require('express')
var cors = require('cors')
var JSONStream = require('JSONStream')
var through = require('through')

// Buffer returned when String inserted
// https://github.com/Level/levelup/issues/527
// Use level which conveniently bundles levelup+leveldown+encoding-down
var level = require('level')

// https://github.com/Level/levelup#what-happened-to-dbcreatewritestream
var levelwritestream = require('level-writestream');

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

  return opts
}

module.exports = function (db, meta) {
  if (typeof db == 'string') db = levelwritestream(level(db))

  var app = express()
  // Enable All CORS Requests
  app.use(cors())

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
    var chunks = []
    req.on('data', function (chunk) {
      chunks.push(chunk)
    })
    req.on('end', function () {
      var body = chunks.join('')
      if (req.query.encoding == 'json' || req.query.valueEncoding == 'json') {
        body = JSON.parse(body)
      }

      db.put(req.params['key'], body, req.query, function (err) {
        if (err) return next(err)
        res.end()
      })
    })
  })

  app.delete('/data/:key', function (req, res, next) {
    db.del(req.params['key'], req.query, function (err) {
      if (err) return next(err)
      res.end()
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

  app.put('/data', function (req, res) {
    var ws = db.createWriteStream(req.query)
    ws.on('close', res.end.bind(res))

    req
      .pipe(JSONStream.parse())
      .pipe(through(function (data) {
        Array.isArray(data) ?
          data.forEach(this.emit.bind(this, 'data')) :
          this.emit('data', data)
      }))
      .pipe(ws)
  })

  app.post('/data', function (req, res, next) {
    var ops = []

    req
      .pipe(JSONStream.parse())
      .pipe(through(function (data) {
        Array.isArray(data) ?
          data.forEach(function (d) { ops.push(d) }) :
          ops.push(data)
      }))
      .on('end', function () {
        db.batch(ops, req.query, function (err) {
          if (err) return next(err)
          res.end()
        })
      })
  })

  app.db = db
  app.meta = meta

  return app
}
