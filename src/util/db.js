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
	country: String,
	date: Date
});

var Archive = mongoose.model('Archive', archiveSchema);

var ratingSchema = mongoose.Schema({
	image_id: String,
	ip: String
});

var Rating = mongoose.model('Rating', ratingSchema);

exports.storeProject = function (room) {
	// console.log("Saving room " + room);
	
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
		});
}

exports.load = function (room, onLoaded) {
	Room.findOne({ name: room }, function (err, value) {
		// console.log("loading single room " + room);

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

exports.archiveProject = function (room, countryName, onFinished) {
	var archiveData = new Archive({
		name : room,
		svg : projects.projects[room].project.exportSVG({
			asString: true,
			matchShapes: true
		}),
		rating : 0,
		country: countryName,
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


exports.getCurrentDrawing = function (room, onLoaded) {
	if (projects.projects[room]) {
		onLoaded(projects.projects[room].project.exportSVG({
			asString: true,
			matchShapes: true
		}));
	}
}

exports.getTopRanked = function (count, onLoaded) {
	Archive
		.find()
		.select("-svg")
		.sort({'rating' : -1})
		.limit(count)
		.exec(function (err, value) {
			onLoaded(value);
		});
}

exports.getHistory = function (count, countryCode, onLoaded) {
	var hash = projects.countries[projects.countryCodes.indexOf(countryCode)];
	console.log(hash);
	
	Archive
		.find({"name" : hash})
		.select("-svg")
		.sort({'date' : -1})
		.limit(count)
		.exec(function (err, value) {
			onLoaded(value);
		});
}

exports.addLike = function (image_id, ip, onFinished) {
	Archive.findOne({ "_id": image_id }, function (err, archive) {
		if (err) {
			console.error(err);
		}

		if (!archive) {
			// console.log("archive not found");
			if (onFinished) onFinished(-1);
		}
		else {
			Rating
				.findOne({ "ip": ip, "image_id" : image_id }, function (err, value) {
				if (err) {
					console.error(err);
				}

				if (value) {
					// console.log("rating found, ignoring");
					if (onFinished) onFinished(archive.rating);
				}
				else {
					// console.log("rating not found");
					var r = new Rating({
						"image_id" : image_id,
						"ip" : ip
					});

					r.save(function (err, value) {
						if (err) {
							console.error(err);
						}

						// console.log("updating ", { "_id": mongoose.Types.ObjectId(image_id) });

						archive.update({ $inc: { rating : 1 } }, function (err) {
							if (err) {
								console.error(err);
							}

							if (onFinished) onFinished(archive.rating + 1);
							// console.log("rating saved: ", archive.rating + 1);
						});
					});
				}
			});
		}
	});
}