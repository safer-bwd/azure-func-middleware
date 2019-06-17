const AzureFuncMiddleware = require('../src');

const noop = () => {};

const createContext = () => {
  const log = jest.fn();
  log.info = jest.fn();

  return {
    done: noop,
    state: {},
    log
  };
};

const wait = (ms = 1) => new Promise((resolve) => {
  setTimeout(() => resolve(), ms);
});

describe('sync chain', () => {
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

  it('should resolve a correct response', async () => {
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

describe('async chain', () => {
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

  it('should resolve a correct response', async () => {
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

describe('mixed chain', () => {
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
        next();
      })
      .use((ctx) => {
        ctx.log.info(3);
        ctx.state.count += 1;
        ctx.done(null, { status: 200, body: ctx.state.count });
      })
      .listen();
  });

  it('should resolve a correct response', async () => {
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

describe('chain with catch an error #1', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use(async (ctx) => {
        ctx.log.info('use1');
        await wait();
        throw new Error('error');
      })
      .catch(async (err, ctx) => {
        ctx.log.info('catch1');
        await wait();
        ctx.done(null, { status: 500, body: err.message });
      })
      .use(async (ctx) => {
        ctx.log.info('use2');
        await wait();
        ctx.done(null, { status: 200, body: 'ok' });
      })
      .listen();
  });

  it('should resolve a correct response', async () => {
    const context = createContext();
    const { status, body } = await handler(context);
    expect(status).toEqual(500);
    expect(body).toEqual('error');
  });

  it('should be a correct order', async () => {
    const ctx = createContext();
    await handler(ctx);
    const { calls } = ctx.log.info.mock;
    expect(calls.length).toBe(2);
    const callsArgs = calls.map(([arg]) => arg);
    expect(callsArgs).toEqual(['use1', 'catch1']);
  });
});

describe('chain with catch an error #2', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use(async (ctx) => {
        ctx.log.info('use1');
        await wait();
        throw new Error('error');
      })
      .catch(async (err, ctx, next) => {
        ctx.log.info('catch1');
        await wait();
        next();
      })
      .use(async (ctx) => {
        ctx.log.info('use2');
        await wait();
        ctx.done(null, { status: 200, body: 'ok' });
      })
      .listen();
  });

  it('should resolve a correct response', async () => {
    const context = createContext();
    const { status, body } = await handler(context);
    expect(status).toEqual(200);
    expect(body).toEqual('ok');
  });

  it('should be a correct order', async () => {
    const ctx = createContext();
    await handler(ctx);
    const { calls } = ctx.log.info.mock;
    expect(calls.length).toBe(3);
    const callsArgs = calls.map(([arg]) => arg);
    expect(callsArgs).toEqual(['use1', 'catch1', 'use2']);
  });
});

describe('chain with catch an error #3', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use(async (ctx, next) => {
        ctx.log.info('use1');
        await wait();
        next(new Error('error'));
      })
      .catch(async (err, ctx) => {
        ctx.log.info('catch1');
        await wait();
        ctx.done(null, { status: 500, body: err.message });
      })
      .use(async (ctx) => {
        ctx.log.info('use2');
        await wait();
        ctx.done(null, { status: 200, body: 'ok' });
      })
      .listen();
  });

  it('should resolve a correct response', async () => {
    const context = createContext();
    const { status, body } = await handler(context);
    expect(status).toEqual(500);
    expect(body).toEqual('error');
  });

  it('should be a correct order', async () => {
    const ctx = createContext();
    await handler(ctx);
    const { calls } = ctx.log.info.mock;
    expect(calls.length).toBe(2);
    const callsArgs = calls.map(([arg]) => arg);
    expect(callsArgs).toEqual(['use1', 'catch1']);
  });
});

describe('chain with an unhandled error #1', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use(async (ctx) => {
        ctx.log.info('use1');
        await wait();
        throw new Error('error');
      })
      .use(async (ctx) => {
        ctx.log.info('use2');
        await wait();
        ctx.done(null, { status: 200, body: 'ok' });
      })
      .listen();
  });

  it('should reject', async () => {
    const context = createContext();
    await expect(handler(context)).rejects.toEqual(new Error('error'));
  });

  it('should be a correct order', async () => {
    const ctx = createContext();
    try {
      await handler(ctx);
    } catch (e) {
      //
    }
    const { calls } = ctx.log.info.mock;
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toBe('use1');
  });
});

describe('chain with an unhandled error #2', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use(async (ctx, next) => {
        ctx.log.info('use1');
        await wait();
        next(new Error('error'));
      })
      .use(async (ctx) => {
        ctx.log.info('use2');
        await wait();
        ctx.done(null, { status: 200, body: 'ok' });
      })
      .listen();
  });

  it('should reject', async () => {
    const context = createContext();
    await expect(handler(context)).rejects.toEqual(new Error('error'));
  });

  it('should be a correct order', async () => {
    const ctx = createContext();
    try {
      await handler(ctx);
    } catch (e) {
      //
    }
    const { calls } = ctx.log.info.mock;
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toBe('use1');
  });
});

describe('chain with useIf()', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use(async (ctx, next) => {
        ctx.log.info('use1');
        ctx.state.count = 1;
        await wait();
        next();
      })
      .useIf(ctx => ctx.state.count === 2, async (ctx, next) => {
        ctx.log.info('useIf1');
        ctx.state.count += 1;
        await wait();
        next();
      })
      .useIf(ctx => ctx.state.count === 1, async (ctx, next) => {
        ctx.log.info('useIf2');
        ctx.state.count += 1;
        await wait();
        next();
      })
      .use(async (ctx) => {
        ctx.log.info('use2');
        ctx.state.count += 1;
        await wait();
        ctx.done(null, { status: 200, body: ctx.state.count });
      })
      .listen();
  });

  it('should resolve a correct response', async () => {
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
    expect(callsArgs).toEqual(['use1', 'useIf2', 'use2']);
  });
});

describe('chain with useChain() #1', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use(async (ctx, next) => {
        ctx.log.info(1);
        ctx.state.count = 1;
        await wait();
        next();
      })
      .useChain([
        async (ctx, next) => {
          ctx.log.info(2);
          ctx.state.count += 1;
          await wait();
          next();
        },
        async (ctx, next) => {
          ctx.log.info(3);
          ctx.state.count += 1;
          await wait();
          next();
        },
      ])
      .use(async (ctx) => {
        ctx.log.info(4);
        ctx.state.count += 1;
        await wait();
        ctx.done(null, { status: 200, body: ctx.state.count });
      })
      .listen();
  });

  it('should resolve a correct response', async () => {
    const context = createContext();
    const { status, body } = await handler(context);
    expect(status).toEqual(200);
    expect(body).toEqual(4);
  });

  it('should be a correct order', async () => {
    const ctx = createContext();
    await handler(ctx);
    const { calls } = ctx.log.info.mock;
    expect(calls.length).toBe(4);
    const callsArgs = calls.map(([arg]) => arg);
    expect(callsArgs).toEqual([1, 2, 3, 4]);
  });
});

describe('chain with useChain() #2', () => {
  let handler;

  beforeAll(() => {
    handler = new AzureFuncMiddleware()
      .use(async (ctx, next) => {
        ctx.log.info(1);
        ctx.state.count = 1;
        await wait();
        next();
      })
      .useChain([
        {
          fn: async (ctx, next) => {
            ctx.log.info(2);
            ctx.state.count += 1;
            await wait();
            next();
          },
        },
        {
          predicate: ctx => ctx.state.count === 1,
          fn: async (ctx, next) => {
            ctx.log.info(3);
            ctx.state.count += 1;
            await wait();
            next();
          },
        },
      ])
      .use(async (ctx) => {
        ctx.log.info(4);
        ctx.state.count += 1;
        await wait();
        ctx.done(null, { status: 200, body: ctx.state.count });
      })
      .listen();
  });

  it('should resolve a correct response', async () => {
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
    expect(callsArgs).toEqual([1, 2, 4]);
  });
});
