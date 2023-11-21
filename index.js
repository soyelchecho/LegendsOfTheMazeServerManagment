const Websocket = require('ws');
const spawn = require('child_process').spawn;
const AWS = require('aws-sdk');
const util = require('util');
const path = require('path');

const wss = new Websocket.Server({ port : 4000});
const metadata = new AWS.MetadataService();

process.stdin.resume(); // so the program will not close instantly


const MIN_PORT_AVAILABILITY = 7777;
const MAX_PORT_AVAILABILITY = 8000;

// Ruta relativa al archivo index.js al archivo UTCPlaygroundServer.sh
const SERVER_EXECUTE_RELATIVE_PATH = './LegendsOfTheMaze/UTCPlaygroundServer.sh';


const usedPorts = []; // Lista global de puertos utilizados


function getAvailablePort(){
    while (true) {
        const port = Math.floor(Math.random() * (MAX_PORT_AVAILABILITY - MIN_PORT_AVAILABILITY + 1)) + MIN_PORT_AVAILABILITY;
        
        // Verificar si el puerto está en la lista de puertos utilizados
        if (!usedPorts.includes(port)) {
          usedPorts.push(port); // Agregar el puerto a la lista de puertos utilizados
          return port; // Devolver el puerto si no está en uso
        }
    }
}

global.hostIpAddress = null;

playersConnected = 0;
listOfServers = [];
listOfProcess = [];

const RANGEELO = [
    { min: 0, max: 49 },      { min: 50, max: 99 },
    { min: 100, max: 149 },   { min: 150, max: 199 },
    { min: 200, max: 249 },   { min: 250, max: 299 },
    { min: 300, max: 349 },   { min: 350, max: 399 },
    { min: 400, max: 449 },   { min: 450, max: 499 },
    { min: 500, max: 549 },   { min: 550, max: 599 },
    { min: 600, max: 649 },   { min: 650, max: 699 },
    { min: 700, max: 749 },   { min: 750, max: 799 },
    { min: 800, max: 849 },   { min: 850, max: 899 },
    { min: 900, max: 949 },   { min: 950, max: 999 },
    { min: 1000, max: 1049 }
  ]


function continueAfterGetIp(){
    wss.on('connection', (ws) => {
        console.log("New player conneted");
        playersConnected++;

        ws.on('message', function message(data){
            const ParsedData = JSON.parse(data);
            console.log("Player is trying to find a server with data: ");
            console.log(data);
            console.log(ParsedData);
            if(ParsedData.type == 'findingmatch'){
                const {elo} = ParsedData.data;
                serverForPlayer = findOrCreateServer(elo);
                // Envía la informacion de que servidor entrar al cliente
                ws.send(JSON.stringify({ type: 'servermatch', data: serverForPlayer }));
            }
        });
        ws.send(JSON.stringify({ type: 'connection_success', data: {'status': 200} }));
    });
}

// Función para encontrar o crear un servidor
function findOrCreateServer(elo) {
    for (let i = 0; i < listOfServers.length; i++) {
      const server = listOfServers[i];
      if (elo >= server.recommendedElo.min && elo <= server.recommendedElo.max && server.playerCount < 2) {
        // Se encontró un servidor adecuado
        listOfServers[i].playerCount++;
        return server;
      }
    }
  
    // Si no se encontró un servidor adecuado, llama a la función para crear un nuevo servidor
    const newServer = createServer(elo); // Debes definir la función createServer
    newServer.playerCount++;
    listOfServers.push(newServer);
    return newServer;
}


function findEloRange(elo) {
    for (let i = 0; i < RANGEELO.length; i++) {
        const range = RANGEELO[i];
        if (elo >= range.min && elo <= range.max) {
        return range;
        }
    }
    return null; // Devuelve null si no se encuentra ningún rango
}

function createServer(elo){
    let NewDedicatedServer = {
        host: global.hostIpAddress,
        recommendedElo: findEloRange(elo),
        port: getAvailablePort(),
        status: 'running',
        playerCount: 0
    };

    StartNewDedicatedServer(NewDedicatedServer);

    return NewDedicatedServer;
}

function StartNewDedicatedServer(ServerToStart){
    // Obtén el path absoluto
    const absolutePathServerExec = path.resolve(__dirname, SERVER_EXECUTE_RELATIVE_PATH);
    portToUse = ServerToStart.port;

    const serverStartCommand = absolutePathServerExec + ' -port ' + portToUse + ' -log'+ ' -server';

    const commandParts = serverStartCommand.split(' ');

    const serverProcess = spawn(commandParts[0], commandParts.slice(1));

    serverProcess.stdout.on('data', function (data) {
        console.log('Server stdout: ' + data.toString());
    });
    
    serverProcess.stderr.on('data', function (data) {
        console.log('Server stderr: ' + data.toString());
    });
    
    serverProcess.on('exit', function (code) {
        console.log('Server process exited with code ' + code.toString());
    });

    listOfProcess.add(serverProcess);

    // Establecer un temporizador de 5 minutos para detener el servidor
    timeoutId = setTimeout(() => {
        StopServer(serverProcess);
    }, 1 * 60 * 1000); // 5 minutos en milisegundos
}



function StopServer(serverProcess) {
    if (serverProcess) {
        console.log('Deteniendo el servidor...');
        serverProcess.kill();
    } else {
        console.log('El servidor no está en ejecución.');
    }
}


function initApp() {
    // Configuración de variables de entorno, conexión a bases de datos, etc.
    metadata.fetchMetadataToken(function (err, token) {
        if (err) {
          throw err;
        } else {
            metadata.request("/latest/meta-data/public-ipv4",{headers: { "x-aws-ec2-metadata-token": token },},
            function (err, data) {
                if (err) {
                    console.log("Error: " + err);
                } else {
                    global.hostIpAddress = data;
                    continueAfterGetIp();
                }
            }
          );
        }
    });
}

// Llamar a la función de inicialización cuando se inicia la aplicación
initApp();


function stopAllBackgroundProcesses() {
    listOfProcess.forEach((backgroundProcess) => {
        try {
            process.kill(-backgroundProcess.pid);
            console.log('Proceso en segundo plano detenido.');
        } catch (err) {
            // Handle the error gracefully, e.g., log it
            console.error('Error stopping background process:', err);
        }
    });
    listOfProcess.length = 0; // Vaciar la lista
}


function exitHandler(options, exitCode) {
    stopAllBackgroundProcesses();
    if (options.cleanup) console.log('clean');
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
}

// do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));