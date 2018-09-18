var multilevelhttp2 = require('..')
var server = multilevelhttp2.server(__dirname + '/client.test.db')
var JSONStream = require('JSONStream')
var should = require('should')
var fs = require('fs.extra')

server.listen(3001)

beforeEach(function (done) {
  server.db.close().then(() => {
    fs.rmrf(__dirname + '/client.test.db', function () {
      server.db.open().then(() => done())
    })
  })
})

var db = multilevelhttp2.client('http://localhost:3001/')

describe('client', function () {
  describe('db#put(key, value)', function () {
    it('should store text', function (done) {
      db.put('foo', 'bar', function (err) {
        if (err) return done(err)

        db.get('foo', function (err, value) {
          if (err) return done(err)

          should.exist(value)
          value.should.equal('bar')
          done()
        })
      })
    })

    it('should store json', function (done) {
      db.put('foo', { some: 'json' }, { encoding: 'json' }, function (err) {
        if (err) return done(err)
        db.get('foo', { encoding: 'json' }, function (err, value) {
          if (err) return done(err)
          value.should.eql({ some: 'json' })
          done()
        })
      })
    })

    it('should store binary', function (done) {
      db.put('foo', new Buffer([0, 1]), { encoding: 'binary' }, function (err) {
        if (err) return done(err)
        db.get('foo', { encoding: 'binary' }, function (err, value) {
          if (err) return done(err)
          value.toString().should.equal("\u0000\u0001")
          done()
        })
      })
    })
  })

  describe('db#get(key)', function () {
    it('should get', function (done) {
      db.put('foo', 'bar', function (err) {
        if (err) return done(err)

        db.get('foo', function (err, value) {
          if (err) return done(err)

          should.exist(value)
          value.should.equal('bar')
          done()
        })
      })
    })
  })

  describe('db#del(key)', function () {
    it('should delete', function (done) {
      db.put('foo', 'bar', function (err) {
        if (err) return done(err)

        db.del('foo', function (err) {
          if (err) return done(err)

          db.get('foo', function (err, value) {
            should.exist(err)
            should.not.exist(value)
            done()
          })
        })
      })
    })
  })

  describe('db#batch(ops, cb)', function () {
    it('should create', function (done) {
      db.batch([
        { type: 'put', key: 'key', value: 'value' }
      ], function (err) {
        if (err) return done(err)

        db.get('key', function (err, value) {
          if (err) return done(err)

          should.exist(value)
          value.should.equal('value')
          done()
        })
      })
    })
  })

  describe('db#approximateSize(from, to, cb)', function () {
    it('should get a size', function (done) {
      db.approximateSize('a', 'z', function (err, size) {
        if (err) return done(err)
        should.exist(size)
        size.should.be.Number
        done()
      })
    })
  })

  describe('db#readStream()', function () {
    it('should read', function (done) {
      db.put('foo', 'bar', function (err) {
        if (err) return done(err)
        var count = 0

        db.readStream()
          .on('data', function (data) {
            count++
            should.exist(data)
            data.should.eql({ key: 'foo', value: 'bar' })
          })
          .on('error', done)
          .on('end', function (data) {
            count.should.equal(1)
            done()
          })
      })
    })
  })

  describe('db#writeStream()', function () {
    it('should save', function (done) {
      var ws = db.writeStream()

      ws.on('end', function () {
        db.get('key', function (err, value) {
          if (err) return done(err)
          should.exist(value)
          value.should.equal('value')
          done()
        })
      })

      ws.write({ key: 'key', value: 'value' })
      ws.end()
    })
  })
})
