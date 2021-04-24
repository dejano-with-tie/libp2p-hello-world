import express from 'express';
import {Socket} from "socket.io";

export abstract class IoHandler {
  socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket
  }

}
