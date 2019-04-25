class AzureFuncMiddleware {
  constructor(options = {}) {
    this.middlewares = [];
    const { returnPromise = true } = options;
    this.returnPromise = returnPromise;
  }

  use(fn) {
    this.middlewares.push({ fn });
  }

  catch(fn) {
    this.middlewares.push({ fn, isError: true });
  }

  listen() {
    return this._createHandler();
  }

  _createHandler() {
    return (ctx) => {
      let doneCalled = false;
      const originalDone = ctx.done;
      const donePromise = new Promise((resolve, reject) => {
        ctx.done = (...args) => {
          if (doneCalled) {
            reject(new Error('done() called multiple times'));
          }

          doneCalled = true;
          if (!this.returnPromise) {
            originalDone(...args);
          }

          const [err, propertyBag] = args;
          if (err) {
            reject(err);
          } else {
            resolve(propertyBag);
          }
        };
      });

      let index = -1;
      const dispatch = async (i, err) => {
        if (i <= index) {
          throw err || new Error('next() called multiple times');
        }

        index = i;
        const middleware = this.middlewares[i];
        if (!middleware) {
          return;
        }

        const { isError } = middleware;
        const validMiddleware = (err && isError)
          || (!err && !isError);

        if (!validMiddleware) {
          dispatch(i + 1, err);
          return;
        }

        const { fn } = middleware;
        try {
          await fn(ctx, dispatch.bind(null, i + 1, err));
        } catch (e) {
          dispatch(i + 1, e);
        }
      };
      dispatch(0);

      return this.returnPromise ? donePromise : undefined;
    };
  }
}

export default AzureFuncMiddleware;
