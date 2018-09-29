  // Standard Promise does not provide a way to invoke resolve, reject methods externally
  // ActionablePromise simply wraps Promise but exposes resolve, reject on instance
  function ActionablePromise() {
    var _self = this
    if (!(_self instanceof ActionablePromise)) return new ActionablePromise()

    var opts = {}
    var promise = new Promise((resolve, reject) => { opts = { resolve, reject } })

    // Expose captured methods so that these are invokable outside the Promise
    _self.resolve = opts.resolve
    _self.then = promise.then.bind(promise)
    _self.reject = opts.reject
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
      var data = queue.write.shift()
      if (!done && (0 === queue.write.length)) prepare()
      return data.resolve(value)
    }

    function read(cb) {
      var data = queue.read.shift()
      return data.then(cb)
    }

    // Initialize
    prepare()

    // API
    // `write` will `resolve` an ActionablePromise with value that is ready to read
    // `read` will `then` return value that was written
    return { write, read }
  }

  module.exports = exports = { ActionablePromise, PromisifiedQueue }
