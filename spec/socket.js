import { EventEmitter } from 'events';
import { Duplex } from 'stream';

class Socket extends Duplex {
  constructor() {
    this.data = [];
    this.written = null;
    super(...arguments);
  }

  write(msg) {
    this.written = msg;
    if (this.data.length) { return this.emit('readable'); }
  }

  read() {
    try {
      if (this.data.length) {
        return `${this.data.join('\n')}\n`;
      } else {
        return null;
      }
    } finally {
      this.data = [];
    }
  }

  send(data) {
    this.data.push(data);
    return this.emit('readable');
  }
}

export default Socket;