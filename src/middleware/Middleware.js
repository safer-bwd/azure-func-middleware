export default class {
  constructor(fn, predicate) {
    this.fn = fn;
    this.predicate = predicate;
  }

  needExec(err, ctx) {
    if (err) return false;
    if (!this.predicate) return true;

    const predicate = this.predicate.bind(null, ctx);
    return predicate();
  }

  exec(err, ctx, next) {
    const fn = this.fn.bind(null);
    return fn(ctx, next);
  }
}
