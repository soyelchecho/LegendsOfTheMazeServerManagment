const Websocket = require('ws');
const { spawn } = require('child_process');
const AWS = require('aws-sdk');

const wss = new Websocket.Server({ port : 4000});
const metadata = new AWS.MetadataService();

global.hostIpAddress = null;

metadata.request('/latest/meta-data/public-ipv4', function(err, data) {
    if (err) {
        console.log("Error: " + err);
    } else {
        global.hostIpAddress = data;
        console.log("The host IP address is: " + global.hostIpAddress);

    }
});

let DedicatedServer = {
    host: '18.223.102.7',
    port: '7777',
    status: 'running',
    playerCount: 0
}

const MIN_PORT_AVAILABILITY = 7777;
const MAX_PORT_AVAILABILITY = 8000;

wss.on('connection', (ws) => {
    if(DedicatedServer.playerCount >= 2){
        DedicatedServer.status = 'full';
    }
    else
    {
        DedicatedServer.playerCount++;
    }

    if(DedicatedServer.status == 'full'){
        DedicatedServer.port = Math.floor(Math.random() * (MAX_PORT_AVAILABILITY - MIN_PORT_AVAILABILITY + 1)) + MIN_PORT_AVAILABILITY;
        DedicatedServer.status = 'running';
        DedicatedServer.playerCount = 0;
        StartDedicatedServer();
    }
    ws.send(JSON.stringify(DedicatedServer));
});

function StartDedicatedServer(){
    const serverstartcommand = ""
}