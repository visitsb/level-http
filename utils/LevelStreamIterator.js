const { inherits } = require('util')
const { AbstractIterator } = require('abstract-leveldown')
const { PromisifiedQueue } = require('./lib/PromisifiedQueue')

function LevelStreamIterator(opts, db) {
  const _self = this
  if (!(_self instanceof LevelStreamIterator)) return new LevelStreamIterator(opts, db)

  AbstractIterator.call(_self, db)

  // whether to return the key of each entry.
  // If set to false, calls to iterator.next(callback) will yield keys with a value of undefined.
  _self.keys = opts.keys || true
  // whether to return the value of each entry.
  // If set to false, calls to iterator.next(callback) will yield values with a value of undefined.
  _self.values = opts.values || true

  // Always fetch keys because we are going to handle them after fetching them
  opts.keys = true
  opts.values = true

  // https://github.com/Level/abstract-leveldown#dbiteratoroptions
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

  // Ready to get a stream now
  _self.stream = db.createReadStream(opts)

  // Stream fills our internal data queue
  _self.data = PromisifiedQueue()
  _self.stream.on('readable', () => _self.data.write(_self.stream.read()))
  _self.stream.on('end', () => _self.data.write(null))
}

inherits(LevelStreamIterator, AbstractIterator)

// Advance the iterator and yield the entry at that key.
// If an error occurs, the callback function will be called with an Error.
LevelStreamIterator.prototype._next = function (cb) {
  const _self = this

  _self.data
    .read((data) => {
      // If the iterator has reached its end, both key and value will be undefined
      if (data === null) return cb(null, undefined, undefined)

      // The type of key and value depends on the options passed to db.iterator().
      data.key = _self.keys ? data.key : undefined
      data.value = _self.values ? data.value : undefined

      // Otherwise, the callback receives null, a key and a value.
      return cb(null, data.key, data.value)
    })
    .failed((err) => _self.end(cb.bind(_self, err)))
}

LevelStreamIterator.prototype._end = (cb) => cb()

module.exports = exports = LevelStreamIterator
