import { io, Socket } from 'socket.io-client';
import { apiClient } from '../api/client';
import type { BoardSocketOperation } from '../../packages/shared';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? window.location.origin).replace(/\/$/, '');

let socket: Socket | undefined;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      auth: {
        token: apiClient.getToken()
      },
      transports: ['websocket', 'polling']
    });
  }

  return socket;
};

export const joinBoardRoom = (boardId: string, onOperation: (operation: BoardSocketOperation) => void) => {
  const activeSocket = getSocket();

  activeSocket.emit('board:join', boardId);
  activeSocket.on('board:operation', onOperation);

  return () => {
    activeSocket.off('board:operation', onOperation);
    activeSocket.emit('board:leave', boardId);
  };
};
