import http from 'http';
import app from './app';
import { env } from './config/env';
import { initSocket } from './socket';

const server = http.createServer(app);
initSocket(server);

server.listen(env.port, () => {
  console.log(`API listening on port ${env.port}`);
});
