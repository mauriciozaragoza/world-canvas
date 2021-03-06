tool.minDistance = 10;
tool.maxDistance = 45;

var scaleFactor = 1.1,
  maxZoom = 25,
  minZoom = 0.5,
  boundary = new Rectangle(0, 0, 10000, 10000);

timers = {
  move: 500,
  path: 1000
};

function pickColor(color) {
  $('#color').val(color);
  var rgb = hexToRgb(color);
  $('#activeColorSwatch').css('background-color', 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')');
  update_active_color();
}

/*http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb*/
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}


$(document).ready(function() {
  var drawurl = window.location.href.split("?")[0]; // get the drawing url

  $('#embedinput').val("<iframe name='embed_readwrite' src='" + drawurl + "?showControls=true&showChat=true&showLineNumbers=true&useMonospaceFont=false' width=600 height=400></iframe>"); // write it to the embed input
  $('#linkinput').val(drawurl); // and the share/link input
  $('#drawTool > a').css({background:"#eee"}); // set the drawtool css to show it as active

  $('#myCanvas').on('mousewheel', function(ev){
    scrolled(ev.pageX, ev.pageY, ev.deltaY * ev.deltaFactor);
  });

  console.log("colorpicker");
  $('#colorpicker').farbtastic(pickColor); // make a color picker

  var rect = new Rectangle(0, 0, 10000, 10000);
  var path = new Path.Rectangle(rect);
  path.fillColor = '#fff';

  $('body').on('contextmenu', '#myCanvas', function(e){ return false; });

  // view.center = new Point(5000, 5000);

  // $('#myCanvas').bind('DOMMouseScroll', function(ev, delta){
  //   scrolled(ev.pageX, ev.pageY, ev.detail);
  // });


});

function scrolled(x, y, delta) {
  var pt = new Point(x, y),
    scale = 1;

  if (delta < 0 && view.zoom < maxZoom) {
    scale *= scaleFactor;
  } 
  else if (delta > 0 && view.zoom > minZoom) {
    scale /= scaleFactor;
  }
  
  view.zoom *= scale;
  
  view.draw();
}

$('#activeColorSwatch').css('background-color', $('.colorSwatch.active').css('background-color'));

// Initialise Socket.io
var socket = io.connect('/');

// Random User ID
// Used when sending data
var uid = (function () {
  var S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}());

function getParameterByName(name)
{ 
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var results = regex.exec(window.location.search);
  if(results == null) {
    return "";
  }
  else {
    return decodeURIComponent(results[1].replace(/\+/g, " "));
  }
}

// Join the room
var room = window.location.pathname.split("/")[2];
socket.emit('subscribe', { room: room });

// JSON data ofthe users current drawing
// Is sent to the user
var path_to_send = {};

// Calculates colors
var active_color_rgb;
var active_color_json = {};
var $opacity = $('#opacityRangeVal');
var update_active_color = function () {
  var rgb_array = $('#activeColorSwatch').css('background-color');
  $('#editbar').css("border-bottom", "solid 2px " + rgb_array);

  while(rgb_array.indexOf(" ") > -1) {
    rgb_array = rgb_array.replace(" ", "");
  }
  rgb_array = rgb_array.substr(4, rgb_array.length-5);
  rgb_array = rgb_array.split(',');
  var red = rgb_array[0] / 255;
  var green = rgb_array[1] / 255;
  var blue = rgb_array[2] / 255;
  var opacity = $opacity.val() / 255;

  active_color_rgb = new RgbColor(red, green, blue, opacity);
  active_color_rgb._alpha = opacity;
  active_color_json = {
    "red": red || 0,
    "green": green,
    "blue": blue,
    "opacity": opacity
  };
};

// Get the active color from the UI eleements
var authorColor = getParameterByName('authorColor');
var authorColors = {};
if (authorColor != "" && authorColor.substr(0,4) == "rgb(") {
  authorColor = authorColor.substr(4, authorColor.indexOf(")")-4);
  authorColors = authorColor.split(",");
  $('#activeColorSwatch').css('background-color', 'rgb(' + authorColors[0] + ',' + authorColors[1] + ',' + authorColors[2] + ')');
}
update_active_color();





// --------------------------------- 
// DRAWING EVENTS


var send_paths_timer;
var timer_is_active = false;
var paper_object_count = 0;
var activeTool = "draw";
var mouseHeld; // global timer for if mouse is held.

function onMouseDown(event) {
  if(event.which === 2) {
    // panning
    return;
  }

  $('.popup').fadeOut();

  // Ignore middle or right mouse button clicks for now
  if (event.event.button == 1 || event.event.button == 2) {
    
    return;
  }
  
  if (activeTool == "draw" || activeTool == "pencil") {
    if (!boundary.contains(event.middlePoint)) {
      return;
    }

    var point = event.point;
    path = new Path();
    if(activeTool == "draw"){
      path.fillColor = active_color_rgb;
    }
    else if(activeTool == "pencil"){
      path.strokeColor = active_color_rgb;
      path.strokeWidth = 2;
    }
    path.add(event.point);
    path.name = uid + ":" + (++paper_object_count);
    view.draw();

    // The data we will send every 100ms on mouse drag
    path_to_send = {
      name: path.name,
      rgba: active_color_json,
      start: event.point,
      path: [],
      tool: activeTool
    };
  } else if (activeTool == "select") {
    // Select item
    $("#myCanvas").css("cursor","pointer");
    if (event.item) {
      // If holding shift key down, don't clear selection - allows multiple selections
      if (!event.event.shiftKey) {
        paper.project.activeLayer.selected = false;
      }
      event.item.selected = true;
      view.draw();
    } else {
      paper.project.activeLayer.selected = false;
    }
  }
}


function onMouseDrag(event) {
  mouseTimer = 0;
  clearInterval(mouseHeld);

  if (event.event.button == 1 || event.event.button == 2) {
    view.center -= event.delta;

    if (!boundary.contains(view.center)) {
      view.center += event.delta;
    }

    return;
  }

  // defines the width of the brush stroke
  var step = event.delta / 2;
  step.angle += 90;

  if (activeTool == "draw" || activeTool == "pencil") {
    if (!boundary.contains(event.middlePoint)) {
      return;
    }

    if(activeTool == "draw"){
      var top = event.middlePoint + step;
      var bottom = event.middlePoint - step;
    } 
    else if (activeTool == "pencil") {
      var top = event.middlePoint;
      bottom = event.middlePoint;
    }

    path.add(top);
    path.insert(0, bottom);
    path.smooth();
    view.draw();

    // Add data to path
    path_to_send.path.push({
      top: top,
      bottom: bottom
    });

    // Send paths every second
    if (!timer_is_active) {
      send_paths_timer = setInterval(function () {
        socket.emit('draw:progress', room, uid, JSON.stringify(path_to_send));
        path_to_send.path = new Array();
      }, timers.path);
    }

    timer_is_active = true;
  }
}


function onMouseUp(event) {
  // Ignore middle or right mouse button clicks for now
  if (event.event.button == 1 || event.event.button == 2) {
    return;
  }
  clearInterval(mouseHeld);

  if (activeTool == "draw" || activeTool == "pencil") {
    // Close the users path
    if (boundary.contains(event.point)) {
      path.add(event.point);
    }

    path.closed = true;
    path.smooth();
    view.draw();

    // Send the path to other users
    path_to_send.end = event.point;
    // This covers the case where paths are created in less than 100 seconds
    // it does add a duplicate segment, but that is okay for now.
    socket.emit('draw:progress', room, uid, JSON.stringify(path_to_send));
    socket.emit('draw:end', room, uid, JSON.stringify(path_to_send));

    // Stop new path data being added & sent
    clearInterval(send_paths_timer);
    path_to_send.path = new Array();
    timer_is_active = false;
  } 
}

function onKeyUp(event) {
  if (event.key == "delete") {
    // Delete selected items
    var items = paper.project.selectedItems;
    if (items) {
      for (x in items) {
        var item = items[x];
        socket.emit('item:remove', room, uid, item.name);
        item.remove();
        view.draw();
      }
    }
  }
}

// Drop image onto canvas to upload it
$('#myCanvas').bind('dragover dragenter', function(e) {
  e.preventDefault();
});

// --------------------------------- 
// CONTROLS EVENTS

var $color = $('.colorSwatch:not(#pickerSwatch)');
$color.on('click', function () {

  $color.removeClass('active');
  $(this).addClass('active');
  $('#activeColorSwatch').css('background-color', $(this).css('background-color'));
  update_active_color();

});

$('#pickerSwatch').on('click', function() {
  $('#myColorPicker').fadeToggle();
});
$('#settingslink').on('click', function() {
  $('#settings').fadeToggle();
});
$('#embedlink').on('click', function() {
  $('#embed').fadeToggle();
});
$('#importExport').on('click', function() {
  $('#importexport').fadeToggle();
});
$('#usericon').on('click', function() {
  $('#mycolorpicker').fadeToggle();
});
$('#clearCanvas').on('click', function() {
  clearCanvas();
  socket.emit('canvas:clear', room);
});
$('#exportSVG').on('click', function() {
  exportSVG();
});
$('#exportPNG').on('click', function() {
  exportPNG();
});

$('#pencilTool').on('click', function() {
  $('#editbar > ul > li > a').css({background:""}); // remove the backgrounds from other buttons
  $('#pencilTool > a').css({background:"#eee"}); // set the selecttool css to show it as active
  activeTool = "pencil";
  $('#myCanvas').css('cursor', 'pointer');
  paper.project.activeLayer.selected = false;
});
$('#drawTool').on('click', function() {
  $('#editbar > ul > li > a').css({background:""}); // remove the backgrounds from other buttons
  $('#drawTool > a').css({background:"#eee"}); // set the selecttool css to show it as active
  activeTool = "draw";
  $('#myCanvas').css('cursor', 'pointer');
  paper.project.activeLayer.selected = false;
});
$('#selectTool').on('click', function() {
  $('#editbar > ul > li > a').css({background:""}); // remove the backgrounds from other buttons
  $('#selectTool > a').css({background:"#eee"}); // set the selecttool css to show it as active
  activeTool = "select";
  $('#myCanvas').css('cursor', 'default');
});

$('#uploadImage').on('click', function() {
  $('#imageInput').click();
});

function clearCanvas() {
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
  if (paper.project.activeLayer && paper.project.activeLayer.hasChildren()) {
    paper.project.activeLayer.removeChildren();
  }
  view.draw();
}

function exportSVG() {
  var svg = paper.project.exportSVG();
  encodeAsImgAndLink(svg);
}

// Encodes svg as a base64 text and opens a new browser window
// to the svg image that can be saved as a .svg on the users
// local filesystem. This skips making a round trip to the server
// for a POST.
function encodeAsImgAndLink(svg){
  if ($.browser.msie) {
    // Add some critical information
    svg.setAttribute('version', '1.1');
    var dummy = document.createElement('div');
    dummy.appendChild(svg);
    window.winsvg = window.open('/views/export.html');
    window.winsvg.document.write(dummy.innerHTML);
    window.winsvg.document.body.style.margin = 0;
  } else {
    // Add some critical information
    svg.setAttribute('version', '1.1');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    var dummy = document.createElement('div');
    dummy.appendChild(svg);

    var b64 = Base64.encode(dummy.innerHTML);

    //window.winsvg = window.open("data:image/svg+xml;base64,\n"+b64);
    var html = "<img style='height:100%;width:100%;' src='data:image/svg+xml;base64," + b64 + "' />"
    window.winsvg = window.open();
    window.winsvg.document.write(html);
    window.winsvg.document.body.style.margin = 0;
  }
}

// Encodes png as a base64 text and opens a new browser window
// to the png image that can be saved as a .png on the users
// local filesystem. This skips making a round trip to the server
// for a POST.
function exportPNG() {
  var canvas = document.getElementById('myCanvas');
  var html = "<img src='" + canvas.toDataURL('image/png') + "' />"
  if ($.browser.msie) {
    window.winpng = window.open('/views/export.html');
    window.winpng.document.write(html);
    window.winpng.document.body.style.margin = 0;
  } else {
    window.winpng = window.open();
    window.winpng.document.write(html);
    window.winpng.document.body.style.margin = 0;
  }
}

// User selects an image from the file browser to upload
$('#imageInput').bind('change', function(e) {
  // Get selected files
  var files = document.getElementById('imageInput').files;
  for (var i=0; i<files.length; i++) {
    var file = files[i];
    uploadImage(file);
  }
});

// --------------------------------- 
// SOCKET.IO EVENTS


socket.on('draw:progress', function (artist, data) {

  // It wasnt this user who created the event
  if (artist !== uid && data) {
    progress_external_path(JSON.parse(data), artist);
  }

});

socket.on('draw:end', function (artist, data) {

  // It wasnt this user who created the event
  if (artist !== uid && data) {
    end_external_path(JSON.parse(data), artist);
  }

});

socket.on('user:connect', function (user_count) {
  console.log("user:connect");
  update_user_count(user_count);
});

socket.on('user:disconnect', function (user_count) {
  update_user_count(user_count);
});

socket.on('project:load', function (json) {
  console.log("project:load");
  // paper.project.activeLayer.remove();
  paper.project.importJSON(json.project);

  // Make sure the range event doesn't propogate to pep
  $('#opacityRangeVal').on('touchstart MSPointerDown mousedown', function(ev){
    ev.stopPropagation(); 
  }).on('change', function(ev){
    update_active_color();
  })

  view.draw();
  $.get("/img/wheel.png");
});

socket.on('project:load:error', function() {
  $('#lostConnection').show();
});

socket.on('canvas:clear', function() {
  clearCanvas();
});

socket.on('loading:start', function() {
  console.log("loading:start");
  $('#loading').show();
});

socket.on('loading:end', function() {
  console.log("loading:end");
  $('#loading').hide();
});

socket.on('item:remove', function(artist, name) {
  if (artist != uid && paper.project.activeLayer._namedChildren[name][0]) {
    paper.project.activeLayer._namedChildren[name][0].remove();
    view.draw();
  }
});

// --------------------------------- 
// SOCKET.IO EVENT FUNCTIONS


// Updates the active connections
var $user_count = $('#online_count');

function update_user_count(count) {
  $user_count.text((count === 1) ? "1" : " " + count);
}

var external_paths = {};

// Ends a path
var end_external_path = function (points, artist) {

  var path = external_paths[artist];

  if (path) {

    // Close the path
    path.add(new Point(points.end[1], points.end[2]));
    path.closed = true;
    path.smooth();
    view.draw();
	
    // Remove the old data
    external_paths[artist] = false;

  }

};

// Continues to draw a path in real time
progress_external_path = function (points, artist) {

  var path = external_paths[artist];

  // The path hasnt already been started
  // So start it
  if (!path) {

    // Creates the path in an easy to access way
    external_paths[artist] = new Path();
    path = external_paths[artist];

    // Starts the path
    var start_point = new Point(points.start[1], points.start[2]);
    var color = new RgbColor(points.rgba.red, points.rgba.green, points.rgba.blue, points.rgba.opacity);
    if(points.tool == "draw"){
      path.fillColor = color;
    }
    else if(points.tool == "pencil"){
      path.strokeColor = color;
      path.strokeWidth = 2;
    }

    path.name = points.name;
    path.add(start_point);

  }

  // Draw all the points along the length of the path
  var paths = points.path;
  var length = paths.length;
  for (var i = 0; i < length; i++) {

    path.add(new Point(paths[i].top[1], paths[i].top[2]));
    path.insert(0, new Point(paths[i].bottom[1], paths[i].bottom[2]));

  }

  path.smooth();
  view.draw();

};
