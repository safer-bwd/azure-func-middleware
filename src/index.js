const createPromiseObj = () => {
  const obj = {};

  obj.promise = new Promise((resolve, reject) => {
    obj.resolve = resolve;
    obj.reject = reject;
  });

  return obj;
};

class AzureFuncMiddleware {
  constructor() {
    this.middlewares = [];
  }

  use(fn) {
    this.middlewares.push({ fn });
    return this;
  }

  catch(fn) {
    this.middlewares.push({ fn, isErrorMw: true });
    return this;
  }

  listen() {
    return this._createHandler();
  }

  _createHandler() {
    return (ctx) => {
      let doneCalled = false;
      const originalDone = ctx.done;
      const donePromiseObj = createPromiseObj();

      ctx.done = (...args) => {
        const [,, isPromise] = args;
        if (isPromise) {
          originalDone(...args);
          return;
        }

        if (doneCalled) {
          const err = new Error('done() called multiple times');
          ctx.log.error(err);
          return;
        }

        doneCalled = true;

        const [err, result] = args;
        if (err) {
          donePromiseObj.reject(err);
        } else {
          donePromiseObj.resolve(result);
        }
      };

      ctx.state = {};

      let mwIndex = -1;
      const handle = async (index, error) => {
        if (index <= mwIndex) {
          const err = new Error('next() called multiple times');
          ctx.log.error(err);
          return;
        }

        mwIndex = index;
        const mw = this.middlewares[index];
        if (!mw) {
          if (error && !doneCalled) {
            donePromiseObj.reject(error);
          }
          return;
        }

        const next = err => handle(index + 1, err);
        const { isErrorMw } = mw;
        const needSkipMw = (error && !isErrorMw) || (!error && isErrorMw);
        if (needSkipMw) {
          next(error);
          return;
        }

        const { fn } = mw;
        const fnMw = error ? fn.bind(null, error, ctx, next)
          : fn.bind(null, ctx, next);

        try {
          await fnMw();
        } catch (err) {
          next(err);
        }
      };

      handle(0);

      return donePromiseObj.promise;
    };
  }
}


module.exports = AzureFuncMiddleware;
