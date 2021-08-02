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
   * @param {middlewareHandler} fn
   */
  use(fn) {
    const middleware = createMiddleware({ fn });
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Add a middleware with condition to a cascade
   * @param {predicate} predicate
   * @param {middlewareHandler} fn
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
   * @param {errMiddlewareHandler} fn
   */
  catch(fn) {
    return this.useIfError(fn);
  }

  /**
   * Add several middlewares to a cascade
   * @param {Array<middleware|middlewareHandler>} middlewares
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
   * Compose middlewares to a function handler
   * @return {funcHandler}
   */
  listen() {
    /**
     * @typedef {Function} funcHandler The Azure Function handler
     * @param {Object} context [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
     * @return {Promise}
     */
    return this._createHandler();
  }

  _createHandler() {
    return (ctx) => {
      const log = logger(ctx);

      // the recommended namespace for passing information through middlewares
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
 * @typedef {Function} middlewareHandler
 * @param {Object} context [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
 * @param {next} next
 */
/**
 * @typedef {Function} errMiddlewareHandler
 * @param {Error} error
 * @param {Object} context [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
 * @param {next} next
 */
/**
 * @typedef {Object} middleware The middleware object
 * @property {middlewareHandler|errMiddlewareHandler} fn
 * @property {boolean} [isError]
 * @property {predicate} [predicate]
 */
/**
 * @typedef {Function} next
 * @param {Error} [error]
 */
/**
 * @typedef {Function} predicate
 * @param {Object} [context] [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
 * @return {boolean}
 */

export default AzureFuncMiddleware;
