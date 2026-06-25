/**
 * Binary protocol TCP client — used by the benchmark runner.
 * Sends length-prefixed binary frames and reads responses.
 */
const net = require('net');
const { encodeOrders, decodeResults } = require('./binary-protocol.js');

function binaryTcpCall(port, orders) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      const orderBuf = encodeOrders(orders);
      // Frame: [4 bytes len][1 byte op][payload]
      const frame = Buffer.allocUnsafe(4 + 1 + orderBuf.length);
      frame.writeUInt32LE(1 + orderBuf.length, 0);
      frame[4] = 0x01; // pipeline op
      orderBuf.copy(frame, 5);
      socket.write(frame);
    });

    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length >= 4) {
        const respLen = buf.readUInt32LE(0);
        if (buf.length >= 4 + respLen) {
          const payload = buf.subarray(4, 4 + respLen);
          socket.destroy();
          try {
            const results = decodeResults(payload);
            resolve({ results, fraudCount: 0 });
          } catch (e) {
            reject(e);
          }
        }
      }
    });
    socket.on('error', reject);
    setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 15000);
  });
}

function binaryTcpStock(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      const frame = Buffer.allocUnsafe(5);
      frame.writeUInt32LE(1, 0);
      frame[4] = 0x02;
      socket.write(frame);
    });
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length >= 4) {
        const respLen = buf.readUInt32LE(0);
        if (buf.length >= 4 + respLen) {
          const payload = buf.subarray(4, 4 + respLen);
          socket.destroy();
          const count = payload.readUInt32LE(0);
          const stocks = new Array(count);
          for (let i = 0; i < count; i++) {
            stocks[i] = payload.readUInt32LE(4 + i * 4);
          }
          resolve(stocks);
        }
      }
    });
    socket.on('error', reject);
    setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 15000);
  });
}

function binaryTcpReset(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      const frame = Buffer.allocUnsafe(5);
      frame.writeUInt32LE(1, 0);
      frame[4] = 0x04;
      socket.write(frame);
    });
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length >= 4) {
        const respLen = buf.readUInt32LE(0);
        if (buf.length >= 4 + respLen) {
          socket.destroy();
          resolve(buf.subarray(4, 4 + respLen).toString('utf8'));
        }
      }
    });
    socket.on('error', reject);
    setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 5000);
  });
}

module.exports = { binaryTcpCall, binaryTcpStock, binaryTcpReset };
