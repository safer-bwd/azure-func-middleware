# azure-func-middleware

[![Build Status](https://travis-ci.com/safer-bwd/azure-func-middleware.svg?branch=master)](https://travis-ci.com/safer-bwd/azure-func-middleware)

A _middleware_ cascade implementation for Azure Functions JS 2.x (inspired by Koa and Express).

## Install

```sh
npm install azure-func-middleware --save
```

## Usage

### Main flow

Method [`use`](#use) adds middleware handler to a cascade.
Middleware handlers are executed in the order they are added.
To go to the next middleware handler, use the `next` callback.
Method `listen` composes middlewares to the Azure Function handler.

```javascript
const AzureFuncMiddleware = require('azure-func-middleware');

module.exports = new AzureFuncMiddleware()
  .use(async (ctx, next) => {
    // will be called first
    // ...
    next();
  })
  .use((ctx, next) => {
    // will be called second if no error in first
    // ...
    ctx.done(null, { status: 200 });
  })
  .catch((err, ctx, next) => {
    // will be called if there is error in first or second
    // ...
    ctx.done(null, { status: 500 });
  })
  .listen();
```

### Response

To complete the response process, use `done` callback of [the context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)

#### Using with the `$return` output binding

function.json

    {
      "bindings": [
        ...
        {
        "type": "http",
        "direction": "out",
        "name": "$return"
        }
      ]
    }

index.js

```javascript
const AzureFuncMiddleware = require('azure-func-middleware');

module.exports = new AzureFuncMiddleware()
  .use((ctx) => {
    const response = {
      status: 200,
      body: 'OK'
    };
    ctx.done(null, response);
  })
  .listen();
```

#### Using with the named output binding

function.json

    {
      "bindings": [
        ...
        {
        "type": "http",
        "direction": "out",
        "name": "res"
        }
      ]
    }

index.js

```javascript
const AzureFuncMiddleware = require('azure-func-middleware');

module.exports = new AzureFuncMiddleware()
  .use((ctx) => {
    ctx.res = {
      status: 200,
      body: 'OK'
    };
    ctx.done();
  })
  .listen();
```

### Capturing errors

If an error is thrown in the middleware handler, then the nearest error middleware handler is called.
Error handlers are added by the `catch` method.

```javascript
const AzureFuncMiddleware = require('azure-func-middleware');

module.exports = new AzureFuncMiddleware()
  .use((ctx, next) => {
    throw new Error('Error!'); // or next(new Error('Error!'));
  })
  .use(async (ctx, next) => {
    // won't be called
    // ...
    next()
  })
  .catch((err, ctx, next) => {
    // will be called
    ctx.done(null, {
      status: 500,
      body: err.message // 'Error!' 
    });
  })
  .listen();
```

### Passing data through middlewares

For passing data through middlewares you can use namespace `state` of [the context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)

```javascript
const AzureFuncMiddleware = require('azure-func-middleware');

module.exports = new AzureFuncMiddleware()
  .use(async (ctx, next) => {
    ctx.state.count = 1;
    next();
  })
  .use((ctx, next) => {
    ctx.state.count += 1; // ctx.state.count === 2
    ctx.done(null, { status: 200 });
  })
  .listen();
```

### Conditional middlewares

The method `useIf` adds a middleware handler that will be executed if the `predicate` returns true.

```javascript
const AzureFuncMiddleware = require('azure-func-middleware');

module.exports = new AzureFuncMiddleware()
  .useIf(ctx => ctx.req.method === 'HEAD', (ctx, next) => {
    // will be called if HEAD request 
    // ...
  })
  .useIf(ctx => ctx.req.method === 'GET', (ctx, next) => {
    // will be called if GET request 
    // ...
  })
  .listen();
```

### Common middlewares

Often Azure Functions use a common sequence of middlewares.
You can declare this sequence and add using the method `useMany`.

common-middlewares.js

```javascript
const defineUser = (ctx, next) => { 
  //... 
};
const checkRoles = (ctx, next) => {
  //... 
};

module.exports = [
  { fn: defineUser },
  { fn: checkRoles }
]
```

index.js

```javascript
const AzureFuncMiddleware = require('azure-func-middleware');
const commonMiddlewares = require('common-middlewares');

module.exports = new AzureFuncMiddleware()
  .useMany(commonMiddlewares)
  .use((ctx, next) => {
      // will be called after common middlewares
    })
  .listen();
```

## Testing

The Azure Function handler returns a promise. This fact can be used for testing.

#### Using with the `$return` output binding

function.json

    {
      "bindings": [
        ...
        {
        "type": "http",
        "direction": "out",
        "name": "$return"
        }
      ]
    }

test.js

```javascript
const funcHandler = require(...);

it('should work', async () => {
  const context = { ... };
  const expectedBody = ...;
  const { status, body } = await funcHandler(context);
  expect(status).toEqual(200);
  expect(body).toEqual(expectedBody);
});
```

#### Using with the named output binding

function.json

    {
      "bindings": [
        ...
        {
        "type": "http",
        "direction": "out",
        "name": "res"
        }
      ]
    }

test.js

```javascript
const funcHandler = require(...);

it('should work', async () => {
  const context = { ... };
  const expectedBody = ...;
  await funcHandler(context);
  expect(context.res.status).toEqual(200);
  expect(context.res.body).toEqual(expectedBody);
});
```

## API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

-   [AzureFuncMiddleware](#azurefuncmiddleware)
    -   [Parameters](#parameters)
    -   [use](#use)
        -   [Parameters](#parameters-1)
    -   [useIf](#useif)
        -   [Parameters](#parameters-2)
    -   [catch](#catch)
        -   [Parameters](#parameters-3)
    -   [useMany](#usemany)
        -   [Parameters](#parameters-4)
    -   [listen](#listen)
-   [funcHandler](#funchandler)
    -   [Parameters](#parameters-5)
-   [middlewareHandler](#middlewarehandler)
    -   [Parameters](#parameters-6)
-   [errMiddlewareHandler](#errmiddlewarehandler)
    -   [Parameters](#parameters-7)
-   [middleware](#middleware)
    -   [Properties](#properties)
-   [next](#next)
    -   [Parameters](#parameters-8)
-   [predicate](#predicate)
    -   [Parameters](#parameters-9)

### AzureFuncMiddleware

#### Parameters

-   `options` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)**  (optional, default `{}`)
    -   `options.silent` **[boolean](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)**  (optional, default `false`)

#### use

Add a middleware to a cascade

##### Parameters

-   `fn` **[middlewareHandler](#middlewarehandler)** 

#### useIf

Add a middleware with condition to a cascade

##### Parameters

-   `predicate` **[predicate](#predicate)** 
-   `fn` **[middlewareHandler](#middlewarehandler)** 

#### catch

Add a middleware for error handling to a cascade

##### Parameters

-   `fn` **[errMiddlewareHandler](#errmiddlewarehandler)** 

#### useMany

Add several middlewares to a cascade

##### Parameters

-   `middlewares` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;([middleware](#middleware) \| [middlewareHandler](#middlewarehandler))>** 

#### listen

Compose middlewares to a function handler

Returns **[funcHandler](#funchandler)** 

### funcHandler

Type: [Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

#### Parameters

-   `context` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)

Returns **[Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

### middlewareHandler

Type: [Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

#### Parameters

-   `context` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
-   `next` **[next](#next)** 

### errMiddlewareHandler

Type: [Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

#### Parameters

-   `error` **[Error](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)** 
-   `context` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)
-   `next` **[next](#next)** 

### middleware

Type: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

#### Properties

-   `fn` **([middlewareHandler](#middlewarehandler) \| [errMiddlewareHandler](#errmiddlewarehandler))** 
-   `isError` **[boolean](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)?** 
-   `predicate` **[predicate](#predicate)?** 

### next

Type: [Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

#### Parameters

-   `error` **[Error](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)?** 

### predicate

Type: [Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)

#### Parameters

-   `context` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?** [The context object](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object)

Returns **[boolean](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 
