class ErrorMiddleware {
  constructor(fn) {
    this.fn = fn;
    this.isError = true;
  }

  needExec(ctx, err) {
    return this.isError && err;
  }

  exec(ctx, err, next, ...args) {
    const fn = this.fn.bind(null, err, ctx, next, ...args);
    return fn();
  }
}

export default ErrorMiddleware;
