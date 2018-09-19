# multilevel2-http

_Access a leveldb instance from multiple processes over HTTP._

A limitation of LevelDB is that only one process is allowed access to the underlying data. **multilevel2-http** exports a LevelDB instance over http.

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
var server = multilevel2(db, options)
server.listen(3000)
```

Client:

```js
// On node client
var multilevel2 = require('multilevel2-http/lib/client.node')
// On browser client
var multilevel2 = require('multilevel2-http/lib/client.browser')

var db = multilevel2('http://localhost:3000/')
// now you have the complete levelUP api!
// ...except for events - for those consider level and level-live-stream
```

## CLI

```bash
$ sudo npm install -g multilevel2-http
$ multilevel2-http -h 127.0.0.1 -p 3000 path/to.db
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
var level = require('multilevel2-http')('my.db')
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

- HTTPs
- CORS oriented security
- Authentication
- Events relayed to clients

## License

(MIT)

Copyright (c) 2018 Shantibhushan Naik &lt;visitsb@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
