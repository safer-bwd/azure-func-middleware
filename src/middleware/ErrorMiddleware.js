import AbstractMiddleware from './AbstractMiddleware';

export default class extends AbstractMiddleware {
  constructor(fn) {
    super(fn);
    this.isError = true;
  }

  needExec(err) {
    return this.isError && err;
  }
}
