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

it('sync', async () => {
  const handler = new AzureFuncMiddleware()
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

  const context = createContext();
  const { status, body } = await handler(context);

  expect(status).toEqual(200);
  expect(body).toEqual(3);

  const { calls } = context.log.info.mock;
  const callsArgs = calls.map(([arg]) => arg);
  expect(calls.length).toBe(3);
  expect(callsArgs).toEqual([1, 2, 3]);
});

it('async', async () => {
  const handler = new AzureFuncMiddleware()
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

  const context = createContext();
  const { status, body } = await handler(context);

  expect(status).toEqual(200);
  expect(body).toEqual(3);

  const { calls } = context.log.info.mock;
  const callsArgs = calls.map(([arg]) => arg);
  expect(calls.length).toBe(3);
  expect(callsArgs).toEqual([1, 2, 3]);
});

it('mixed', async () => {
  const handler = new AzureFuncMiddleware()
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

  const context = createContext();
  const { status, body } = await handler(context);

  expect(status).toEqual(200);
  expect(body).toEqual(3);

  const { calls } = context.log.info.mock;
  const callsArgs = calls.map(([arg]) => arg);
  expect(calls.length).toBe(3);
  expect(callsArgs).toEqual([1, 2, 3]);
});

it('catching an error', async () => {
  // eslint-disable-next-line jest/valid-expect-in-promise
  const handler = new AzureFuncMiddleware()
    .use(async (ctx) => {
      ctx.log.info('use1');
      await wait();
      // or next(new Error('error'));
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

  const context = createContext();
  const { status, body } = await handler(context);

  expect(status).toEqual(500);
  expect(body).toEqual('error');

  const { calls } = context.log.info.mock;
  const callsArgs = calls.map(([arg]) => arg);

  expect(calls.length).toBe(2);
  expect(callsArgs).toEqual(['use1', 'catch1']);
});

it('catching an error and recover a normal flow', async () => {
  // eslint-disable-next-line jest/valid-expect-in-promise
  const handler = new AzureFuncMiddleware()
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

  const context = createContext();
  const { status, body } = await handler(context);

  expect(status).toEqual(200);
  expect(body).toEqual('ok');

  const { calls } = context.log.info.mock;
  const callsArgs = calls.map(([arg]) => arg);
  expect(calls.length).toBe(3);
  expect(callsArgs).toEqual(['use1', 'catch1', 'use2']);
});

it('unhandled error', async () => {
  const handler = new AzureFuncMiddleware()
    .use(async (ctx) => {
      ctx.log.info('use1');
      await wait();
      // or next(new Error('error'));
      throw new Error('error');
    })
    .use(async (ctx) => {
      ctx.log.info('use2');
      await wait();
      ctx.done(null, { status: 200, body: 'ok' });
    })
    .listen();

  const context = createContext();
  await expect(handler(context)).rejects.toEqual(new Error('error'));

  const { calls } = context.log.info.mock;
  expect(calls.length).toBe(1);
  expect(calls[0][0]).toBe('use1');
});

it('useIf()', async () => {
  const handler = new AzureFuncMiddleware()
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

  const context = createContext();
  const { status, body } = await handler(context);

  expect(status).toEqual(200);
  expect(body).toEqual(3);

  const { calls } = context.log.info.mock;
  const callsArgs = calls.map(([arg]) => arg);
  expect(calls.length).toBe(3);
  expect(callsArgs).toEqual(['use1', 'useIf2', 'use2']);
});

it('useMany()', async () => {
  const commonMws = [
    async (ctx, next) => {
      ctx.log.info('chainOfCommon1');
      ctx.state.count += 1;
      await wait();
      next();
    },
    {
      predicate: ctx => ctx.state.count === 1,
      fn: async (ctx, next) => {
        ctx.log.info('chainOfCommon2');
        ctx.state.count += 1;
        await wait();
        next();
      },
    },
  ];

  const handler = new AzureFuncMiddleware()
    .use(async (ctx, next) => {
      ctx.log.info('use1');
      ctx.state.count = 1;
      await wait();
      next();
    })
    .useMany(commonMws)
    .use(async (ctx) => {
      ctx.log.info('use2');
      ctx.state.count += 1;
      await wait();
      ctx.done(null, { status: 200, body: ctx.state.count });
    })
    .listen();

  const context = createContext();
  const { status, body } = await handler(context);

  expect(status).toEqual(200);
  expect(body).toEqual(3);

  const { calls } = context.log.info.mock;
  const callsArgs = calls.map(([arg]) => arg);
  expect(calls.length).toBe(3);
  expect(callsArgs).toEqual(['use1', 'chainOfCommon1', 'use2']);
});
