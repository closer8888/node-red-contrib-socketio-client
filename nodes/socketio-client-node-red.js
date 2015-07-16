module.exports = function(RED) {
    "use strict";
    function socketioClientNode(config) {
        // Create a RED node
        RED.nodes.createNode(this,config);
        var node = this;
        // Store local copies of the node configuration (as defined in the .html)
        node.host = config.host;
        node.path = config.path;
        node.wholemsg = (config.wholemsg === "true");
        node.closing = false;
        node._inputNodes = [];    // collection of nodes that want to receive events
        
        function initConn(){
node.warn("LINE 15: node.path= " + node.path);
            var socket = require('socket.io-client')(node.host, { path: node.path, multiplex:false });
            node.server = socket; // keep for closing
            handleConnection(socket);
        }
        
        function handleConnection(/*socket*/socket) {
            var id = (1+Math.random()*4294967295).toString(16);
console.log("LINE23: in handleConnection");
            //currently handleable events from socketio server
            socket.on('connect', function(){
                node.emit("connected");
console.log("LINE 27:socket connected");
                socket.emit("subscribe", "allChannels");
            });
            socket.on('reconnect', function(){
console.log("LINE 31: reconnecting to ssb----------------------------------------");
            });
            socket.on('remote_event', function(channel, data){
console.log("LINE 34: Received remote_event " + channel);

                var msg;
                if (this.wholemsg) {
                    try {
                        msg = JSON.parse(data);
                        msg.channel = channel;
                    }
                    catch(err) {
                        msg = { payload:data, channel:channel };
                    }
                } else {
                    msg = {
                        payload:data,
                        channel:channel
                    };
                }
                msg._session = {type:"websocket",id:id};
                for (var i = 0; i < node._inputNodes.length; i++) {
                    //If a channel was specified in the input's config or allChannels was checked
                    if(node._inputNodes[i].channel === msg.channel || node._inputNodes[i].allChannels){
                        node._inputNodes[i].send(msg);
                    }
                }
            });
            socket.on('disconnect', function(){
console.log("socket disconnecting");
                node.emit('closed');
            });
            socket.on('returnPubs', function(){});
            socket.on('error', function(err){
                node.emit('erro', err);
node.warn("LINE 41: error detected");
            });
        }
        
        initConn();
        
        node.on("close", function(){
            node.server.close();
        });
    }
    RED.nodes.registerType("socketio-client",socketioClientNode);
    
    socketioClientNode.prototype.registerInputNode = function(/*Node*/handler) {
        this._inputNodes.push(handler);
    };
    
    socketioClientNode.prototype.broadcast = function(channel, data){
console.log("Broadcasting: " + channel);
        this.server.emit(channel, data);
    };
    function socketioInNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.allChannels = config.allChannels;
        node.channel = config.channel;
        this.serverConfig = RED.nodes.getNode(config.client);
        if (this.serverConfig) {
            this.serverConfig.registerInputNode(this);
            this.serverConfig.on('connected', function(n) { node.status({fill:"green",shape:"dot",text:"connected "}); });
            this.serverConfig.on('erro', function() { node.status({fill:"red",shape:"ring",text:"error"}); });
            this.serverConfig.on('closed', function() { node.status({fill:"red",shape:"ring",text:"disconnected"}); });
        } else {
            this.error("Missing server configuration");
        }
    }
    RED.nodes.registerType("socketio in",socketioInNode);
    
    function socketioOutNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.allChannels = config.allChannels;
        node.channel = config.channel;
        this.serverConfig = RED.nodes.getNode(config.client);
        if (!this.serverConfig) {
            this.error("Missing server configuration");
        }
        else {
            this.serverConfig.on('connected', function(n) { node.status({fill:"green",shape:"dot",text:"connected "}); });
            this.serverConfig.on('erro', function() { node.status({fill:"red",shape:"ring",text:"error"}); });
            this.serverConfig.on('closed', function() { node.status({fill:"red",shape:"ring",text:"disconnected"}); });
        }
        this.on("input", function(msg) {
            var payload;
            
            if (msg.hasOwnProperty("payload")) {
                if (!Buffer.isBuffer(msg.payload)) { // if it's not a buffer make sure it's a string.
                    payload = RED.util.ensureString(msg.payload);
                }
                else {
                    payload = msg.payload;
                }
            }
            if (msg.channel && payload) {
                if((node.channel && msg.channel && node.channel === msg.channel) || node.allChannels){
                    node.serverConfig.broadcast(msg.channel, payload);
                }
            }
        });
    }
    RED.nodes.registerType("socketio out",socketioOutNode);
};