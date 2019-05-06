import createPromise from './create-promise';

class AzureFuncMiddleware {
  constructor() {
    this.middlewares = [];
  }

  use(fn) {
    const predicate = (ctx, err) => !err;
    return this.useIf(predicate, fn);
  }

  useIfError(fn) {
    const predicate = (ctx, err) => !!err;
    return this.useIf(predicate, fn);
  }

  catch(fn) {
    return this.useIfError(fn);
  }

  useIf(predicate, fn) {
    this.middlewares.push({ fn, predicate });
    return this;
  }

  useChain(chain) {
    chain.forEach((mw) => {
      if (typeof mw === 'function') {
        this.use(mw);
        return;
      }

      const { fn, predicate, error } = mw;
      if (error) {
        this.useIfError(fn);
      } else if (predicate) {
        this.useIf(predicate, fn);
      } else {
        this.use(fn);
      }
    });

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

      ctx.state = {};

      ctx.done = (...args) => {
        const [,, isPromise] = args;
        if (isPromise) {
          originalDone(...args);
          return;
        }

        if (doneCalled) {
          ctx.log.error(new Error('done() called multiple times'));
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

      let mwIndex = -1;
      const handle = async (index, error) => {
        if (index <= mwIndex) {
          ctx.log.error(new Error('next() called multiple times'));
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

        let nextCalled = false;
        const next = (err) => {
          nextCalled = true;
          return handle(index + 1, err);
        };

        const { predicate } = mw;
        const needSkipMw = !predicate(ctx, error);
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
          if (nextCalled) {
            ctx.log.error('unhandled error after next() called', err);
          } else {
            next(err);
          }
        }
      };

      handle(0);

      return donePromise;
    };
  }
}

export default AzureFuncMiddleware;
