const { Duplex } = require('readable-stream')
const { inherits } = require('util')
const { PromisifiedQueue } = require('./lib/PromisifiedQueue')

// Borrowed from through and through2 combined and made pipe-able
// while respecting flowing, non-flowing mode readers
// https://github.com/dominictarr/through
// https://github.com/rvagg/through2
function LazyThrough(options) {
  const _self = this
  if (!(_self instanceof LazyThrough)) return new LazyThrough(options)

  Duplex.call(_self, options)

  // Data will be accumulated and then read either in
  // flowing or paused mode as requested
  // Achieved by using Promises that allow coordination between
  // writer, reader
  _self.__data = PromisifiedQueue()

  // Some libraries depend on this event to be raised
  // hence whenever there is no more data or an error
  // we abort through close rightaway
  // _self.on('finish', _self.emit.bind(_self, 'close')) // stream.Writable
  // https://nodejs.org/api/stream.html#stream_event_close_1
  _self.on('end', _self.emit.bind(_self, 'close')) // stream.Readable
  // https://nodejs.org/api/stream.html#stream_event_error_1
  _self.on('error', _self.emit.bind(_self, 'close'))
}

inherits(LazyThrough, Duplex)

LazyThrough.obj = function (options) {
  options = options || {}

  // If set to false, then the stream will automatically end the writable side when the readable side ends.
  options.allowHalfOpen = true
  // Sets objectMode for readable side of the stream.
  options.readableObjectMode = true
  // Sets objectMode for writable side of the stream.
  options.writableObjectMode = true
  // The amount of data potentially buffered depends on the highWaterMark option passed into the stream's constructor.
  // For normal streams, the highWaterMark option specifies a total number of bytes. For streams operating in object mode, the highWaterMark specifies a total number of objects.
  // Sets highWaterMark for the readable side of the stream.
  options.readableHighWaterMark = 16
  // Sets highWaterMark for the writable side of the stream.
  options.writableHighWaterMark = 16

  return new LazyThrough(options)
}

// https://nodejs.org/api/stream.html#stream_api_for_stream_implementers
// https://nodejs.org/api/stream.html#stream_implementing_a_readable_stream
// https://nodejs.org/api/stream.html#stream_readable_read_size_1
LazyThrough.prototype._read = function (size) {
  const _self = this
  const done = null

  // Consume one entry in data (array)
  // wait if needed and then push it for reading when available
  _self.__data.read()
    .await.then((chunk) => {
      if (chunk === done) return _self.push(done)
      // https://nodejs.org/api/stream.html#stream_readable_push_chunk_encoding
      if (!_self.push(chunk)) return _self.push(done)
    })
}

// https://nodejs.org/api/stream.html#stream_api_for_stream_implementers
// https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback_1
LazyThrough.prototype._write = function (data, encoding, callback) {
  const _self = this
  const chunks = [].concat(data)

  chunks.forEach(chunk => _self.__data.write().resolve(chunk))
  callback()
}

// https://nodejs.org/api/stream.html#stream_api_for_stream_implementers
// https://nodejs.org/api/stream.html#stream_writable_writev_chunks_callback
LazyThrough.prototype._writev = function (datas, callback) {
  const _self = this

  datas.forEach(data => {
    const chunks = [].concat(data)
    chunks.forEach(chunk => _self.__data.write().resolve(chunk))
  })

  callback()
}

// https://nodejs.org/api/stream.html#stream_api_for_stream_implementers
// https://nodejs.org/api/stream.html#stream_event_finish
// https://nodejs.org/api/stream.html#stream_writable_final_callback
LazyThrough.prototype._final = function (callback) {
  const _self = this
  const done = null

  // Signal the final value
  _self.__data.write().resolve(done)
  callback()
}

module.exports = exports = LazyThrough
