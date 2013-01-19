/* robotlink.js - robotopen main comm code */
/* @author Eric Barch (ericb@ericbarch.com) */


define([
  'jquery',
  'robot/packetparser',
  'views/console',
  'robot/average',
  'utils',
  'views/charts',
  'views/bundle',
  'views/buttons'
], function($, packetparser, consoleview, Average, utils, charts, BundleView, buttons){
    var instance;

    // Start with the constructor
    function RobotLink(ip, port) {
      instance = this;

      // setup ip address and port
      if (ip == null)
        instance.ip = "10.0.0.22";
      else
        instance.ip = ip;

      if (port == null)
        instance.port = 22211;
      else
        instance.port = 22211;

      instance.bundleView = new BundleView();

      // rolling average to make data less jumpy
      instance.av = new Average(50);

      instance.lastPacket = 0;

      instance.lastChart = 0;

      // the UDP socket connection to the robot
      instance.socket = null;
      // is the robot currently enabled?
      instance.enabled = false;
      // storage for the interval timer to send data to the robot
      instance.tx_timer = null;
      // kill the connection if we don't receive packets for this long
      instance.autodrop_timer = null;
      // is the websocket connection to the robot active?
      instance.is_connected = false;
      // debug to console
      instance.debugging = false;
      // keep track of the packets sent and received this session
      instance.rx_count = 0;
      instance.tx_count = 0;
      // data xmit rate (ms)
      instance.xmit_rate = 100;

      // joystick count
      instance.joy_count = 0;

      // how we update the status model
      instance.statModel = null;

      // create the array to hold all of the joystick values
      instance.joy1 = new Array(
        127,  // Analog Left X Axis
        127,  // Analog Left Y Axis
        127,  // Analog Right X Axis
        127,  // Analog Right Y Axis
        0,    // Button A
        0,    // Button B
        0,    // Button X
        0,    // Button Y
        0,    // Left Shoulder
        0,    // Right Shoulder
        0,    // Left Trigger
        0,    // Right Trigger
        0,    // Select
        0,    // Start
        0,    // Left Stick Button
        0,    // Right Stick Button
        0,    // Up
        0,    // Down
        0,    // Left
        0,    // Right
        0,    // Aux
        0,    // Aux
        0,    // Aux
        0     // Aux
      );

      // copy joy1 array to other joystick arrays
      instance.joy2 = instance.joy1.slice(0);
      instance.joy3 = instance.joy1.slice(0);
      instance.joy4 = instance.joy1.slice(0);

    };

    RobotLink.prototype.debug = function(msg) {
      // if debugging is enabled, push messages to the console
      if(instance.debugging == true) {
        console.log("[RobotLink] " + msg);
      }
    };

    RobotLink.prototype.setStatModel = function(sModel) {
      instance.statModel = sModel;
    };

    RobotLink.prototype.handleJoyCountChange = function(numJoys) {
      instance.joy_count = numJoys;
    };

    RobotLink.prototype.handleJoyData = function(index, id, value) {
      if (index == 0) {
        instance.joy1[id] = value;
      } else if (index == 1) {
        instance.joy2[id] = value;
      } else if (index == 2) {
        instance.joy3[id] = value;
      } else if (index == 3) {
        instance.joy4[id] = value;
      }
    };

    RobotLink.prototype.enable = function() {
      // enable the robot
      if (instance.is_connected) {
        buttons.enabled();
        instance.enabled = true;
        instance.statModel.set({enabled: true});
      }
    };

    RobotLink.prototype.disable = function() {
      // disable the robot
      instance.enabled = false;
      buttons.disabled();
      instance.statModel.set({enabled: false});
    };

    RobotLink.prototype.connect = function() {
        try {
          instance.socket = new chromeNetworking.clients.udp.roClient();

          // pass the robotlink instance to the socket object
          var t = this;
        
        instance.socket.connect(instance.ip, instance.port,
          function() {
              t.socket_on_open(t);
          }
        );

        instance.socket.receive(function(frame) {
          t.socket_on_message(t, frame);
        });

        return true;

      } catch(exception) {
        instance.debug("Could not create socket.");
        return false;
      }
    };

    RobotLink.prototype.robot_tx = function() {
      if (instance.is_connected) {
        instance.statModel.set({connectionEnd: new Date()});
        // when the robot is disabled we must sent heartbeat frames to keep the connection alive
        if (!instance.enabled || instance.joy_count < 1) {
          var buf = new ArrayBuffer(3); // 2 bytes for each char
            var bufView = new Uint8Array(buf);
            bufView[0] = 104; // h
            bufView[1] = 238; // 0xEE
            bufView[2] = 1;   // 0x01
          instance.xmit(buf);
        }
        else { // otherwise send joystick data
          instance.send_joysticks();
        }
      }
    };

    RobotLink.prototype.send_joysticks = function() {
      // send joystick data here
      var bytearray = new Uint8Array(3+(instance.joy_count*24));
      bytearray[0] = 99;  // 'c'

      // load joystick data into byte array
      if (instance.joy_count >= 1) {
        for (var i = 0; i < 24; i++) {
          bytearray[i+1] = instance.joy1[i];
        }
      } else if (instance.joy_count >= 2) {
        for (var i = 0; i < 24; i++) {
          bytearray[i+25] = instance.joy2[i];
        }
      } else if (instance.joy_count >= 3) {
        for (var i = 0; i < 24; i++) {
          bytearray[i+49] = instance.joy3[i];
        }
      } else if (instance.joy_count >= 4) {
        for (var i = 0; i < 24; i++) {
          bytearray[i+73] = instance.joy4[i];
        }
      }

      // calculate crc-16
      var crcDec = utils.crc16(bytearray, 1+(instance.joy_count*24));

      // insert crc-16 into byte array
      bytearray[1+(instance.joy_count*24)] = (crcDec >> 8) & 0xFF;
      bytearray[2+(instance.joy_count*24)] = crcDec & 0xFF;

      instance.xmit(bytearray.buffer);
    };

    RobotLink.prototype.xmit = function(frame) {
        try {
          // increment tx count
          instance.tx_count++;
          instance.statModel.set({packetTx: instance.tx_count});

          // transmit the frame or message to the robot
        instance.socket.send(frame);

        var bytearray = new Uint8Array(frame);

          var myString = "";

          for (var i = 0; i < bytearray.length-1; i++) {
          myString += bytearray[i].toString(16) + " ";
        }
        myString += bytearray[bytearray.length-1].toString(16);

        instance.debug("TX: " + myString);

        return true;
      } catch(exception) {
        instance.debug("Transmit failure.");
        return false;
      }
    };

    RobotLink.prototype.socket_on_open = function(link) {
      function killConnect() { 
        var now = new Date().getTime();
        if (now - instance.lastPacket > 2000) {
          instance.disconnect(); 
          clearInterval(instance.autodrop_timer); 
        }
      }
      instance.autodrop_timer = setInterval(killConnect, 1000);
      link.is_connected = true;
      instance.bundleView.clearAll();
      instance.statModel.set({connecting: true});
      instance.statModel.set({connectionStart: new Date(), connectionEnd: new Date()});
      buttons.connected();
      instance.lastPacket = new Date().getTime();
      link.debug("Socket opened.");

      // setup the timer to keep data supplied to the robot
      function callTx() { link.robot_tx(); }
      link.tx_timer = setInterval(callTx, link.xmit_rate);
    };

    RobotLink.prototype.socket_on_message = function(link, frame) {
      clearTimeout(instance.autodrop_timer);

      link.rx_count++;

      // average latency
      var now = new Date().getTime();
      instance.av.add(now - instance.lastPacket);

      // update the latency chart every second
      if (now - instance.lastChart > 1000) {
        charts.addPoint(Math.round(now - instance.lastPacket));
        instance.lastChart = now;
      }
      
      instance.lastPacket = now;
      instance.statModel.set({packetRx: instance.rx_count, averageLatency: instance.av.getAverage(), connected: true, connecting: false});

      if (frame.data instanceof ArrayBuffer) {
        var bytearray = new Uint8Array(frame.data);

        switch (String.fromCharCode(bytearray[0])) {
          case 'p':
            // feed the parsed packet to the console view
            consoleview.log(packetparser.parsePrint(bytearray));
            break;
          case 'd':
            instance.bundleView.updateBundles(packetparser.parseDS(frame.data));
            break;
          case 's':
            link.debug('GOT STATUS PACKET');
            break;
          case 'r':
            link.debug('GOT PARAMETER PACKET');
            break;
          default:
            break;
        }

        var myString = "";

        for (var i = 0; i < bytearray.length-1; i++) {
          myString += bytearray[i].toString(16) + " ";
        }
        myString += bytearray[bytearray.length-1].toString(16);

        instance.debug("RX: " + myString);
      }
    };

    RobotLink.prototype.disconnect = function() {
      buttons.disconnected();
      instance.statModel.set({connected: false, connecting: false});
      instance.socket.disconnect();
      instance.disable();
      instance.socket = null;
      instance.is_connected = false;

      if (instance.tx_timer != null) {
        clearInterval(instance.tx_timer);
        instance.tx_timer = null;
      }

      instance.debug("Socket closed.");
      instance.rx_count = 0;
      instance.tx_count = 0;
    };

    // return the constructor
    return RobotLink;
});