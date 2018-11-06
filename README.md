# multilevel2-http

_Access a leveldb instance from multiple processes over HTTP under secure credentials._

A limitation of LevelDB is that only one process is allowed access to the underlying data. **multilevel2-http** exports a LevelDB instance over http. Furthermore, it also allows your LevelDB instance to be exposed with credentials to allow operations under logged in user.

Credits go to the [original project](https://github.com/juliangruber/multimultilevel2-http). The project is updated to work with latest version of [Level](https://github.com/Level/level) and [NodeJS](https://nodejs.org/en/) with a few minor tweaks.

**Note**: Project was renamed to publish under npm registry with an easy to remember name.

[![Build Status](https://travis-ci.org/visitsb/multilevel2-http.png)](https://travis-ci.org/visitsb/multilevel2-http)

## Installation

```bash
npm install multilevel2-http
```

## API

Server:

```js
var multilevel2 = require('multilevel2-http/lib/server')
// db = levelup instance or path to db
// opts.username = (Optional) Username who will be allowed to login to this server using multilevel2 client. Username will default to user as returned by process.env.USER
// opts.password = (Optional) Password for user who will be allowed to login to this server using multilevel2 client. Password will default to process.env.PASS if specified or if not available it will be 'test'
var server = multilevel2(db, opts)
server.listen(3000)
```

Client:

```js
// On node client
var multilevel2 = require('multilevel2-http/lib/client')

// Use opts to pass options to underlying multilevel2 server
// opts.username = Specify username to login to multilevel2 server
// opts.password = Specify password to login to multilevel2 server
var db = multilevel2('http://localhost:3000/', [opts])
// opts can be also specified with username, password when opening the client to connect to multilevel2 server
db.open([opts])

// now you have the complete levelUP api!
// ...except for events - for those consider level and level-live-stream

// Separating database into sections - or sublevels works too
// Use opts to specify keyEncoding, valueEncoding as appropriate for your leveldb
var sub = require('subleveldown')
const test1 = sub(db('http://127.0.0.1:9000/'), opts, 'test1')
test1.open([opts])

// -or-
var sub = require('level-sublevel')
const test1 = sub(db('http://127.0.0.1:9000/'), opts).sublevel('test1')
test1.open([opts])
```

<!--
Due to [specifics in browserifying](https://github.com/browserify/browserify/issues/332) the ubiquitous [request](https://github.com/request/request#streaming) module for browsers, while [browser-request](https://github.com/iriscouch/browser-request) works it doesn't support Stream APIs correctly. Substituting [hyperquest](https://github.com/substack/hyperquest) for Stream specific methods works, hence browser side client is kept separate from node side client.
-->

## CLI

```bash
$ sudo npm install -g multilevel2-http
$ multilevel2-http -h 127.0.0.1 -P 3000 -u user -p pass path/to.db
$
$ # Alternatively, enable debug to get a simple access log on your console
$ # Can help understand what sort of queries are being sent to your leveldb
$ DEBUG=multilevel2-http/server multilevel2-http -h 127.0.0.1 -P 3000 -u user -p pass path/to.db
```

## HTTP API

### Params

Use get-params to pass options to LevelDB, like `?encoding=json`

### GET /meta

Get meta information about the DB.

```js
// GET /meta
{
  "compression" : false,
  "cacheSize" : 8 * 1024 * 1024,
  "encoding" : 'utf8',
  "keyEncoding" : 'utf8',
  "valueEncoding" : 'utf8',
  "path" : path
}
```

### GET /data/:key

Get the value stored at `:key`.

```js
// GET /data/foo
bar
```

### POST /data/:key

Store data at `:key`.

```js
// POST /data/foo bar
'ok'
```

### DEL /data/:key

Delete data stored at `:key`.

```js
// DEL /data/foo
'ok'
```

### PUT /data

Store many values batched.

```js
/* PUT /data [
  { key : 'bar', value : 'baz' },
  { key : 'foo', value : 'bar' }
] */
```

### POST /data

Do many operations batched.

```js
/* PUT /data [
  { type : 'put', key : 'bar', value : 'baz' },
  { type : 'del', key : 'foo' }
] */
```

### GET /approximateSize/:from..:to

Get an approximation of disk space used to store the data in the given range.

```js
// GET /approximateSize/a..z
123
```

### GET /data

Get all the data.

```js
// GET /data/12
;[
  { key: 'bar', value: 'baz' },
  { key: 'foo', value: 'bar' }
  /* ... */
]
```

### GET /range/:from..:to

Get all data in the given range.

```js
// GET /range/a..c
;[{ key: 'bar', value: 'baz' }]
```

### GET /keys

Get all the keys.

```js
// GET /keys
;['bar', 'foo']
```

### GET /keys/:from..:to

Get all the keys in the given range.

```js
// GET /keys/a..c
;['bar']
```

### GET /values

Get all the values.

```js
// GET /values
;['baz', 'bar']
```

### GET /values/:from..:to

Get all the values in the given range.

```js
// GET /values/a..c
;['baz']
```

## Server API

```js
// server
var level = require('multilevel2-http/lib/server')('my.db')
level.listen(3000)
```

### level.server(path|db, meta)

### server#listen(port)

Start serving on the given port.

### server#{db,meta}

The stored db and meta data exposed.

## Headers

By default, all requests to server are [CORS](https://github.com/expressjs/cors) enabled to '\*'.

```
Access-Control-Allow-Origin: *
```

## TODO

Most likely, the following would be upcoming in future versions-

- [ ] HTTPs
- [ ] CORS oriented security
- [x] Authentication using [Passport](https://github.com/jaredhanson/passport) with [Basic](https://github.com/jaredhanson/passport-http) strategy without using sessions to avoid cookies. Username, password passed for each API hence recommended to always run behind HTTPs
- [ ] Events relayed to clients
- [x] ~~[sublevel](https://github.com/dominictarr/level-sublevel) support~~. Supports [subleveldown](https://github.com/Level/subleveldown) and [level-sublevel](https://github.com/dominictarr/level-sublevel)
- [x] ~~Client side [iterators](https://github.com/level/abstract-leveldown#iterator)~~

## License

(MIT)

Copyright (c) 2018 Shantibhushan Naik &lt;visitsb@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
