/**
 * Module dependencies.
 */

var settings = require('./src/util/Settings.js'),
    tests = require('./src/util/tests.js'),
    draw = require('./src/util/draw.js'),
    projects = require('./src/util/projects.js'),
    db = require('./src/util/db.js'),
    express = require("express"),
    app = express(),
    paper = require('paper'),
    socket = require('socket.io'),
    async = require('async'),
    fs = require('fs');

/**
 * A setting, just one
 */
var port = settings.port;

// Config Express to server static files from /
app.configure(function(){
  app.use(express.static(__dirname + '/'));
});

// Sessions
app.use(express.cookieParser());
app.use(express.session({secret: 'secret', key: 'express.sid'}));

// Development mode setting
app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// Production mode setting
app.configure('production', function(){
  app.use(express.errorHandler());
});




// ROUTES
// Index page
app.get('/', function(req, res){
  res.sendfile(__dirname + '/src/static/html/index.html');
});

// Drawings
app.get('/draw/*', function(req, res){
  res.sendfile(__dirname + '/src/static/html/draw.html');
});

// Get image
app.get('/image/:id.svg', function(req, res){
  draw.getDrawing(req.params.id, function (project) {
    var svg = project.exportSVG({
      asString: true,
      matchShapes: true
    });

    // console.log(svg);

    // svg.width = 10000;
    // svg.height = 10000;

    res.send(svg);
  });
});

// Map
app.get('/map/*', function(req, res){
  res.sendfile(__dirname + '/src/static/html/map.html');
});

// Map
app.get('/history/*', function(req, res){
  res.sendfile(__dirname + '/src/static/html/history.html');
});

// Map
app.get('/top/*', function(req, res){
  res.sendfile(__dirname + '/src/static/html/top.html');
});

// Static files IE Javascript and CSS
app.use("/static", express.static(__dirname + '/src/static'));




// LISTEN FOR REQUESTS
var server = app.listen(port);
var io = socket.listen(server);

io.sockets.setMaxListeners(0);

// SOCKET IO
io.sockets.on('connection', function (socket) {
  socket.on('disconnect', function () {
    console.log("Socket disconnected");
  });

  // EVENT: User stops drawing something
  // Having room as a parameter is not good for secure rooms
  socket.on('draw:progress', function (room, uid, co_ordinates) {
    // console.log(room, uid, co_ordinates);
    
    if (!projects.projects[room] || !projects.projects[room].project) {
      loadError(socket);
      return;
    }

    io.in(room).emit('draw:progress', uid, co_ordinates);
    draw.progressExternalPath(room, JSON.parse(co_ordinates), uid);
  });

  // EVENT: User stops drawing something
  // Having room as a parameter is not good for secure rooms
  socket.on('draw:end', function (room, uid, co_ordinates) {
    if (!projects.projects[room] || !projects.projects[room].project) {
      loadError(socket);
      return;
    }

    io.in(room).emit('draw:end', uid, co_ordinates);
    draw.endExternalPath(room, JSON.parse(co_ordinates), uid);
  });

  // User joins a room
  socket.on('subscribe', function(data) {
    subscribe(socket, data);
  });

  // User clears canvas
  socket.on('canvas:clear', function(room) {
    if (!projects.projects[room] || !projects.projects[room].project) {
      loadError(socket);
      return;
    }
    draw.clearCanvas(room);
    io.in(room).emit('canvas:clear');
  });

  // User removes an item
  socket.on('item:remove', function(room, uid, itemName) {
    draw.removeItem(room, uid, itemName);
    io.sockets.in(room).emit('item:remove', uid, itemName);
  });
});

// Subscribe a client to a room
function subscribe(socket, data) {
  var room = data.room;

  socket.join(room);

  var project = projects.projects[room].project;

  socket.emit('loading:start');
  var value = project.exportJSON();
  console.log("Client entered to room " + room);
  socket.emit('project:load', { project: value });
  socket.emit('loading:end');
}

function loadError(socket) {
  socket.emit('project:load:error');
}

