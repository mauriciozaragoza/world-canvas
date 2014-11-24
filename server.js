/**
 * Module dependencies.
 */

var settings = require('./public/util/Settings.js'),
    tests = require('./public/util/tests.js'),
    draw = require('./public/util/draw.js'),
    projects = require('./public/util/projects.js'),
    db = require('./public/util/db.js'),
    express = require("express"),
    app = express(),
    paper = require('paper'),
    socket = require('socket.io'),
    async = require('async'),
    fs = require('fs');

var port = settings.port;

// Config Express to server static files from /
app.configure(function(){
    app.use(express.static(__dirname + '/public'));
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

/**
 * Routes.
 */

// Index page
app.get('/', function(req, res){
    res.render('index.jade', {});
});

// Drawings
app.get('/draw/:id', function(req, res){
    var id = req.params.id;
    res.render('draw.jade', {});
});

// Map
app.get('/map/', function(req, res){
    res.render('map.jade', {});
});

// Map
app.get('/history/:id', function(req, res){
    var id = req.params.id;
    res.render('history.jade', 
    {
        "result": [
            {"name":id, "likes":"12", "date":"12 Aug 2014", "image":"/img/something4.png"},
            {"name":id, "likes":"11", "date":"12 Jul 2014", "image":"/img/something3.png"},
            {"name":id, "likes":"15", "date":"12 Jun 2014", "image":"/img/something2.png"},
            {"name":id, "likes":"13", "date":"12 May 2014", "image":"/img/something1.png"}
        ]
    });
});

// Map
app.get('/top/', function(req, res){
    res.render('top.jade', 
    {
        "result": [
            {"name":"USA", "likes":"15", "date":"12 May 2014", "image":"/img/something1.png"},
            {"name":"Mexico", "likes":"13", "date":"12 Jun 2014", "image":"/img/something2.png"},
            {"name":"Canada", "likes":"11", "date":"12 Jul 2014", "image":"/img/something3.png"},
            {"name":"Spain", "likes":"9", "date":"12 Jul 2014", "image":"/img/something4.png"}
        ]
    });
});

/**
 * Listen for requests.
 */

var server = app.listen(port);
var io = socket.listen(server);

io.sockets.setMaxListeners(0);

/**
 * Socket IO.
 */

io.sockets.on('connection', function (socket) {
    console.log(socket.request.connection.remoteAddress);
    socket.on('disconnect', function () {
        console.log("Socket disconnected");
        // TODO: We should have logic here to remove a drawing from memory as we did previously
    });

    // EVENT: User stops drawing something
    // Having room as a parameter is not good for secure rooms
    socket.on('draw:progress', function (room, uid, co_ordinates) {   
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

    // User moves one or more items on their canvas - progress
    socket.on('item:move:progress', function(room, uid, itemNames, delta) {
        draw.moveItemsProgress(room, uid, itemNames, delta);
        if (itemNames) {
            io.sockets.in(room).emit('item:move', uid, itemNames, delta);
        }
    });

    // User moves one or more items on their canvas - end
    socket.on('item:move:end', function(room, uid, itemNames, delta) {
        draw.moveItemsEnd(room, uid, itemNames, delta);
        if (itemNames) {
            io.sockets.in(room).emit('item:move', uid, itemNames, delta);
        }
    });

    // User adds a raster image
    socket.on('image:add', function(room, uid, data, position, name) {
        draw.addImage(room, uid, data, position, name);
        io.sockets.in(room).emit('image:add', uid, data, position, name);
    });

});

/**
 * Subscribe to a client room.
 */

function subscribe(socket, data) {
    var room = data.room;

    // Subscribe the client to the room
    socket.join(room);

    // If the close timer is set, cancel it
    // if (closeTimer[room]) {
    //  clearTimeout(closeTimer[room]);
    // }

    // Create Paperjs instance for this room if it doesn't exist
    var project = projects.projects[room];
    if (!project) {
        console.log("made room");
        projects.projects[room] = {};
        // Use the view from the default project. This project is the default
        // one created when paper is instantiated. Nothing is ever written to
        // this project as each room has its own project. We share the View
        // object but that just helps it "draw" stuff to the invisible server
        // canvas.
        projects.projects[room].project = new paper.Project();
        projects.projects[room].external_paths = {};
        db.load(room, socket);
    } else { // Project exists in memory, no need to load from database
        loadFromMemory(room, socket);
    }

    // Broadcast to room the new user count -- currently broken
    var rooms = socket.adapter.rooms[room]; 
    var roomUserCount = Object.keys(rooms).length;
    io.to(room).emit('user:connect', roomUserCount);
}

/**
 * Send current project to new client.
 */

function loadFromMemory(room, socket) {
    var project = projects.projects[room].project;
    if (!project) { // Additional backup check, just in case
        db.load(room, socket);
        return;
    }
    socket.emit('loading:start');
    var value = project.exportJSON();
    socket.emit('project:load', {project: value});
    socket.emit('loading:end');
}

function loadError(socket) {
    socket.emit('project:load:error');
}