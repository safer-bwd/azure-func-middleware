export default ctx => (...args) => {
  if (ctx.log && ctx.log.warn) {
    ctx.log.warn(...args);
  } else {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};
