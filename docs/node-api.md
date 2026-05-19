# Bun Node-API

Bun has implemented **95%** of the Node-API interface from scratch, meaning most existing Node-API extensions will work with Bun out of the box.

## Loading Node-API Modules

Like Node.js, `.node` files (Node-API modules) can be required directly. Two methods are documented:

### Method 1: Using `require()`

```js
const napi = require("./my-node-module.node");
```

### Method 2: Using `process.dlopen()`

```js
let mod = { exports: {} };
process.dlopen(mod, "./my-node-module.node");
```
