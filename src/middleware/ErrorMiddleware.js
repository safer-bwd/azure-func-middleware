import AbstractMiddleware from './AbstractMiddleware';

export default class extends AbstractMiddleware {
  constructor(fn) {
    super(fn);
    this.isErrorHandler = true;
  }

  needExec(err) {
    return this.isErrorHandler && err;
  }
}
