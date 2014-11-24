var paper = require('paper');
var projects = require('./projects.js');
var db = require('./db.js');

projects = projects.projects;

// Create an in memory paper canvas
svgWidth = 10000;
svgHeight = 10000;

var drawing = paper.setup(new paper.Canvas(svgWidth, svgHeight));

Math.clip = function(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

// Continues to draw a path in real time
exports.progressExternalPath = function (room, points, artist) {
  var project = projects[room].project;
  project.activate();
  var path = projects[room].external_paths[artist];

  // The path hasn't already been started
  // So start it
  if (!path) {
    projects[room].external_paths[artist] = new drawing.Path();
    path = projects[room].external_paths[artist];

    // Starts the path
    var start_point = new drawing.Point(points.start[1], points.start[2]);
    var color = new drawing.Color(points.rgba.red, points.rgba.green, points.rgba.blue, points.rgba.opacity);
    if(points.tool == "draw") {
      path.fillColor = color;
    }
    else if (points.tool == "pencil") {
      path.strokeColor = color;
      path.strokeWidth = 2;
    } else { // assume tool is not supplied, set to 'draw' as default
      path.fillColor = color;
    }
    path.name = points.name;
    path.add(start_point);
  }

  // Draw all the points along the length of the path
  var paths = points.path;
  var length = paths.length;

  // console.log(drawing);
  
  for (var i = 0; i < length; i++) {
    paths[i].top[1] = Math.clip(paths[i].top[1], 0, svgWidth);
    paths[i].top[2] = Math.clip(paths[i].top[2], 0, svgHeight);
    paths[i].bottom[1] = Math.clip(paths[i].bottom[1], 0, svgWidth);
    paths[i].bottom[2] = Math.clip(paths[i].bottom[2], 0, svgHeight);

    path.add(new drawing.Point(paths[i].top[1], paths[i].top[2]));
    path.insert(0, new drawing.Point(paths[i].bottom[1], paths[i].bottom[2]));
  }

  path.smooth();
  project.view.draw();
};

exports.endExternalPath = function (room, points, artist) {
  var project = projects[room].project;
  project.activate();

  var path = projects[room].external_paths[artist];

  if (path) {
    points.end[1] = Math.clip(points.end[1], 0, svgWidth);
    points.end[2] = Math.clip(points.end[2], 0, svgHeight);

    // Close the path
    path.add(new drawing.Point(points.end[1], points.end[2]));
    path.closed = true;
    path.smooth();
    project.view.draw();
    
    // Remove the old data
    projects[room].external_paths[artist] = false;
  }

  db.storeProject(room);
};

exports.clearCanvas = function (room) {
  var project = projects[room].project;

  if (project && project.activeLayer && project.activeLayer.hasChildren()) {
    // Remove all but the active layer
    if (project.layers.length > 1) {
      var activeLayerID = project.activeLayer._id;
      for (var i=0; i<project.layers.length; i++) {
        if (project.layers[i]._id != activeLayerID) {
          project.layers[i].remove();
          i--;
        }
      }
    }
    
    // Remove all of the children from the active layer
    if (project && project.activeLayer && project.activeLayer.hasChildren()) {
      project.activeLayer.removeChildren();
    }

    db.storeProject(room);
  }
}

// Remove an item from the canvas
exports.removeItem = function (room, artist, itemName) {
  var project = projects[room].project;

  if (project && project.activeLayer && 
    project.activeLayer._namedChildren[itemName] && 
    project.activeLayer._namedChildren[itemName][0]) { 
    // should only remove if artist is the one who drew it
    project.activeLayer._namedChildren[itemName][0].remove();
    db.storeProject(room);
  }
}

exports.getDrawing = function (room, onLoaded) {
  var project = projects[room];
  onLoaded(project.project);
}