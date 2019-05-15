const AzureFuncMiddleware = require('../src');

const noop = () => {};

const createContext = () => {
  const log = jest.fn();
  log.error = jest.fn();
  log.warn = jest.fn();
  log.info = jest.fn();
  log.verbose = jest.fn();

  return {
    done: noop,
    state: {},
    log
  };
};

const wait = (ms = 1) => new Promise((resolve) => {
  setTimeout(() => resolve(), ms);
});

describe('test sync chain', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use((ctx, next) => {
        ctx.log.info(1);
        ctx.state.count = 1;
        next();
      })
      .use((ctx, next) => {
        ctx.log.info(2);
        ctx.state.count += 1;
        next();
      })
      .use((ctx) => {
        ctx.log.info(3);
        ctx.state.count += 1;
        ctx.done(null, { status: 200, body: ctx.state.count });
      })
      .listen();
  });

  it('should resolve a correct reponse', async () => {
    const context = createContext();
    const { status, body } = await handler(context);
    expect(status).toEqual(200);
    expect(body).toEqual(3);
  });

  it('should be a correct order', async () => {
    const ctx = createContext();
    await handler(ctx);
    const { calls } = ctx.log.info.mock;
    expect(calls.length).toBe(3);
    const callsArgs = calls.map(([arg]) => arg);
    expect(callsArgs).toEqual([1, 2, 3]);
  });
});

describe('test async chain', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use(async (ctx, next) => {
        ctx.log.info(1);
        ctx.state.count = 1;
        await wait();
        next();
      })
      .use(async (ctx, next) => {
        ctx.log.info(2);
        ctx.state.count += 1;
        await wait();
        next();
      })
      .use(async (ctx) => {
        ctx.log.info(3);
        ctx.state.count += 1;
        await wait();
        ctx.done(null, { status: 200, body: ctx.state.count });
      })
      .listen();
  });

  it('should resolve a correct reponse', async () => {
    const context = createContext();
    const { status, body } = await handler(context);
    expect(status).toEqual(200);
    expect(body).toEqual(3);
  });

  it('should be a correct order', async () => {
    const ctx = createContext();
    await handler(ctx);
    const { calls } = ctx.log.info.mock;
    expect(calls.length).toBe(3);
    const callsArgs = calls.map(([arg]) => arg);
    expect(callsArgs).toEqual([1, 2, 3]);
  });
});

describe('test mixed chain', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use((ctx, next) => {
        ctx.log.info(1);
        ctx.state.count = 1;
        next();
      })
      .use(async (ctx, next) => {
        ctx.log.info(2);
        ctx.state.count += 1;
        await wait();
        await next();
      })
      .use((ctx) => {
        ctx.log.info(3);
        ctx.state.count += 1;
        ctx.done(null, { status: 200, body: ctx.state.count });
      })
      .listen();
  });

  it('should resolve a correct reponse', async () => {
    const context = createContext();
    const { status, body } = await handler(context);
    expect(status).toEqual(200);
    expect(body).toEqual(3);
  });

  it('should be a correct order', async () => {
    const ctx = createContext();
    await handler(ctx);
    const { calls } = ctx.log.info.mock;
    expect(calls.length).toBe(3);
    const callsArgs = calls.map(([arg]) => arg);
    expect(callsArgs).toEqual([1, 2, 3]);
  });
});
