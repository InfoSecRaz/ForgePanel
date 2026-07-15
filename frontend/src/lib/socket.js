import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({ autoConnect: true, withCredentials: true });
  }
  return socket;
}
