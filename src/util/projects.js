var paper = require('paper'),
	db = require('./db.js'),
	schedule = require('node-schedule');

var countries = ["123456789"];

exports.projects = null;

function initializeProjects() {
	exports.projects = {};

	for (var i = 0; i < countries.length; i++) {
		exports.projects[countries[i]] = {
			project: new paper.Project(),
			external_paths : {},
			dirty : false
		};

		db.load(countries[i]);
	}
}

initializeProjects();

// -----------
// JOBS
// -----------

var saveJob = new schedule.RecurrenceRule();
saveJob.minute = new schedule.Range(0, 59, 1);

schedule.scheduleJob(saveJob, function () {
    for (var i = 0; i < countries.length; i++) {
    	if (exports.projects[countries[i]].dirty) {
			console.log("saving room: " + countries[i]);
			exports.projects[countries[i]].dirty = false;
			db.storeProject(countries[i]);
    	}
	}
});

var newCanvasJob = new schedule.RecurrenceRule();
newCanvasJob.minute = new schedule.Range(0, 59, 2);

schedule.scheduleJob(newCanvasJob, function () {
    console.log("Creating new canvas");

    for (var i = 0; i < countries.length; i++) {
    	db.archiveProject(countries[i], function (data) {
    		exports.projects.projects[data.name].project = new paper.Project();
    	});
	}
});