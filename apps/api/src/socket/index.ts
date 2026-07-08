import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

export const initSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: '*'
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-board', (boardId: string) => {
      socket.join(boardId);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
