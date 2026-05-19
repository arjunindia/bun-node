# Bun UDP Sockets

## Overview

Bun provides a UDP API suited for services with advanced real-time requirements, such as voice chat.

## Bind a UDP Socket (`Bun.udpSocket()`)

```ts
const socket = await Bun.udpSocket({});
console.log(socket.port); // assigned by the operating system
```

### Specifying a Port

```ts
const socket = await Bun.udpSocket({
  port: 41234,
});
console.log(socket.port); // 41234
```

## Sending Datagrams

```ts
socket.send("Hello, world!", 41234, "127.0.0.1");
```

> The address must be a valid IP address since `send` does not perform DNS resolution, as it is intended for low-latency operations.

## Receiving Datagrams

```ts
const server = await Bun.udpSocket({
  socket: {
    data(socket, buf, port, addr) {
      console.log(`message from ${addr}:${port}:`);
      console.log(buf.toString());
    },
  },
});

const client = await Bun.udpSocket({});
client.send("Hello!", server.port, "127.0.0.1");
```

The `data` callback receives four arguments: the socket instance, a buffer containing the packet data, the source port, and the source address.

## Connections

UDP itself lacks a true connection concept, but many UDP communications involve only one peer. Connecting the socket to that peer specifies the destination for all outgoing packets and restricts incoming traffic to that peer only.

```ts
const server = await Bun.udpSocket({
  socket: {
    data(socket, buf, port, addr) {
      console.log(`message from ${addr}:${port}:`);
      console.log(buf.toString());
    },
  },
});

const client = await Bun.udpSocket({
  connect: {
    port: server.port,
    hostname: "127.0.0.1",
  },
});

client.send("Hello");
```

Connected sockets can potentially observe performance benefits since connections are implemented at the OS level. With a connected socket, `send` no longer requires specifying a port and address each time.

## Sending Many Packets at Once (`sendMany()`)

To avoid the overhead of individual system calls per packet, `sendMany()` batches multiple packets into a single operation.

### Unconnected Socket

For an unconnected socket, `sendMany` takes a single array argument where every three elements describe one packet: **data**, **target port**, and **target address**.

```ts
const socket = await Bun.udpSocket({});
socket.sendMany(["Hello", 41234, "127.0.0.1", "foo", 53, "1.1.1.1"]);
```

### Connected Socket

For a connected socket, `sendMany` takes an array where each element is simply the data to send:

```ts
const socket = await Bun.udpSocket({
  connect: {
    port: 41234,
    hostname: "localhost",
  },
});
socket.sendMany(["foo", "bar", "baz"]);
```

**Return value:** `sendMany` returns the count of packets successfully sent.

## Handling Backpressure

If a packet doesn't fit in the OS packet buffer, backpressure occurs. Detection methods:
- `send` returns `false`
- `sendMany` returns a number less than the count of specified packets

When the socket becomes writable again, the `drain` handler fires:

```ts
const socket = await Bun.udpSocket({
  socket: {
    drain(socket) {
      // continue sending data
    },
  },
});
```

## Socket Options

```ts
const socket = await Bun.udpSocket({});

// Enable broadcasting to send packets to a broadcast address
socket.setBroadcast(true);

// Set the IP TTL (time to live) for outgoing packets
socket.setTTL(64);
```

### Available Methods:
- **`setBroadcast(boolean)`** — enables/disables sending to broadcast addresses
- **`setTTL(number)`** — sets the IP time-to-live for outgoing packets

## Multicast

### Joining and Leaving Multicast Groups

```ts
const socket = await Bun.udpSocket({});

socket.addMembership("224.0.0.1");
socket.addMembership("224.0.0.1", "192.168.1.100"); // with specific network interface
socket.dropMembership("224.0.0.1");
```

### Additional Multicast Options

```ts
socket.setMulticastTTL(2);
socket.setMulticastLoopback(true);
socket.setMulticastInterface("192.168.1.100");
```

### Multicast Method Summary

| Method | Description |
|---|---|
| `addMembership(groupAddr, interfaceAddr?)` | Join a multicast group, optionally on a specific interface |
| `dropMembership(groupAddr)` | Leave a multicast group |
| `setMulticastTTL(hops)` | Set the number of network hops for multicast packets |
| `setMulticastLoopback(boolean)` | Toggle whether multicast packets loop back locally |
| `setMulticastInterface(addr)` | Choose the outgoing interface for multicast |

### Source-Specific Multicast (SSM)

```ts
socket.addSourceSpecificMembership("10.0.0.1", "232.0.0.1");
socket.dropSourceSpecificMembership("10.0.0.1", "232.0.0.1");
```
