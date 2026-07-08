import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { BoardSocketOperation } from '../../../../packages/shared';

let io: Server | undefined;

export const broadcastBoardOperation = (boardId: string, operation: BoardSocketOperation) => {
  io?.to(boardId).emit('board:operation', operation);
};

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: '*'
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('board:join', (boardId: string) => {
      socket.join(boardId);
    });

    socket.on('join-board', (boardId: string) => {
      socket.join(boardId);
    });

    socket.on('board:leave', (boardId: string) => {
      socket.leave(boardId);
    });

    socket.on('board:operation', (operation: BoardSocketOperation) => {
      socket.to(operation.boardId).emit('board:operation', operation);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
