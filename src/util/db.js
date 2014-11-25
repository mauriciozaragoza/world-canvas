var settings = require('./Settings.js'),
	projects = require('./projects.js');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/worldcanvas');

var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
	console.log("Loaded DB");
});

var roomSchema = mongoose.Schema({
	name: String,
	project: mongoose.Schema.Types.Mixed
});

var Room = mongoose.model('Room', roomSchema);

var archiveSchema = mongoose.Schema({
	name: String,
	svg: String,
	rating: Number,
	date: Date
});

var Archive = mongoose.model('Archive', archiveSchema);

exports.storeProject = function (room) {
	console.log("Saving room " + room);
	
	Room.update({ name : room }, 
		{ 
			$set: {
				project: projects.projects[room].project.exportJSON()
			}
		}, 
		{ upsert: true }, 
		function (err) {
			if (err) {
				console.error("could not save room");
				console.error(err);
			}
			
			console.log("room saved");
		});
}

exports.load = function (room, onLoaded) {
	Room.findOne({ name: room }, function (err, value) {
		console.log("loading single room " + room);

		if (err) {
			console.error("could not load single room");
			console.error(err);
		}

		var project = projects.projects[room].project;

		if (value && project && project.activeLayer) {
			project.activeLayer.remove();
			project.importJSON(value.project);
		}
		
		if (onLoaded) {
			onLoaded(project);
		}
	});
}

exports.archiveProject = function (room, onFinished) {
	var archiveData = new Archive({
		name : room,
		svg : projects.projects[room].project.exportSVG({
			asString: true,
			matchShapes: true
		}),
		rating : 0,
		date : new Date()
	});

	archiveData.save(function (err, value) {
		if (onFinished) {
			onFinished(value);
		}

		exports.storeProject(room);
	});
}

exports.getDrawing = function (id, onLoaded) {
	Archive.findOne({ _id: id }, function (err, value) {
		if (err) {
			console.error(err);
		}
		else {
			if (value) {
				onLoaded(value.svg);
			}
		}
	});
}

exports.getTopRanked = function (count, onLoaded) {
	Archive
		.find()
		.select("-svg")
		.sort('+rating')
		.limit(count).
		exec(function (err, value) {
			onLoaded(value);
		});
}

exports.getHistory = function (count, countryCode, onLoaded) {
	// Archive
	// 	.find({"name" : name})
	// 	.select("-svg")
	// 	.sort('+date')
	// 	.limit(count)
	// 	exec(function (err, value) {
	// 		onLoaded(value);
	// 	});
}