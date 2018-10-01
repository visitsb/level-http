  // Standard Promise does not provide a way to invoke resolve, reject methods externally
  // ActionablePromise simply wraps Promise but exposes resolve, reject on instance
  function ActionablePromise() {
    var _self = this
    if (!(_self instanceof ActionablePromise)) return new ActionablePromise()

    var opts = {}
    var promise = new Promise((resolve, reject) => { opts = { resolve, reject } })

    // Expose captured methods so that these are invokable outside the Promise
    _self.resolve = opts.resolve.bind(promise)
    _self.then = promise.then.bind(promise)
    _self.reject = opts.reject.bind(promise)
    _self.catch = promise.catch.bind(promise)

    // API
    // Use ActionablePromise.then() to wait for promise to resolve (or catch if error) - Consumers use this
    // From outside, ActionablePromise.resolve() (or reject() if cannot resolve) to value (or error) to consume - Producers use this
    return _self
  }

  // PromisifiedQueue allows producers, consumers to coordinate write, read without using events
  // but instead using Promises (ActionablePromise really)
  // Caveat: Only one consumer is handled for currently intended usage; expanding it to a additional usages
  //         will require some thought but it is possible on the same lines since same Promise can be listened
  //         by multiple consumers
  function PromisifiedQueue() {
    var _self = this
    if (!(_self instanceof PromisifiedQueue)) return new PromisifiedQueue()

    // Initialize with one entry ready to be consumed
    // Same instance of ActionablePromise links write, read sides
    var queue = { write: [], read: [] }

    function prepare() { // Keep next data item prepared
      const later = ActionablePromise()
      queue.write.push(later)
      queue.read.push(later)
    }

    function write(value, done = false) {
      var promise = queue.write.shift()
      if (!done && (0 === queue.write.length)) prepare()
      return promise.resolve(value)
    }

    function fail(err, done = false) {
      var promise = queue.write.shift()
      if (!done && (0 === queue.write.length)) prepare()
      return promise.reject(err)
    }

    function read(cb) {
      var promise = queue.read.shift()
      promise.failed = promise.catch // Provide chainable method for API
      process.nextTick(promise.then.bind(promise, cb))
      return promise
    }

    function failed(cb) {
      var promise = queue.read.shift()
      promise.read = promise.then // Provide chainable method for API
      process.nextTick(promise.catch.bind(promise, cb))
      return promise
    }

    // Initialize
    prepare()

    // API
    // `write` will `resolve` an ActionablePromise with value that is ready to read
    // `fail` will `reject` an ActionablePromise with error that is ready to read
    // `read` will `then` return value that was written (should be chained to .failed() if err is handled)
    // `failed` will `catch` error that was written (should be chained to .read() if value is read)
    return { write, read, fail, failed }
  }

  module.exports = exports = { ActionablePromise, PromisifiedQueue }
