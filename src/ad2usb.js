import split from 'split';
import { EventEmitter } from 'events';
import { Socket } from 'net';

let pad = function(num, len = 3) {
  num = num.toString();
  while (num.length < len) {
    num = `0${num}`;
  }
  return num;
};


let panelMessageRegex = undefined;
let rfMessageRegex = undefined;
let sendingRegex = undefined;
class Alarm extends EventEmitter {
  static initClass() {
  
    /*
    Internal: A message has been received and must be handled.
    msg: String message sent by the AD2USB interface.
    */
    panelMessageRegex = /^\[/;
    rfMessageRegex = /^!RFX/;
    sendingRegex = /^!Sending(\.*)done/;
  }
  constructor(socket) {
    this.setup = this.setup.bind(this);
    this.socket = socket;
    this.setup();
  }

  setup() {
    return this.socket.pipe(split()).on('data', line => {
      return this.handleMessage(line.toString('ascii'));
    }
    );
  }
  handleMessage(msg) {
    try {
      if (msg.match(panelMessageRegex)) {
        return this.handlePanelData(msg);
      } else if (msg.match(rfMessageRegex)) {
        return this.handleRfMessage(msg);
      } else if (msg.match(sendingRegex)) {
        return this.emit('sent');
      }
    } catch (err) {
      return this.emit('error', err);
    }
  }


  /*
  Internal: Panel data has been received. Parse it, keep state, and emit events when state changes.
  */
  handlePanelData(msg) {
    let parts = msg.split(',');

    // Keep record of each section of the message
    let sections = [];

    // Section 1:  [1000000100000000----]

    let sec = parts[0].replace(/[\[\]]/g, '');
    sections.push(sec);
    let sec1 = sec.split('');
    let disarmed = sec1.shift() === '1';
    let armedAway = sec1.shift() === '1';
    let armedStay = sec1.shift() === '1';
    if (disarmed || armedAway || armedStay) {
      if (disarmed && !this.disarmed) {
        this.emit('disarmed');
      } else if (armedAway && !this.armedAway) {
        this.emit('armedAway');
      } else if (armedStay && !this.armedStay) {
        this.emit('armedStay');
      }
      this.disarmed = disarmed;
      this.armedAway = armedAway;
      this.armedStay = armedStay;
    }

    this.state('backlight', sec1.shift() === '1');
    this.state('programming', sec1.shift() === '1');

    let beeps = parseInt(sec1.shift(), 10);
    if (beeps > 0) { this.emit('beep', beeps); }

    this.state('bypass', sec1.shift() === '1');
    this.state('power', sec1.shift() === '1');
    this.state('chimeMode', sec1.shift() === '1');
    this.state('alarmOccured', sec1.shift() === '1');
    this.state('alarm', sec1.shift() === '1');
    this.state('batteryLow', sec1.shift() === '1');
    this.state('entryDelayOff', sec1.shift() === '1');
    this.state('fireAlarm', sec1.shift() === '1');
    this.state('checkZone', sec1.shift() === '1');
    this.state('perimeterOnly', sec1.shift() === '1');

    // Section 2: 008
    let sec2 = parts[1];
    sections.push(sec2);
    this.state('fault', sec2);
    // What should be done with this?

    // Section 3: [f702000b1008001c08020000000000]
    sections.push(parts[2].replace(/[\[\]]/g, ''));

    // Section 4: "****DISARMED****  Ready to Arm  "
    sections.push(parts[3]);

    return this.emit.apply(this, ['raw'].concat(sections)); // raw emit for debugging or additional handling
  }


  /*
  Internal: A RF sensor has reported its status. Parse it, keep state and emit events when state changes.
  */
  handleRfMessage(msg) {
    let parts = msg.replace('!RFX:', '').split(',');
    let serial = parts.shift();
    let status = pad(parseInt(parts.shift(), 16).toString(2), 8).split('').reverse();
    status = {
      battery: status[1] === '0',
      supervision: status[2] === '0',
      loop1: status[7] === '0',
      loop2: status[5] === '0',
      loop3: status[4] === '0',
      loop4: status[6] === '0'
    };
    this.state(`supervision:${serial}`, status.supervision);
    this.state(`battery:${serial}`, status.battery);
    this.state(`loop:${serial}:1`, status.loop1);
    this.state(`loop:${serial}:2`, status.loop2);
    return this.state(`loop:${serial}:3`, status.loop3,
    this.state(`loop:${serial}:4`, status.loop4));
  }


  /*
  Internal: Keep track of the state of the named property. If the property changes, then emit
  an event with the new state.
  */
  state(name, state) {
    let changed =  this[name] !== state;
    if (changed) {
      this[name] = state;
      this.emit(name, state);
    }
    return changed;
  }


  /*
  Internal: Send a command to the AD2USB interface.

  code: String command to send (i.e. "12341")
  callback: function invoked when interface acknowledges command (optional)

  Returns true if command is sent, otherwise false.
  */
  send(cmd, callback) {
    this.once('sent', function(msg) { if (callback) { return callback(null, msg); } });
    return this.socket.write(cmd);
  }

  /*
  Public: Check armed status

  Returns true if alarm is armed in stay or away mode, otherwise false
  */
  isArmed() {
    return this.armedStay || this.armedAway;
  }

  /*
  Public: Arm the alarm in away mode.

  code: The user code to use to arm the alarm.
  callback: function invoked when interface acknowledegs command (optional)

  Returns true if command is sent, otherwise false
  */
  armAway(code, callback) {
    if (code) { return this.send(`${code}2`, callback); }
  }


  /*
  Public: Arm the alarm in away stay mode.

  code: The user code to use to arm the alarm.
  callback: function invoked when interface acknowledegs command (optional)

  Returns true if command is sent, otherwise false
  */
  armStay(code, callback) {
    if (code) { return this.send(`${code}3`, callback); }
  }


  /*
  Public: Disarm the alarm.

  code: The user code to use to disarm the alarm.
  callback: function invoked when interface acknowledegs command (optional)

  Returns true if command is sent, otherwise false
  */
  disarm(code, callback) {
    if (code) { return this.send(`${code}1`, callback); }
  }


  /*
  Public: Bypass a zone.

  code: The user code to use to bypass
  zone: The zone number to bypass
  callback: function invoked when interface acknowledegs command (optional)

  Returns true if command is sent, otherwise false
  */
  bypass(code, zone, callback) {
    if (code) { return this.send(`${code}6${zone}`, callback); }
  }


  /*
  Public: Connect to the AD2USB device using a TCP socket.

  ip: String IP address of interface
  port: Integer TCP port of interface (optional, defaults to 4999)
  callback: invoked once the connection has been established (optional)
  */
  static connect(...args) {
    let left;
    if (typeof args[args.length - 1] === 'function') { var callback = args.pop(); }
    let ip = args.shift();
    let port = (left = args.shift()) != null ? left : 4999;

    let socket = new Socket({type: 'tcp4'});
    let alarm = new Alarm(socket);
    socket.connect(port, ip, callback);
    return alarm;
  }
}
Alarm.initClass();


export default Alarm;

