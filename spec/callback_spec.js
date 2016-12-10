import { assert } from 'chai';
import Alarm from '../src/ad2usb';
import Socket from './socket';

describe('Callback', function() {
  let alarm = null;
  let socket = null;

  beforeEach(function() {
    socket = new Socket();
    return alarm = new Alarm(socket);
  });

  return it('should callback on sent response', function(done) {
    socket.data.push('!Sending..done');
    return alarm.send('12341', () => done());
  });
});

