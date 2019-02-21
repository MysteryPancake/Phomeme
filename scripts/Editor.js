"use strict";

//var json;
var player;
//var canvas;
//var sample;
//var context;
//var frame = 0;
var fileList = [];
var sampleRate = 44100;
//var requestFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(e) { return window.setTimeout(e, 1000 / 60); };
//var cancelFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.oCancelAnimationFrame || window.msCancelAnimationFrame || function(id) { window.clearTimeout(id); };

function setup() {
	addFile({ name: "Untitled Session.phomeme" }); // do proper one later
	//canvas = document.getElementById("canvas");
	//context = canvas.getContext("2d", { alpha: false });
	//window.addEventListener("resize", resize);
	//window.addEventListener("orientationchange", resize);
	//resize();
	//frame = requestFrame(draw);
	//window.addEventListener("wheel", wheel);
	/*if (window.ontouchstart) {
		window.addEventListener("touchstart", clicked);
		window.addEventListener("touchmove", moved);
		window.addEventListener("touchend", ended);
	} else {
		window.addEventListener("mousedown", clicked);
		window.addEventListener("mousemove", moved);
		window.addEventListener("mouseup", ended);
	}*/
	/*var audioRequest = new XMLHttpRequest();
	audioRequest.open("GET", "donkeykong/input.wav", true);
	audioRequest.responseType = "arraybuffer";
	audioRequest.onreadystatechange = function() {
		if (this.readyState === 4 && this.status === 200) {
			player.decodeAudioData(this.response, function(buffer) {
				sample = { buffer: buffer, data: buffer.getChannelData(0) };
			});
		}
	};
	audioRequest.send();
	var jsonRequest = new XMLHttpRequest();
	jsonRequest.open("GET", "donkeykong/complete.json", true);
	jsonRequest.onreadystatechange = function() {
		if (this.readyState === 4 && this.status === 200) {
			json = JSON.parse(this.responseText);
		}
	};
	jsonRequest.send();*/
}

function setupAudio() {
	player = new (window.AudioContext || window.webkitAudioContext)();
	sampleRate = player.sampleRate;
}

function toggle(element) {
	var dropdown = element.nextSibling.nextSibling;
	var previous = dropdown.style.display;
	closeMenus();
	dropdown.style.display = previous === "block" ? "none" : "block";
}

function addFile(file) {
	var listed = document.createElement("a");
	listed.draggable = true;
	listed.innerHTML = file.name;
	document.getElementById("sidenav").appendChild(listed);
	fileList.push(file);
}

function closeMenus() {
	var dropdowns = document.getElementsByClassName("dropcontent");
	for (var i = 0; i < dropdowns.length; i++) {
		dropdowns[i].style.display = "none";
	}
}

function newSession() {
	var sessionName = window.prompt("Please enter a session name", "Untitled Session");
	if (sessionName) {
		addFile({ name: sessionName + ".phomeme" }); // make this a proper file later
	}
}

function loadSession(element) {
	console.log(element.files[0]);
}

function importFile(element) {
	var file = element.files[0];
	if (file) {
		addFile(file);
	}
}

window.onclick = function(e) {
	if (!e.target.matches(".dropbutton")) {
		closeMenus();
	}
}

/*function resize() {
	cancelFrame(frame);
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	frame = requestFrame(draw);
}

function drawLine(context, x, y, x2, y2) {
	context.beginPath();
	context.moveTo(x, y);
	context.lineTo(x2, y2);
	context.stroke();
}

var offset = 0;
var scale = 500;
var yPos = 64;
var height = 256;
var scrollHeight = 64;
var dragging = false;

function drawBoxes(json, audio) {
	if (json) {
		context.font = "16px Courier New";
		context.textAlign = "center";
		for (var i = 0; i < json.words.length; i++) {
			var word = json.words[i];
			if (word.case === "not-found-in-audio") continue;
			if (word.active) {
				context.fillStyle = "#004000";
				var start = word.start * scale - offset;
				context.fillRect(start, yPos + 20, -scale * (word.active - player.currentTime), height - 40);
			}
			context.lineWidth = 1;
			context.fillStyle = "white";
			context.strokeStyle = "#004000";
			if (word.phones) {
				context.textBaseline = "bottom";
				var duration = word.start * scale;
				for (var j = 0; j < word.phones.length; j++) {
					var phone = word.phones[j].phone.split("_")[0].toUpperCase();
					var length = word.phones[j].duration * scale;
					drawLine(context, duration - offset, yPos + 20, duration - offset, yPos + height);
					drawLine(context, duration + length - offset, yPos + 20, duration + length - offset, yPos + height);
					context.fillText(phone, duration + length * 0.5 - offset, yPos + height);
					duration += length;
				}
			}
			context.lineWidth = 2;
			context.strokeStyle = "#00FF00";
			drawLine(context, word.start * scale - offset, yPos, word.start * scale - offset, yPos + height);
			drawLine(context, word.end * scale - offset, yPos, word.end * scale - offset, yPos + height);
			context.textBaseline = "top";
			var difference = (word.end - word.start) * 0.5;
			context.fillText(word.word, scale * (word.start + difference) - offset, yPos);
		}
	}
	if (audio) {
		var detail = 2;
		var lines = canvas.width * detail;
		context.lineWidth = 1;
		context.strokeStyle = "white";
		context.beginPath();
		for (var k = 0; k < lines; k++) {
			var x = k / lines * canvas.width;
			var y = yPos + height * 0.5;
			var index = audio[Math.floor((k / detail + offset) * (sampleRate / scale))];
			context.lineTo(x, y + 0.5 * height * (index || 0));
		}
		context.stroke();
	}
	context.lineWidth = 2;
	context.strokeStyle = "#00FF00";
	drawLine(context, 0, yPos + 20, canvas.width, yPos + 20);
	drawLine(context, 0, yPos + height - 20, canvas.width, yPos + height - 20);
}

function drawScroll(audio) {
	context.lineWidth = 2;
	context.strokeStyle = "#00FF00";
	context.strokeRect(0, 0, canvas.width, scrollHeight);
	if (!audio) return;
	context.lineWidth = 1;
	context.strokeStyle = "white";
	context.beginPath();
	var lines = canvas.width * 8;
	for (var k = 0; k < lines; k++) {
		var x = k / lines * canvas.width;
		var y = scrollHeight * 0.5;
		var index = audio[Math.floor(k / lines * audio.length)];
		context.lineTo(x, y + scrollHeight * (index || 0));
	}
	context.stroke();
	context.lineWidth = 2;
	context.strokeStyle = "#00FF00";
	var position = (offset * sampleRate * canvas.width) / (scale * audio.length);
	var size = (sampleRate * canvas.width * canvas.width) / (scale * audio.length);
	context.strokeRect(position, 0, size, scrollHeight);
}

function clamp(offset) {
	if (sample) {
		return Math.min(Math.max(offset, 0), sample.data.length * scale / sampleRate - canvas.width);
	} else {
		return Math.max(offset, 0);
	}
}

function wheel(e) {
	e.preventDefault();
	offset = clamp(offset + e.deltaX);
}

function clicked(e) {
	e.preventDefault();
	if (!json || !json.words) return;
	if (e.pageY > yPos && e.pageY < yPos + height) {
		var match;
		for (var i = 0; i < json.words.length; i++) {
			var word = json.words[i];
			var start = word.start * scale - offset;
			var end = word.end * scale - offset;
			if (near(e.pageX, start)) {
				dragging = { key: word, value: "start" };
				canvas.style.cursor = "col-resize";
			} else if (near(e.pageX, end)) {
				dragging = { key: word, value: "end" };
				canvas.style.cursor = "col-resize";
			} else if (e.pageX > start && e.pageX < end) {
				match = word;
			}
		}
		if (match !== undefined) {
			var source = player.createBufferSource();
			source.buffer = sample && sample.buffer;
			source.connect(player.destination);
			var duration = match.end - match.start;
			source.start(0, match.start, duration);
			match.active = player.currentTime;
			window.setTimeout(function() {
				match.active = false;
			}, duration * 1000);
		}
	} else if (e.pageY < scrollHeight) {
		if (!sample) return;
		var start = (offset * sampleRate * canvas.width) / (sample.data.length * scale);
		var end = (canvas.width * sampleRate * canvas.width) / (sample.data.length * scale);
		if (near(e.pageX, start)) {
			dragging = { initial: offset, direction: true };
		} else if (near(e.pageX, start + end)) {
			dragging = { initial: offset, direction: false };
		} else {
			offset = clamp((e.pageX * sample.data.length * scale) / (sampleRate * canvas.width) - (0.5 * canvas.width));
			canvas.style.cursor = "grabbing";
			dragging = true;
		}
	}
}

function near(x, y) {
	return x > y - 4 && x < y + 4;
}

function moved(e) {
	e.preventDefault();
	if (!json || !json.words) return;
	if (!dragging && e.pageY > yPos && e.pageY < yPos + height) {
		var hovering = false;
		for (var i = 0; i < json.words.length; i++) {
			var word = json.words[i];
			var start = word.start * scale - offset;
			var end = word.end * scale - offset;
			if (near(e.pageX, start) || near(e.pageX, end)) {
				hovering = true;
			}
		}
		canvas.style.cursor = hovering ? "col-resize" : "auto";
	} else if (!dragging && e.pageY < scrollHeight) {
		if (!sample) return;
		var start = (offset * sampleRate * canvas.width) / (sample.data.length * scale);
		var end = (sampleRate * canvas.width * canvas.width) / (sample.data.length * scale);
		if (near(e.pageX, start) || near(e.pageX, start + end)) {
			canvas.style.cursor = "col-resize";
		} else {
			canvas.style.cursor = "grab";
		}
	} else {
		canvas.style.cursor = "auto";
	}
	if (dragging) {
		if (dragging.key) {
			dragging.key[dragging.value] = (e.pageX + offset) / scale;
			canvas.style.cursor = "col-resize";
		} else if (dragging.direction !== undefined) {
			if (dragging.direction) {
				//offset = (offset / dragging.initial) * sampleRate;
				//scale = (sampleRate * canvas.width * canvas.width) / (sample.data.length * e.pageX); // todo
				//offset = clamp((e.pageX * sample.data.length * scale) / (sampleRate * canvas.width));
			} else {
				//scale = (sampleRate * canvas.width * canvas.width) / (sample.data.length * e.pageX);
				//offset = (dragging.initial / offset); // todo
			}
		} else {
			offset = clamp((e.pageX * sample.data.length * scale) / (sampleRate * canvas.width) - (0.5 * canvas.width));
			canvas.style.cursor = "grabbing";
		}
	}
}

function ended(e) {
	e.preventDefault();
	canvas.style.cursor = "auto";
	dragging = false;
}

function draw() {
	context.fillStyle = "#061306";
	context.fillRect(0, 0, canvas.width, canvas.height);
	drawBoxes(json, sample && sample.data);
	drawScroll(sample && sample.data);
	frame = requestFrame(draw);
}*/