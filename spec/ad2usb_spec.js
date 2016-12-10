import { assert } from 'chai';
import Alarm from '../src/ad2usb';
import Socket from './socket';

describe('AD2USB', function() {
  let alarm = null;
  let socket = null;

  beforeEach(function() {
    socket = new Socket();
    return alarm = new Alarm(socket);
  });

  it('should arm away', function(done) {
    socket.data.push('!Sending.done');
    return alarm.armAway('1234', function() {
      assert.equal(socket.written, '12342');
      return done();
    });
  });

  it('should arm stay', function(done) {
    socket.data.push('!Sending.done');
    return alarm.armStay('1234', function() {
      assert.equal(socket.written, '12343');
      return done();
    });
  });

  it('should disarm', function(done) {
    socket.data.push('!Sending.done');
    return alarm.disarm('1234', function() {
      assert.equal(socket.written, '12341');
      return done();
    });
  });

  it('should bypass', function(done) {
    socket.data.push('!Sending.done');
    return alarm.bypass('1234', '12', function() {
      assert.equal(socket.written, '1234612');
      return done();
    });
  });

  it('should emit raw', function(done) {
    alarm.on('raw', function(sec1, sec2, sec3, sec4) {
      assert.equal(sec1, '1000000100000000----');
      assert.equal(sec2, '008');
      assert.equal(sec3, 'f702000b1008001c08020000000000');
      assert.equal(sec4, '"****DISARMED****  Ready to Arm  "');
      return done();
    });
    return socket.send('[1000000100000000----],008,[f702000b1008001c08020000000000],"****DISARMED****  Ready to Arm  "');
  });

  it('should emit disarmed', function(done) {
    alarm.on('disarmed', done);
    return socket.send('[1000000100000000----],008,[f702000b1008001c08020000000000],"****DISARMED****  Ready to Arm  "');
  });

  it('should emit armed stay', function(done) {
    alarm.on('armedStay', done);
    return socket.send('[0010000100000000----],008,[f702000b1008008c08020000000000],"ARMED ***STAY***                "');
  });

  it('should emit armed away', function(done) {
    alarm.on('armedAway', done);
    return socket.send('[0100000100000000----],008,[f702000b1008008c08020000000000],"ARMED ***AWAY***                "');
  });

  it('should emit fault', function(done) {
    alarm.on('fault', function(zone) {
      assert.equal(zone, "008");
      return done();
    });
    return socket.send('[1000000100000000----],008,[f702000b1008001c08020000000000],"****DISARMED****  Ready to Arm  "');
  });

  it('should not repeatedly emit disarmed', function(done){
    let count = 0;
    alarm.on('disarmed', () => count += 1);
    socket.send('[1000000100000000----],008,[f702000b1008001c08020000000000],"****DISARMED****  Ready to Arm  "');
    socket.send('[1000000100000000----],008,[f702000b1008001c08020000000000],"****DISARMED****  Ready to Arm  "');
    let assertion = function() {
      assert.equal(1, count);
      return done();
    };
    return setTimeout(assertion, 10);
  });

  it('should not repeatedly emit armed stay', function(done){
    let count = 0;
    alarm.on('armedStay', () => count += 1);
    socket.send('[0010000100000000----],008,[f702000b1008008c08020000000000],"ARMED ***STAY***                "');
    socket.send('[0010000100000000----],008,[f702000b1008008c08020000000000],"ARMED ***STAY***                "');
    let assertion = function() {
      assert.equal(1, count);
      return done();
    };
    return setTimeout(assertion, 10);
  });

  it('should not repeatedly emit armed away', function(done) {
    let count = 0;
    alarm.on('armedAway', () => count += 1);
    socket.send('[0100000100000000----],008,[f702000b1008008c08020000000000],"ARMED ***AWAY***                "');
    socket.send('[0100000100000000----],008,[f702000b1008008c08020000000000],"ARMED ***AWAY***                "');
    let assertion = function() {
      assert.equal(1, count);
      return done();
    };
    return setTimeout(assertion, 10);
  });

  it('should emit once when alarm status changes', function(done) {
    let disarmedCount = 0;
    let armedCount = 0;
    alarm.on('disarmed', () => disarmedCount += 1);
    alarm.on('armedAway', () => armedCount += 1);
    socket.send('[1000000100000000----],008,[f702000b1008001c08020000000000],"****DISARMED****  Ready to Arm  "');
    socket.send('[0100000100000000----],008,[f702000b1008008c08020000000000],"ARMED ***AWAY***                "');
    let assertion = function() {
      assert.equal(1, disarmedCount, `disarmed event occurred ${disarmedCount} times`);
      assert.equal(1, armedCount, `armed event occurred ${armedCount} times`);
      return done();
    };
    return setTimeout(assertion, 10);
  });

  it('should not reset alarm status', function(done) {
    let count = 0;
    alarm.on('disarmed', () => count += 1);
    socket.send('[1000000100000000----],008,[f702000b1008001c08020000000000],"****DISARMED****  Ready to Arm  "');
    socket.send('[0000000100000000----],008,[f702000b1008000c08020000000000],"****DISARMED****Hit * for faults"');
    socket.send('[1000000100000000----],008,[f702000b1008001c08020000000000],"****DISARMED****  Ready to Arm  "');
    let assertion = function() {
      assert.equal(1, count);
      return done();
    };
    return setTimeout(assertion, 10);
  });

  it('should emit rf battery fault', function(done) {
    alarm.on('battery:0102532', function(ok) {
      assert.ok(!ok);
      return done();
    });
    return socket.send('!RFX:0102532,02\n');
  });

  it('should emit rf supervision fault', function(done) {
    alarm.on('supervision:0102532', function(ok) {
      assert.ok(!ok);
      return done();
    });
    return socket.send('!RFX:0102532,04\n');
  });

  it('should emit rf loop 1 fault', function(done) {
    alarm.on('loop:0102532:1', function(ok) {
      assert.ok(!ok);
      return done();
    });
    return socket.send('!RFX:0102532,80\n');
  });

  it('should emit rf loop 2 fault', function(done) {
    alarm.on('loop:0102532:2', function(ok) {
      assert.ok(!ok);
      return done();
    });
    return socket.send('!RFX:0102532,20\n');
  });

  it('should emit rf loop 3 fault', function(done) {
    alarm.on('loop:0102532:3', function(ok) {
      assert.ok(!ok);
      return done();
    });
    return socket.send('!RFX:0102532,10\n');
  });

  it('should emit rf loop 4 fault', function(done) {
    alarm.on('loop:0102532:4', function(ok) {
      assert.ok(!ok);
      return done();
    });
    return socket.send('!RFX:0102532,40\n');
  });

  return it('should not crash on parse error', function(done) {
    alarm.on('error', () => done());
    return socket.send('[1000000100000000----],008');
  });
});
