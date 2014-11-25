/**
 * Module dependencies.
 */

var settings = require('./src/util/Settings.js'),
    draw = require('./src/util/draw.js'),
    projects = require('./src/util/projects.js'),
    db = require('./src/util/db.js'),
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
app.get('/', function(req, res) {
    res.render('index.jade', {});
});

// Drawings
app.get('/draw/:id', function(req, res) {
    var id = req.params.id;
    res.render('draw.jade', {});
});

// Map
app.get('/map/', function(req, res) {
    res.render('map.jade', {});
});

// Image
app.get('/image/:id.svg', function(req, res) {
	db.getDrawing(req.params.id, function (svg) {
		// svg.width = 10000;
		// svg.height = 10000;

		res.send(svg);
	});
});

app.get('/top/', function(req, res) {
	db.getTopRanked(16, function (data) {
		res.render('top.jade', {"result": data});
		console.log(data);
	});
});

// History
app.get('/history/:name', function(req, res) {
    db.getHistory(16, req.params.name, function (data) {
    	res.render('history.jade', {"result" : data});
    })
});

// Like
app.get('/like/:id', function(req, res) {
    db.addLike(req.params.id, 
		req.headers['x-forwarded-for'] || req.connection.remoteAddress,
		function (rating) {
			return res.json(rating);
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

/**
 * Subscribe to a client room.
 */

function subscribe(socket, data) {
	var room = data.room;

	socket.join(room);

	if (!projects.projects[room]) {
		console.error("Room: " + room + " does not exist");
		return;
	}

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