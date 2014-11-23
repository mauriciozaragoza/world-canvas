var settings = require('./Settings.js'),
    projects = require('./projects.js'),
     ueberDB = require('ueberDB');

var db = new ueberDB.database(settings.dbType, settings.dbSettings);

exports.storeProject = function(room) {
  var project = projects.projects[room].project;
  var json = project.exportJSON();
  db.init(function (err) {
    if(err) {
      console.error(err);
    }
    console.log("Writing project to database");
    db.set(room, {project: json});
  });
}

exports.load = function(room, socket) {
  console.log("load from db");
  
  if (projects.projects[room] && projects.projects[room].project) {
    var project = projects.projects[room].project;

    db.init(function (err) {
      if(err) {
        console.error(err);
      }

      console.log("Initting db");

      db.get(room, function(err, value) {
        if (value && project && project.activeLayer) {
          socket.emit('loading:start');

          project.activeLayer.remove();
          project.importJSON(value.project);

          socket.emit('project:load', value);
        }

        socket.emit('loading:end');
        db.close(function(){});
      });

      socket.emit('loading:end'); // used for sending back a blank database in case we try to load from DB but no project exists
    });
  } 
  else {
    loadError(socket);
  }
}

exports.loadSingle = function(room, onLoaded) {
  if (projects.projects[room] && projects.projects[room].project) {

    var project = projects.projects[room].project;

    db.init(function (err) {
      if (err) {
        console.error(err);
      }

      db.get(room, function(err, value) {
        if (value && project && project.activeLayer) {
          project.activeLayer.remove();
          project.importJSON(value.project);
        }

        onLoaded(project);

        db.close(function(){});
      });
    });
  }
}
