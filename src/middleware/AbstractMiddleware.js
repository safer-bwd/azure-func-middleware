export default class {
  constructor(fn) {
    this.fn = fn;
    this.isError = false;
  }

  exec(err, ctx, next) {
    const fn = this.fn.bind(null);
    return this.isError ? fn(err, ctx, next) : fn(ctx, next);
  }
}
