import createMiddleware from './middleware/create';
import createPromise from './utils/create-promise';
import isFunction from './utils/is-function';
import logger from './utils/logger';

/**
 * @param {Object} options
 * @param {boolean} [options.silent=false]
 */
class AzureFuncMiddleware {
  constructor(options = {}) {
    this.middlewares = [];
    this.silent = options.silent || false;
  }

  /**
   * Add a middleware to a cascade
   * @param {middlewareFunction} fn
   */
  use(fn) {
    const middleware = createMiddleware({ fn });
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Add a middleware with condition to a cascade
   * @param {predicateFunction} predicate
   * @param {middlewareFunction} fn
   */
  useIf(predicate, fn) {
    const middleware = createMiddleware({ fn, predicate });
    this.middlewares.push(middleware);
    return this;
  }

  useIfError(fn) {
    const middleware = createMiddleware({ fn, isError: true });
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Add a middleware for error handling to a cascade
   * @param {middlewareErrorFunction} fn
   */
  catch(fn) {
    return this.useIfError(fn);
  }

  /**
   * Add several middlewares to a cascade
   * @param {Array<middleware|middlewareFunction>} middlewares
   */
  useMany(middlewares) {
    middlewares.forEach((mw) => {
      const props = isFunction(mw) ? { fn: mw } : mw;
      const middleware = createMiddleware(props);
      this.middlewares.push(middleware);
    });
    return this;
  }

  /**
   * Compose middlewares to a handler
   * @return {Promise}
   */
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
        const [,, originalCalled] = args;
        if (originalCalled) {
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
          if (error && !doneCalled) donePromise.reject(error);
          return;
        }

        if (!middleware.needExec(error, ctx)) {
          handle(index + 1, error);
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

        try {
          await middleware.exec(error, ctx, next);
        } catch (err) {
          if (nextCalled) {
            if (!this.silent) log('unhandled error after next() called', err);
            return;
          }
          handle(index + 1, err);
        }
      };

      handle(0);

      return donePromise;
    };
  }
}

/**
 * @typedef {Object} middleware The middleware object
 * @property {middlewareFunction|middlewareErrorFunction} fn
 * @property {boolean} [isError]
 * @property {predicateFunction} [predicate]
 */
/**
 * @typedef {Function} middlewareFunction
 * @param {Object} context [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
 * @param {nextFunction} next
 */
/**
 * @typedef {Function} middlewareErrorFunction
 * @param {Error} error
 * @param {Object} context [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
 * @param {nextFunction} next
 */
/**
 * @typedef {Function} nextFunction
 * @param {Error} [error]
 */
/**
 * @typedef {Function} predicateFunction
 * @param {Object} [context] [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
 * @return {boolean}
 */

export default AzureFuncMiddleware;
