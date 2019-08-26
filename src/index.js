import Middleware from './middleware/Middleware';
import ErrorMiddleware from './middleware/ErrorMiddleware';
import createPromise from './utils/create-promise';
import isFunction from './utils/is-function';
import logger from './utils/logger';

class AzureFuncMiddleware {
  constructor(options = {}) {
    this.middlewares = [];
    this.silent = options.silent || false;
  }

  use(fn) {
    const middleware = new Middleware(fn);
    this.middlewares.push(middleware);
    return this;
  }

  useIf(predicate, fn) {
    const middleware = new Middleware(fn, predicate);
    this.middlewares.push(middleware);
    return this;
  }

  useIfError(fn) {
    const middleware = new ErrorMiddleware(fn);
    this.middlewares.push(middleware);
    return this;
  }

  catch(fn) {
    return this.useIfError(fn);
  }

  useChain(middlewares) {
    middlewares.forEach((middleware) => {
      if (isFunction(middleware)) {
        this.use(middleware);
        return;
      }

      const { fn, predicate, isError } = middleware;
      if (isError) {
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
      const log = logger(ctx);

      // the recommended namespace for passing information through middleware
      ctx.state = {};

      let doneCalled = false;
      const originalDone = ctx.done;
      const donePromise = createPromise();

      ctx.done = (...args) => {
        const [,, calledOriginal] = args;
        if (calledOriginal) {
          originalDone(...args);
          return;
        }

        if (doneCalled) {
          if (!this.silent) log(new Error('done() called multiple times'));
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

      const handle = async (index, error) => {
        const middleware = this.middlewares[index];
        if (!middleware) {
          if (error && !doneCalled) {
            donePromise.reject(error);
          }
          return;
        }

        let nextCalled = false;
        const next = (err) => {
          if (nextCalled) {
            if (!this.silent) log(new Error('next() called multiple times'));
            return Promise.resolve();
          }
          nextCalled = true;
          return handle(index + 1, err);
        };

        if (!middleware.needExec(error, ctx)) {
          next(error);
          return;
        }

        try {
          await middleware.exec(error, ctx, next);
        } catch (err) {
          if (nextCalled) {
            if (!this.silent) log('unhandled error after next() called', err);
            return;
          }
          next(err);
        }
      };

      handle(0);

      return donePromise;
    };
  }
}

export default AzureFuncMiddleware;
