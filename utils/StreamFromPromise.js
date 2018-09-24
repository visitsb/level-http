'use strict'

var Readable = require('readable-stream').Readable
var inherits = require('util').inherits

// Borrowed from stream-from-promise except that it doesn't
// just resolve but instead acts as a wrapper on result received in resolve
// This allows array elements to be queued one by one for consuming streams
// in either flowing or paused mode as needed.
//
// In other words, this is more like stream-from-promise-values ;-)
// https://github.com/schnittstabil/stream-from-promise
function StreamFromPromise(promise, options) {
  const _self = this

  if (!(_self instanceof StreamFromPromise)) {
    return new StreamFromPromise(promise, options)
  }

  Readable.call(_self, options)

  _self.__promise = promise
  _self.__resolvingPromise = false

  // Data will be accumulated and then read either in
  // flowing or paused mode as requested
  _self.__data = []

  // Some libraries depend on this event to be raised
  // hence whenever there is no more data or an error
  // we abort through close rightaway
  // https://nodejs.org/api/stream.html#stream_event_close_1
  _self.on('end', _self.emit.bind(_self, 'close'))
  // https://nodejs.org/api/stream.html#stream_event_error_1
  _self.on('error', _self.emit.bind(_self, 'close'))
}

inherits(StreamFromPromise, Readable)

StreamFromPromise.obj = function (promise, options) {
  options = options || {}
  options.objectMode = true
  return new StreamFromPromise(promise, options)
}

// https://nodejs.org/api/stream.html#stream_api_for_stream_implementers
// https://nodejs.org/api/stream.html#stream_implementing_a_readable_stream
// https://nodejs.org/api/stream.html#stream_readable_read_size_1
StreamFromPromise.prototype._read = function () {
  var _self = this

  if (_self.__resolvingPromise) return _self._provide()

  // Resolve promise and get the data
  _self.__resolvingPromise = true
  _self.__promise
    .then((arr) => {
      _self.__data = [].concat(arr)
      _self._provide()
    })
    .catch((err) => {
      _self.emit('error', err)
      _self._done()
    })
}

StreamFromPromise.prototype._provide = function () {
  const _self = this

  if (_self.__data.length === 0) return _self._done()

  // Consume one entry in data (array) and push it for reading
  const chunk = _self.__data.shift()

  // https://nodejs.org/api/stream.html#stream_readable_push_chunk_encoding
  if (!_self.push(chunk)) return _self._done()
}

StreamFromPromise.prototype._done = function () {
  const _self = this
  _self.push(null)

  // @see 'end' event listener to notify downstream consumers
}

module.exports = StreamFromPromise
