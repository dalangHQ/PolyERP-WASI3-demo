#!/usr/bin/env node
/**
 * JSON-RPC over TCP — Raw TCP socket server
 * Implements the same PolyERP pipeline for fair comparison.
 * Each request: {"jsonrpc":"2.0","method":"pipeline","params":{"orders":[...]},"id":1}
 */

const net = require('net');
const { processPipeline, getStock, SKU_CATALOG } = require('./pipeline');

const server = net.createServer((socket) => {
  let buffer = '';
  socket.on('data', (data) => {
    buffer += data.toString();
    // Process complete JSON messages (newline-delimited)
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        let result;
        if (msg.method === 'pipeline') {
          result = processPipeline(msg.params.orders);
        } else if (msg.method === 'stock') {
          result = { stock: getStock(msg.params?.ids || SKU_CATALOG) };
        } else if (msg.method === 'health') {
          result = { status: 'ok' };
        } else {
          socket.write(JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: msg.id }) + '\n');
          continue;
        }
        socket.write(JSON.stringify({ jsonrpc: '2.0', result, id: msg.id }) + '\n');
      } catch (e) {
        socket.write(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }) + '\n');
      }
    }
  });
  socket.on('error', () => {}); // ignore client disconnects
});

const PORT = process.env.PORT || 18081;
server.listen(PORT, '127.0.0.1', () => {
  console.error(`[JSON-RPC/TCP] Listening on tcp://127.0.0.1:${PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => { server.close(); process.exit(0); });
