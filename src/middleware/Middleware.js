class Middleware {
  constructor(fn, predicate = () => true) {
    this.fn = fn;
    this.predicate = predicate;
    this.isError = false;
  }

  needExec(ctx, err) {
    const predicate = this.predicate.bind(null, ctx);
    return !err && predicate();
  }

  exec(ctx, err, next) {
    const fn = this.fn.bind(null, ctx, next);
    return fn();
  }
}

export default Middleware;
