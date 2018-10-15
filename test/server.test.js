const should = require('should')
const request = require('supertest')
const fs = require('fs.extra')
const multilevel2 = require('../lib/server')

describe('http', function () {
  let app
  // Since server works on Cookie based authentication
  // this is simple approach - https://stackoverflow.com/a/38234070
  // Neither supertest.agent() nor plain superagent() worked
  let cookie

  beforeEach(function (done) {
    app = multilevel2(__dirname + '/server.test.db', { username: 'server-test', password: 'server' }, { some: 'meta' })
    request(app)
      .post('/login')
      .type('form')
      .send({ username: 'server-test' })
      .send({ password: 'server' })
      .then((res) => {
        cookie = res.header['set-cookie']
        Promise.all([
            app.db.put('foo', 'bar'),
            app.db.put('bar', 'foo')
          ])
          .then(() => done())
      })
  })

  afterEach(function (done) {
    request(app)
      .post('/logout')
      .set('Cookie', cookie)
      .type('form')
      .then((res) => {
        cookie = res.header['set-cookie']
        app.db.close()
          .then(() => fs.rmrf(__dirname + '/server.test.db', done))
      })
  })

  describe('GET /meta', function () {
    it('should send meta', function (done) {
      request(app)
        .get('/meta')
        .set('Cookie', cookie)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
          should.not.exist(err)
          should.exist(res.body)
          should.exist(res.body.some)
          res.body.some.should.equal('meta')

          done()
        })
    })
  })

  describe('GET /data/:key', function () {
    it('should get text', function (done) {
      request(app)
        .get('/data/foo')
        .set('Cookie', cookie)
        .expect('bar', done)
    })

    it('should get json', function (done) {
      app.db.put('json', { some: 'json' }, { encoding: 'json' }, function (err) {
        if (err) return done(err)
        request(app)
          .get('/data/json?encoding=json')
          .set('Cookie', cookie)
          .expect(200)
          .expect({ some: 'json' }, done)
      })
    })

    it('should respond with 404', function (done) {
      request(app)
        .get('/data/baz')
        .set('Cookie', cookie)
        .expect(404)
        .expect(/not found/, done)
    })
  })

  describe('POST /data/:key', function () {
    it('should save text', function (done) {
      request(app)
        .post('/data/foo')
        .set('Cookie', cookie)
        .type('text')
        .send('changed')
        .end(function (err) {
          if (err) return done(err)
          request(app)
            .get('/data/foo')
            .set('Cookie', cookie)
            .expect('changed')
            .end(done)
        })
    })

    it('should save json', function (done) {
      request(app)
        .post('/data/json?encoding=json')
        .set('Cookie', cookie)
        .type('json')
        .send({ some: 'json' })
        .end(function (err) {
          if (err) return done(err)
          app.db.get('json', { encoding: 'json' }, function (err, value) {
            if (err) return done(err)
            should.exist(value)
            value.should.eql({ some: 'json' })
            done()
          })
        })
    })
  })

  describe('DEL /data/:key', function () {
    it('should delete', function (done) {
      request(app)
        .del('/data/foo')
        .set('Cookie', cookie)
        .expect(200)
        .expect(JSON.stringify('ok'))
        .end(function (err) {
          request(app)
            .get('/foo')
            .set('Cookie', cookie)
            .expect(404)
            .end(done)
        })
    })
  })

  describe('GET /approximateSize/:from..:to', function () {
    it('should get a size', function (done) {
      request(app)
        .get('/approximateSize/a..z')
        .set('Cookie', cookie)
        .expect(200)
        .expect('0', done)
    })
  })

  describe('GET /data', function () {
    it('should get all', function (done) {
      request(app)
        .get('/data')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(2)
          done()
        })
    })

    it('should limit', function (done) {
      request(app)
        .get('/data?limit=1')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(1)
          done()
        })
    })
  })

  describe('GET /range/:from..:to', function () {
    it('should get data', function (done) {
      request(app)
        .get('/range/a..z')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(2)
          done()
        })
    })

    it('should limit', function (done) {
      request(app)
        .get('/range/a..z?limit=1')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(1)
          done()
        })
    })
  })

  describe('GET /values/(:from..:to)', function () {
    it('should get values', function (done) {
      request(app)
        .get('/values')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(2)
          done()
        })
    })

    it('should limit', function (done) {
      request(app)
        .get('/values?limit=1')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(1)
          done()
        })
    })

    it('should get a range', function (done) {
      request(app)
        .get('/values/0..z?limit=1')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(1)
          done()
        })
    })
  })

  describe('/keys/(:from..:to)', function () {
    it('should get keys', function (done) {
      request(app)
        .get('/keys')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(2)
          done()
        })
    })

    it('should limit', function (done) {
      request(app)
        .get('/keys?limit=1')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(1)
          done()
        })
    })

    it('should get a range', function (done) {
      request(app)
        .get('/keys/0..z?limit=1')
        .set('Cookie', cookie)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.body.should.be.an.instanceOf(Array)
          res.body.should.have.length(1)
          done()
        })
    })
  })

  describe('PUT /data', function () {
    it('should save', function (done) {
      request(app)
        .put('/data')
        .set('Cookie', cookie)
        .send({ key: 'key', value: 'value' })
        .expect(200)
        .expect(JSON.stringify('ok'))
        .end(function (err) {
          if (err) return done(err)
          request(app)
            .get('/data/key')
            .set('Cookie', cookie)
            .expect('value')
            .end(done)
        })
    })
  })

  describe('POST /data', function () {
    it('should save', function (done) {
      request(app)
        .post('/data')
        .set('Cookie', cookie)
        .send({ type: 'put', key: 'key', value: 'value' })
        .expect(200)
        .expect(JSON.stringify('ok'))
        .end(function (err) {
          if (err) return done(err)
          setTimeout(function () {
            request(app)
              .get('/data/key')
              .set('Cookie', cookie)
              .expect('value')
              .end(done)
          }, 10)
        })
    })
  })
})
