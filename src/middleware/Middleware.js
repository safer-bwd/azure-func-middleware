import AbstractMiddleware from './AbstractMiddleware';

export default class extends AbstractMiddleware {
  constructor(fn, predicate) {
    super(fn);
    this.predicate = predicate;
  }

  needExec(err, ctx) {
    if (err) {
      return false;
    }

    if (!this.predicate) {
      return true;
    }

    const predicate = this.predicate.bind(null, ctx);
    return predicate();
  }
}
