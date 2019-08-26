export default class {
  constructor(fn) {
    this.fn = fn;
    this.isErrorHandler = false;
  }

  exec(err, ctx, next) {
    const fn = this.fn.bind(null);
    return this.isErrorHandler ? fn(err, ctx, next) : fn(ctx, next);
  }
}
