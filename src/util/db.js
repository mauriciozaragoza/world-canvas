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
    id: String,
    project: mongoose.Schema.Types.Mixed
});

var Room = mongoose.model('Room', roomSchema);

exports.storeProject = function(room) {
  console.log("Saving room " + room);
  
  var roomData = new Room({
    id : room,
    project : projects.projects[room].project.exportJSON()
  });

  roomData.save(function (err, room) {
    if (err) {
      console.error("could not save room");
      console.error(err);
    }
    
    console.log("room " + room.id + " saved");
  });
}

exports.loadSingle = function(room, onLoaded) {
  Room.findOne({ id: room }, function(err, value) {
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