class Middleware {
  constructor(fn, predicate = () => true) {
    this.fn = fn;
    this.predicate = predicate;
  }

  needExec(ctx, err) {
    const predicate = this.predicate.bind(null, ctx);
    return !err && predicate();
  }

  exec(ctx, err, next, ...args) {
    const fn = this.fn.bind(null, ctx, next, ...args);
    return fn();
  }
}

export default Middleware;
