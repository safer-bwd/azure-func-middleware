import Middleware from './middleware/Middleware';
import ErrorMiddleware from './middleware/ErrorMiddleware';
import createPromise from './utils/create-promise';
import once from './utils/once';

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
    const middleware = new Middleware(fn);
    this.middlewares.push(middleware);

    return this;
  }

  /**
   * Add a middleware with condition to a cascade
   * @param {predicate} predicate
   * @param {middlewareHandler} fn
   */
  useIf(predicate, fn) {
    const middleware = new Middleware(fn, predicate);
    this.middlewares.push(middleware);

    return this;
  }

  /**
   * Add several middlewares to a cascade
   * @param {Array<errMiddlewareHandler|middlewareHandler>} fns
   */
  useMany(fns) {
    fns.forEach((fn) => {
      const middleware = (fn.length > 2) ? new ErrorMiddleware(fn) : new Middleware(fn);
      this.middlewares.push(middleware);
    });

    return this;
  }

  useManyIf(predicate, fns) {
    const predicateOnce = once(predicate);

    fns.forEach((fn) => {
      const middleware = (fn.length > 2) ? new ErrorMiddleware(fn, predicateOnce)
        : new Middleware(fn, predicateOnce);
      this.middlewares.push(middleware);
    });

    return this;
  }

  /**
   * Add a middleware for error handling to a cascade
   * @param {errMiddlewareHandler} fn
   */
  catch(fn) {
    const middleware = new ErrorMiddleware(fn);
    this.middlewares.push(middleware);

    return this;
  }

  /**
   *  Add a middleware for error handling with condition to a cascade
   * @param {errMiddlewareHandler} fn
   */
  catchIf(predicate, fn) {
    const middleware = new ErrorMiddleware(fn, predicate);
    this.middlewares.push(middleware);

    return this;
  }

  /**
   * Compose middlewares to a function handler
   * @return {funcHandler}
   */
  listen() {
    return this._createHandler();
  }

  _createHandler() {
    return (ctx) => {
      const logger = ctx.log ? ctx.log : console;

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
          if (!this.silent) logger.error(new Error('done() called multiple times'));
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
            if (!this.silent) logger.error(new Error('next() called multiple times'));
            return Promise.resolve();
          }
          nextCalled = true;
          return handle(index + 1, err);
        };

        try {
          await middleware.exec(error, ctx, next);
        } catch (err) {
          if (nextCalled) {
            if (!this.silent) logger.error('unhandled error after next() called', err);
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
 * @typedef {Function} funcHandler The Azure Function handler
 * @param {Object} context [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
 * @return {Promise}
 */
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
 * @typedef {Function} next
 * @param {Error} [error]
 */
/**
 * @typedef {Function} predicate
 * @param {Object} [context] [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
 * @return {boolean}
 */

export default AzureFuncMiddleware;
