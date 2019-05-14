export default () => {
  let promiseArgs;

  const promise = new Promise((...args) => {
    promiseArgs = args;
  });

  const [resolve, reject] = promiseArgs;
  promise.resolve = resolve;
  promise.reject = reject;

  return promise;
};
