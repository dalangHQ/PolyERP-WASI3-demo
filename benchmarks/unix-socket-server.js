#!/usr/bin/env node
/**
 * Unix Domain Socket server — Local IPC without network stack
 * Implements the same PolyERP pipeline for fair comparison.
 * Uses newline-delimited JSON protocol.
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const { processPipeline, getStock, SKU_CATALOG } = require('./pipeline');

const SOCK_PATH = process.env.SOCK_PATH || '/tmp/polyerp-unix.sock';

// Remove stale socket
try { fs.unlinkSync(SOCK_PATH); } catch (_) {}

const server = net.createServer((socket) => {
  let buffer = '';
  socket.on('data', (data) => {
    buffer += data.toString();
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
        } else {
          socket.write(JSON.stringify({ error: 'unknown method', id: msg.id }) + '\n');
          continue;
        }
        socket.write(JSON.stringify({ result, id: msg.id }) + '\n');
      } catch (e) {
        socket.write(JSON.stringify({ error: e.message, id: null }) + '\n');
      }
    }
  });
  socket.on('error', () => {});
});

server.listen(SOCK_PATH, () => {
  console.error(`[Unix Socket] Listening on ${SOCK_PATH}`);
});

process.on('SIGTERM', () => { server.close(); try { fs.unlinkSync(SOCK_PATH); } catch(_){} });
process.on('SIGINT', () => { server.close(); try { fs.unlinkSync(SOCK_PATH); } catch(_){} process.exit(0); });
