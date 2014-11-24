var paper = require('paper'),
	db = require('./db.js');

var countries = ["123456789"];

exports.projects = {};

for (var i = 0; i < countries.length; i++) {
	exports.projects[countries[i]] = {
		project: new paper.Project(),
		external_paths : {}
	};

	db.loadSingle(countries[i]);
}


