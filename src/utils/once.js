export default (fn) => {
  let result;
  let isCalled = false;

  return (...args) => {
    if (!isCalled) {
      isCalled = true;
      result = fn(...args);
    }

    return result;
  };
};
