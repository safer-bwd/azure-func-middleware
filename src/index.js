import createPromise from './create-promise';

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
      const donePromise = createPromise();

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
          donePromise.reject(err);
        } else {
          donePromise.resolve(result);
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
            donePromise.reject(error);
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
        const mwFn = error ? fn.bind(null, error, ctx, next)
          : fn.bind(null, ctx, next);

        try {
          await mwFn();
        } catch (err) {
          next(err);
        }
      };

      handle(0);

      return donePromise;
    };
  }
}

module.exports = AzureFuncMiddleware;
