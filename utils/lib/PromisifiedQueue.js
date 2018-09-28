  // Standard Promise does not provide a way to invoke resolve, reject methods externally
  // ActionablePromise simply wraps Promise but exposes resolve, reject on instance
  function ActionablePromise() {
    var _self = this
    if (!(_self instanceof ActionablePromise)) return new ActionablePromise()

    var opts = {}
    _self.await = new Promise((resolve, reject) => { opts = { resolve, reject } })

    // Expose captured methods so that these are invokable outside the Promise
    _self.resolve = opts.resolve
    _self.reject = opts.reject

    // API
    // Use ActionablePromise.await.then() to wait for promise to resolve - Consumers use this
    // From outside, ActionablePromise.resolve() to resolve by passing value to consume - Producers use this
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

    function write(done = false) {
      var data = queue.write.shift()
      if (!done && (0 === queue.write.length)) prepare()
      return data
    }

    function read() {
      var data = queue.read.shift()
      return data
    }

    // Initialize
    prepare()

    // API
    // `write` will return an ActionablePromise that can be `resolve`d() with value that is ready to read
    // `read` will return an ActionablePromise on which reader can `await` and `then` read value that was written
    return { write, read }
  }

  module.exports = exports = { ActionablePromise, PromisifiedQueue }
