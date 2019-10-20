"use strict";

let step1;
let step2;
let editor;
let player;
let tracks;
let mainNav;
let sideNav;
let zoomDrag;
let playhead;
let playlist;
let recorder;
let timeLabel;
let presetMenu;
let playButton;
let presetList;
let activeDrag;
let zoomCanvas;
let zoomContext;
let recognition;
let createTrack;
let draggedFile;
let activeSession;
let transcriptMenu;
let transcriptElem;
let timelineCanvas;
let timelineContext;
let transcriptPlayer;
let interimTranscript;
let finalTranscript;
let lastTopScroll = 0;
let lastLeftScroll = 0;
let timeOffset = 0;
let recordIndex = 1;
let sampleRate = 44100;
const fileList = [];
const peakScale = 0.7;
const waveDetail = 16;
let playheadTime = 0;
const minZoomWidth = 64;
const minClipWidth = 0.05;
let presetsLoaded = false;
let playlistSetup = false;
const requestFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(e) { return window.setTimeout(e, 1000 / 60); };

function pauseIfPlayingSession() {
	if (player && player.state === "running") {
		pauseSession();
	}
}

function restartPlayer() {
	player = new (window.AudioContext || window.webkitAudioContext)();
	sampleRate = player.sampleRate;
	player.suspend();
}

function fileBuffer(file, func) {
	const reader = new FileReader();
	reader.onload = function() {
		player.decodeAudioData(this.result, function(buffer) {
			func(buffer);
		});
	};
	reader.readAsArrayBuffer(file);
}

function readFile(file, func) {
	const reader = new FileReader();
	reader.onload = function() {
		func(this.result, file.name, file.type);
	};
	reader.readAsText(file, "UTF-8");
}

function padTime(num, size) {
	return ("000" + num).slice(-size);
}

function niceTime(timeInSeconds, detailed) {
	const time = parseFloat(timeInSeconds).toFixed(3);
	const hours = Math.floor(time / 60 / 60);
	const minutes = Math.floor(time / 60) % 60;
	const seconds = Math.floor(time - minutes * 60);
	if (detailed) {
		const milliseconds = time.slice(-3);
		return padTime(hours, 1) + ":" + padTime(minutes, 2) + ":" + padTime(seconds, 2) + "." + padTime(milliseconds, 3);
	} else {
		return padTime(minutes, 1) + ":" + padTime(seconds, 2);
	}
}

function timeStringToSeconds(timeString) {
	let time = 0;
	const parts = timeString.split(":").reverse();
	const seconds = parseFloat(parts[0]);
	const minutes = parseFloat(parts[1]);
	const hours = parseFloat(parts[2]);
	if (!isNaN(seconds)) {
		time += seconds;
	}
	if (!isNaN(minutes)) {
		time += minutes * 60;
	}
	if (!isNaN(hours)) {
		time += hours * 3600;
	}
	return time;
}

function parseTime(elem) {
	pauseIfPlayingSession();
	timeOffset = Math.min(timeStringToSeconds(elem.innerHTML), activeSession.duration);
	setPlayhead(timeOffset, false);
}

function forceTime() {
	pauseIfPlayingSession();
	timeOffset = Math.min(timeStringToSeconds(timeLabel.innerHTML), activeSession.duration);
	setPlayhead(timeOffset, true);
}

function playSession() {
	if (!activeSession) return;
	playButton.value = "❚❚";
	activeSession.schedule();
	player.resume();
}

function pauseSession() {
	timeOffset += player.currentTime;
	playButton.value = "►";
	player.close();
	restartPlayer();
}

function togglePlayback() {
	if (!player) return;
	if (player.state === "running") {
		pauseSession();
	} else {
		playSession();
	}
}

function urlBuffer(url, func, err) {
	const audioRequest = new XMLHttpRequest();
	audioRequest.open("GET", url, true);
	audioRequest.responseType = "arraybuffer";
	audioRequest.onreadystatechange = function() {
		if (this.readyState === 4) {
			if (this.status === 200) {
				player.decodeAudioData(this.response, function(buffer) {
					func(buffer);
				});
			} else if (this.status === 404 && err) {
				err();
			}
		}
	};
	audioRequest.onerror = err;
	audioRequest.send();
}

function urlJson(url, func, err) {
	const jsonRequest = new XMLHttpRequest();
	jsonRequest.open("GET", url, true);
	jsonRequest.onreadystatechange = function() {
		if (this.readyState === 4) {
			if (this.status === 200) {
				func(JSON.parse(this.responseText));
			} else if (this.status === 404 && err) {
				err();
			}
		}
	};
	jsonRequest.onerror = err;
	jsonRequest.send();
}

function setPlayhead(seconds, updateLabel) {
	playheadTime = seconds;
	playhead.style.left = playheadTime * activeSession.zoom + "px";
	if (updateLabel) {
		timeLabel.innerHTML = niceTime(seconds, true);
	}
}

function updateZoomDragger() {
	zoomDrag.style.left = activeSession.zoomPosition() + "px";
	zoomDrag.style.width = activeSession.zoomWidth() + "px";
}

function updatePlaylistDuration() {
	let maxDuration = 0;
	for (let i = 0; i < activeSession.trackList.length; i++) {
		const track = activeSession.trackList[i];
		for (let j = 0; j < track.clips.length; j++) {
			const clip = track.clips[j];
			maxDuration = Math.max(maxDuration, clip.startTime + clip.outTime - clip.inTime);
		}
	}
	activeSession.setDuration(Math.max(playlist.scrollWidth / activeSession.zoom, maxDuration));
	updateZoomDragger();
	updateZoomCanvas();
}

function updatePlaylistZoom() {
	setPlayhead(playheadTime, false);
	for (let i = 0; i < activeSession.trackList.length; i++) {
		const track = activeSession.trackList[i];
		for (let j = 0; j < track.clips.length; j++) {
			track.clips[j].updateZoom();
		}
	}
}

function updateZoomCanvas() {
	zoomContext.fillStyle = "black";
	zoomContext.fillRect(0, 0, zoomCanvas.width, zoomCanvas.height);
	zoomContext.fillStyle = "#002000";
	const height = zoomCanvas.height / activeSession.trackList.length;
	for (let i = 0; i < activeSession.trackList.length; i++) {
		const track = activeSession.trackList[i];
		const y = i / activeSession.trackList.length * zoomCanvas.height;
		for (let j = 0; j < track.clips.length; j++) {
			const clip = track.clips[j];
			const x = clip.startTime / activeSession.duration * zoomCanvas.width;
			const width = (clip.outTime - clip.inTime) / activeSession.duration * zoomCanvas.width;
			zoomContext.fillRect(x, y, width, height);
		}
	}
}

function updateTimeCanvas() {
	timelineContext.fillStyle = "#061306";
	timelineContext.fillRect(0, 0, timelineCanvas.width, timelineCanvas.height);
	timelineContext.strokeStyle = "gray";
	timelineContext.lineWidth = 2;
	drawLine(timelineContext, 0, timelineCanvas.height, timelineCanvas.width, timelineCanvas.height);
	timelineContext.lineWidth = 1;
	timelineContext.fillStyle = "gray";
	timelineContext.textAlign = "left";
	timelineContext.textBaseline = "top";
	timelineContext.font = "bold 12px Arial";
	const notchCount = Math.ceil(timelineCanvas.width / activeSession.zoom);
	for (let i = 0; i < notchCount; i++) {
		let seconds = i;
		while (seconds * activeSession.zoom - mainNav.scrollLeft < -16) {
			seconds += notchCount;
		}
		const position = seconds * activeSession.zoom - mainNav.scrollLeft;
		drawLine(timelineContext, position, 4, position, timelineCanvas.height);
		timelineContext.fillText(niceTime(seconds, false), position + 4, 4);
	}
	timelineContext.fillStyle = "white";
	timelineContext.fillRect(playheadTime * activeSession.zoom - mainNav.scrollLeft, 0, 1, timelineCanvas.height);
}

function setupZoomCanvas() {
	zoomCanvas.width = zoomCanvas.clientWidth;
	zoomCanvas.height = zoomCanvas.clientHeight;
	zoomContext = zoomCanvas.getContext("2d", { alpha: false });
}

function setupTimeCanvas() {
	timelineCanvas.width = timelineCanvas.clientWidth;
	timelineCanvas.height = timelineCanvas.clientHeight;
	timelineContext = timelineCanvas.getContext("2d", { alpha: false });
}

function navScroll() {
	if (mainNav.scrollTop !== lastTopScroll) {
		playhead.style.top = mainNav.scrollTop + "px";
		lastTopScroll = mainNav.scrollTop;
	}
	if (activeSession && !activeDrag && mainNav.scrollLeft !== lastLeftScroll) {
		zoomDrag.style.left = activeSession.zoomPosition() + "px";
		lastLeftScroll = mainNav.scrollLeft;
	}
}

function setupZoomDraggers() {
	const zoomDragLeft = document.getElementById("zoomdragleft");
	zoomDragLeft.addEventListener("mousedown", function(e) {
		if (!isLeftClick(e)) return;
		e.preventDefault();
		e.stopPropagation();
		activeDrag = { type: "zoomdragleft", dragWidth: e.pageX, dragPosition: e.pageX - activeSession.zoomPosition(), lastWidth: activeSession.zoomWidth(), lastPosition: zoomCanvas.width * (mainNav.scrollLeft + zoomCanvas.width) / activeSession.pixelWidth() };
	});
	const zoomDragRight = document.getElementById("zoomdragright");
	zoomDragRight.addEventListener("mousedown", function(e) {
		if (!isLeftClick(e)) return;
		e.preventDefault();
		e.stopPropagation();
		activeDrag = { type: "zoomdragright", drag: e.pageX, lastWidth: activeSession.zoomWidth(), lastScroll: mainNav.scrollLeft / activeSession.zoom };
	});
	zoomDrag.addEventListener("mousedown", function(e) {
		if (!isLeftClick(e)) return;
		activeDrag = { type: "zoomdrag", drag: e.pageX - activeSession.zoomPosition() };
	});
}

function draw() {
	if (player && player.state === "running") {
		const time = timeOffset + player.currentTime;
		if (time > activeSession.duration) {
			pauseIfPlayingSession();
		} else {
			setPlayhead(time, true);
		}
	}
	if (timelineContext) {
		updateTimeCanvas();
	}
	requestFrame(draw);
}

function drawLine(context, x, y, x2, y2) {
	context.beginPath();
	context.moveTo(x, y);
	context.lineTo(x2, y2);
	context.stroke();
}

function ensurePlayer() {
	if (!player) {
		restartPlayer();
	}
}

function isLeftClick(e) {
	return e.which === 1 || e.button === 0;
}

function addDragger(clip, left) {
	const elem = document.createElement("div");
	elem.className = left ? "clipdragleft" : "clipdragright";
	clip.parent.appendChild(elem);
	const dragger = { clip: clip, drag: 0, type: "clipdragger", left: left };
	elem.addEventListener("mousedown", function(e) {
		if (!isLeftClick(e)) return;
		e.preventDefault();
		activeDrag = dragger;
		if (left) {
			dragger.drag = {
				in: e.pageX - (clip.inTime * clip.session.zoom),
				start: e.pageX - (clip.startTime * clip.session.zoom),
				lastStart: clip.startTime - clip.inTime
			};
		} else {
			dragger.drag = e.pageX - (clip.outTime * clip.session.zoom);
		}
	});
}

function Session(name) {
	this.zoom = 100;
	this.duration = 0;
	this.realName = name;
	this.name = name + ".phomeme";
	this.type = "application/json";
	this.trackList = [];
	this.schedule = function() {
		for (let i = 0; i < this.trackList.length; i++) {
			for (let j = 0; j < this.trackList[i].clips.length; j++) {
				const clip = this.trackList[i].clips[j];
				const duration = clip.outTime - clip.inTime - Math.max(0, timeOffset - clip.startTime);
				if (duration > 0) {
					const bufferNode = player.createBufferSource();
					//bufferNode.playbackRate.value = 1 / clip.scale;
					bufferNode.buffer = clip.audioBuffer;
					bufferNode.connect(player.destination);
					//bufferNode.start(Math.max(0, clip.startTime - timeOffset), Math.max(0, (-clip.startTime + timeOffset) / clip.scale), clip.duration);
					let when = clip.startTime - timeOffset;
					let offset = clip.inTime;
					if (when < 0) {
						offset -= when;
						when = 0;
					}
					bufferNode.start(when, offset, duration);
				}
			}
		}
	};
	this.addTrack = function() {
		const track = new Track(this);
		this.trackList.push(track);
		return track;
	};
	this.pixelWidth = function() {
		return this.duration * this.zoom;
	};
	this.zoomPosition = function() {
		return mainNav.scrollLeft / this.pixelWidth() * zoomCanvas.width;
	};
	this.zoomWidth = function() {
		return (zoomCanvas.width * zoomCanvas.width) / this.pixelWidth();
	};
	this.setActive = function() {
		if (activeSession) {
			pauseIfPlayingSession();
			for (let i = 0; i < activeSession.trackList.length; i++) {
				activeSession.trackList[i].elem.style.display = "none";
			}
		}
		for (let j = 0; j < this.trackList.length; j++) {
			this.trackList[j].elem.style.display = "flex";
		}
		playlist.style.width = this.pixelWidth() + "px";
		activeSession = this;
		setMenu("editor");
	};
	this.setDuration = function(time) {
		this.duration = time;
		playlist.style.width = time * this.zoom + "px";
	};
	this.setZoom = function(zoom) {
		this.zoom = zoom;
		playlist.style.width = this.pixelWidth() + "px";
		updatePlaylistZoom();
	}
	this.addTrack();
}

function Clip(clipFile, clipTrack, clipSession) {
	this.session = clipSession;
	this.drag = 0;
	//this.scale = 1;
	this.audioData;
	this.type = "clip";
	this.audioBuffer;
	this.duration = 0;
	this.track = clipTrack;
	this.inTime = 0;
	this.outTime = 0;
	this.startTime = 0;
	this.elem = document.createElement("canvas");
	this.elem.className = "clip";
	this.elem.width = "128";
	this.elem.height = "128";
	this.parent = document.createElement("div");
	this.parent.className = "clipdiv";
	this.parent.appendChild(this.elem);
	this.track.elem.appendChild(this.parent);
	addDragger(this, true);
	addDragger(this, false);
	this.context = this.elem.getContext("2d", { alpha: true });
	this.drawCanvas = function() {
		this.elem.width = this.duration * this.session.zoom;
		this.context.clearRect(0, 0, this.elem.width, this.elem.height);
		const lines = this.elem.width * waveDetail;
		this.context.lineWidth = 0.5;
		this.context.strokeStyle = "white";
		this.context.beginPath();
		for (let k = 0; k < lines; k++) {
			const x = k / lines * this.elem.width;
			const y = this.elem.height * 0.5;
			const index = this.audioData[Math.floor((k / waveDetail) * (sampleRate / this.session.zoom))];
			drawLine(this.context, x, y, x, y + (index || 0) * y * peakScale);
		}
		this.context.stroke();
		this.context.lineWidth = 1;
		this.context.strokeStyle = "#00FF00";
		drawLine(this.context, 0, 16, this.elem.width, 16);
		drawLine(this.context, 0, this.elem.height - 16, this.elem.width, this.elem.height - 16);
		this.imageData = this.context.getImageData(0, 0, this.elem.width, this.elem.height);
		//this.drawLabel();
	};
	/*this.drawLabel = function() {
		this.context.fillStyle = "white";
		this.context.textAlign = "center";
		this.context.textBaseline = "top";
		this.context.font = "12px Arial";
		this.context.fillText("TESTING", this.elem.width * 0.5, 4);
	};*/
	this.updateCanvas = function() {
		this.elem.width = (this.outTime - this.inTime) * this.session.zoom;
		this.context.putImageData(this.imageData, -this.inTime * this.session.zoom, 0);
		//this.drawLabel();
	};
	this.clicked = function(e) {
		if (!isLeftClick(e)) return;
		e.preventDefault();
		activeDrag = this;
		this.drag = e.pageX - (this.startTime * this.session.zoom);
	};
	this.elem.addEventListener("mousedown", this.clicked.bind(this));
	this.setOutTime = function(time) {
		this.outTime = time;
		updateZoomCanvas();
		this.updateCanvas();
	};
	this.setInTime = function(time) {
		this.inTime = time;
		updateZoomCanvas();
		this.updateCanvas();
	};
	this.updateZoom = function() {
		this.parent.style.left = this.startTime * this.session.zoom + "px";
		this.elem.style.width = (this.outTime - this.inTime) * this.session.zoom + "px";
	}
	/*this.setScale = function(scale) {
		this.scale = (scale + this.lastWidth) / this.elem.width;
		this.elem.style.width = this.scale * this.elem.width + "px";
	};*/
	this.drawLoading = function() {
		this.context.fillStyle = "white";
		this.context.textAlign = "center";
		this.context.textBaseline = "middle";
		this.context.font = "16px Arial";
		this.context.fillText("LOADING...", this.elem.width * 0.5, this.elem.height * 0.5);
	};
	this.loadFile = function(file) {
		ensurePlayer();
		this.drawLoading();
		fileBuffer(file, function(buffer) {
			this.audioData = buffer.getChannelData(0);
			this.audioBuffer = buffer;
			this.duration = buffer.duration;
			this.outTime = buffer.duration;
			updatePlaylistDuration();
			this.drawCanvas();
		}.bind(this));
	};
	this.loadFile(clipFile);
	this.changeTrack = function(track) {
		this.track.removeClip(this);
		track.addClip(this);
		this.track = track;
		track.elem.appendChild(this.parent);
	};
	this.setStart = function(time) {
		this.startTime = time;
		updatePlaylistDuration();
		this.parent.style.left = time * this.session.zoom + "px";
	};
}

function Track(trackSession) {
	this.clips = [];
	this.session = trackSession;
	this.elem = document.createElement("div");
	this.elem.className = "track";
	tracks.appendChild(this.elem);
	this.addClip = function(clip) {
		this.clips.push(clip);
	};
	this.loadClip = function(file) {
		pauseIfPlayingSession();
		const clip = new Clip(file, this, this.session);
		this.addClip(clip);
		return clip;
	};
	this.removeClip = function(clip) {
		const index = this.clips.indexOf(clip);
		if (index !== -1) {
			this.clips.splice(index, 1);
		}
	};
	this.moved = function(e) {
		if (activeDrag && activeDrag.type === "clip" && activeDrag.track !== this) {
			e.preventDefault();
			activeDrag.changeTrack(this);
		}
	};
	this.elem.addEventListener("mousemove", this.moved.bind(this));
	this.dragover = function(e) {
		if (draggedFile) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "copy";
		}
	};
	this.elem.addEventListener("dragover", this.dragover.bind(this));
	this.drop = function(e) {
		if (draggedFile) {
			e.preventDefault();
			const clip = this.loadClip(draggedFile);
			clip.setStart((e.clientX - this.elem.getBoundingClientRect().left) / this.session.zoom);
			draggedFile = undefined;
		}
	};
	this.elem.addEventListener("drop", this.drop.bind(this));
}

function listFile(file) {
	const elem = document.createElement("a");
	elem.draggable = true;
	elem.innerHTML = file.name;
	sideNav.appendChild(elem);
	elem.addEventListener("dragstart", function(e) {
		if (file.type.startsWith("audio")) {
			draggedFile = file;
			e.dataTransfer.setData("text/plain", "Firefox");
		}
	});
	elem.addEventListener("click", function() {
		elem.classList.toggle("active");
		if (file.trackList) {
			file.setActive();
		}
	});
	fileList.push({ file: file, elem: elem });
}

function closeMenus() {
	const dropdowns = document.getElementsByClassName("autoclose");
	for (let i = 0; i < dropdowns.length; i++) {
		dropdowns[i].style.display = "none";
	}
}

function movePlayhead(e) {
	timeOffset = (e.clientX - playlist.getBoundingClientRect().left) / activeSession.zoom;
	if (player) {
		timeOffset -= player.currentTime;
		pauseIfPlayingSession();
	}
	timeOffset = Math.max(0, timeOffset);
	setPlayhead(timeOffset, true);
}

function moved(e) {
	if (!activeDrag) return;
	pauseIfPlayingSession();
	if (activeDrag.type === "clip") {
		e.preventDefault();
		activeDrag.setStart((e.pageX - activeDrag.drag) / activeSession.zoom);
	} else if (activeDrag.type === "clipdragger") {
		e.preventDefault();
		if (activeDrag.left) {
			//activeDrag.clip.setScale(activeDrag.drag - e.pageX);
			const inTime = (e.pageX - activeDrag.drag.in) / activeSession.zoom;
			const minimum = activeDrag.clip.outTime - minClipWidth;
			if (inTime > minimum) {
				activeDrag.clip.setStart(activeDrag.drag.lastStart + minimum);
				activeDrag.clip.setInTime(minimum);
			} else if (inTime > 0) {
				activeDrag.clip.setStart((e.pageX - activeDrag.drag.start) / activeSession.zoom);
				activeDrag.clip.setInTime(inTime);
			} else {
				activeDrag.clip.setStart(activeDrag.drag.lastStart);
				activeDrag.clip.setInTime(0);
			}
		} else {
			const outTime = (e.pageX - activeDrag.drag) / activeSession.zoom;
			const maximum = activeDrag.clip.inTime + minClipWidth;
			if (outTime < maximum) {
				activeDrag.clip.setOutTime(maximum);
			} else if (outTime > activeDrag.clip.duration) {
				activeDrag.clip.setOutTime(activeDrag.clip.duration);
			} else {
				activeDrag.clip.setOutTime(outTime);
			}
			//activeDrag.clip.setScale(e.pageX - activeDrag.drag);
		}
	} else if (activeDrag.type === "zoomdrag") {
		e.preventDefault();
		const maxPosition = activeSession.zoomWidth();
		let position = e.pageX - activeDrag.drag;
		if (position < 0) {
			position = 0;
		} else if (position + maxPosition > zoomCanvas.width) {
			position = zoomCanvas.width - maxPosition;
		}
		zoomDrag.style.left = position + "px";
		mainNav.scrollLeft = (activeSession.pixelWidth() * position) / zoomCanvas.width;
	} else if (activeDrag.type === "zoomdragleft") {
		e.preventDefault();
		let position = e.pageX - activeDrag.dragPosition;
		let newWidth = activeDrag.lastWidth - (e.pageX - activeDrag.dragWidth);
		if (newWidth > zoomCanvas.width) {
			newWidth = zoomCanvas.width;
			position = 0;
		} else if (newWidth < minZoomWidth) {
			newWidth = minZoomWidth;
			position = activeDrag.lastPosition - minZoomWidth;
		}
		if (position < 0) {
			position = 0;
		} else if (position + newWidth > zoomCanvas.width) {
			position = zoomCanvas.width - newWidth;
		}
		zoomDrag.style.left = position + "px";
		zoomDrag.style.width = newWidth + "px";
		activeSession.setZoom((zoomCanvas.width / newWidth) * (zoomCanvas.width / activeSession.duration));
		mainNav.scrollLeft = (activeSession.pixelWidth() * position) / zoomCanvas.width;
	} else if (activeDrag.type === "zoomdragright") {
		e.preventDefault();
		let newWidth = activeDrag.lastWidth - (activeDrag.drag - e.pageX);
		if (newWidth > zoomCanvas.width) {
			newWidth = zoomCanvas.width;
		} else if (newWidth < minZoomWidth) {
			newWidth = minZoomWidth;
		}
		zoomDrag.style.width = newWidth + "px";
		activeSession.setZoom((zoomCanvas.width / newWidth) * (zoomCanvas.width / activeSession.duration));
		mainNav.scrollLeft = activeDrag.lastScroll * activeSession.zoom;
	} else if (activeDrag === "playhead") {
		e.preventDefault();
		movePlayhead(e);
	}
}

function ended() {
	activeDrag = undefined;
}

function annoy(e) {
	e.preventDefault();
	e.returnValue = "Unsaved changes";
}

function preventTimeInput(e) {
	if (e.keyCode === 32 || e.keyCode === 13) {
		e.preventDefault();
		timeLabel.blur();
		return false;
	}
}

function setup() {
	interimTranscript = document.getElementById("interimtranscript");
	transcriptPlayer = document.getElementById("transcriptplayer");
	finalTranscript = document.getElementById("finaltranscript");
	transcriptMenu = document.getElementById("transcriptmenu");
	transcriptElem = document.getElementById("transcript");
	timelineCanvas = document.getElementById("timeline");
	presetMenu = document.getElementById("presetmenu");
	createTrack = document.getElementById("addtrack");
	presetList = document.getElementById("presets");
	playlist = document.getElementById("playlist");
	playhead = document.getElementById("playhead");
	zoomDrag = document.getElementById("zoomer");
	zoomCanvas = document.getElementById("zoom");
	playButton = document.getElementById("play");
	sideNav = document.getElementById("sidenav");
	mainNav = document.getElementById("mainnav");
	timeLabel = document.getElementById("time");
	editor = document.getElementById("editor");
	tracks = document.getElementById("tracks");
	step1 = document.getElementById("step1");
	step2 = document.getElementById("step2");
	window.addEventListener("mousemove", moved);
	window.addEventListener("mouseup", ended);
	timeLabel.addEventListener("keydown", preventTimeInput);
	timeLabel.addEventListener("blur", forceTime);
	setupZoomDraggers();
	timelineCanvas.addEventListener("mousedown", function(e) {
		if (!isLeftClick(e)) return;
		activeDrag = "playhead";
	});
	timelineCanvas.addEventListener("click", movePlayhead);
	window.addEventListener("beforeunload", annoy);
	window.addEventListener("keydown", function(e) {
		if (e.keyCode === 32) {
			playButton.click();
			if (e.target === document.body) {
				e.preventDefault();
			}
		}
	});
	window.addEventListener("click", function(e) {
		if (!e.target.matches(".autoclosebutton")) {
			closeMenus();
		}
	});
	createTrack.addEventListener("dragover", function() {
		if (activeSession) {
			activeSession.addTrack();
		}
	});
	createTrack.addEventListener("mousemove", function() {
		if (activeSession && activeDrag && activeDrag.type === "clip") {
			activeDrag.changeTrack(activeSession.addTrack());
		}
	});
	requestFrame(draw);
}

function setMenu(name) {
	transcriptMenu.style.display = name === "transcript" ? "block" : "none";
	presetMenu.style.display = name === "preset" ? "block" : "none";
	editor.style.display = name === "editor" ? "block" : "none";
	step1.style.display = name === "step1" ? "block" : "none";
	step2.style.display = name === "step2" ? "block" : "none";
	if (name === "editor" && !playlistSetup) {
		setupPlaylist();
	}
}

function setupPlaylist() {
	activeSession.setDuration(playlist.scrollWidth / activeSession.zoom);
	setupZoomCanvas();
	setupTimeCanvas();
	playlistSetup = true;
}

function toggle(elem) {
	const dropdown = elem.nextElementSibling;
	const previous = dropdown.style.display;
	closeMenus();
	dropdown.style.display = previous === "block" ? "none" : "block";
}

function loadPresets() {
	if (presetsLoaded) {
		setMenu("preset");
	} else {
		urlJson("presets.json", function(presets) {
			presetsLoaded = true;
			setMenu("preset");
			for (let i = 0; i < presets.length; i++) {
				const panel = document.createElement("div");
				panel.className = "preset";
				const title = document.createElement("span");
				title.className = "presettitle";
				title.innerHTML = presets[i].name;
				panel.appendChild(title);
				const author = document.createElement("span");
				author.className = "presetauthor";
				author.innerHTML = "By " + presets[i].author;
				panel.appendChild(author);
				const desc = document.createElement("span");
				desc.className = "presetdesc";
				desc.innerHTML = presets[i].description;
				panel.appendChild(desc);
				panel.addEventListener("click", function() {
					urlJson(presets[i].url, function(response) {
						setMenu("step2");
						ensurePlayer();
						const elems = listPreset(presets[i].name);
						loadParts(response, elems, -1);
					}, function() {
						window.alert("Couldn't load " + presets[i].name + "! Try installing a cross-origin extension.");
					});
				});
				presetList.appendChild(panel);
			}
		}, function() {
			window.alert("Couldn't load presets! Try installing a cross-origin extension.");
		});
	}
}

function updateTranscriptPlayer(file) {
	const url = window.URL.createObjectURL(file);
	transcriptPlayer.style.display = "inline-block";
	transcriptPlayer.src = url;
}

function checkJson(elem) {
	const file = elem.files[0];
	if (!file) return;
	listFile(file);
	const lower = file.name.toLowerCase();
	if (lower.endsWith("json") || lower.endsWith("txt")) {
		readFile(file, function(content) {
			transcriptElem.value = lower.endsWith("txt") ? content : JSON.parse(content).transcript;
		});
	} else if (file.type.startsWith("audio")) {
		updateTranscriptPlayer(file);
	}
}

function goBack() {
	setMenu("step1");
}

function transcribe() {
	setMenu("transcript");
}

function newSession() {
	const sessionName = window.prompt("Please enter a session name", "Untitled Session");
	if (sessionName) {
		const session = new Session(sessionName);
		listFile(session);
		session.setActive();
	}
}

function loadSession(elem) {
	console.log(elem.files[0]);
	elem.value = null;
}

function importFile(elem) {
	for (let i = 0; i < elem.files.length; i++) {
		const file = elem.files[i];
		listFile(file);
	}
	elem.value = null;
}

function listPreset(name) {
	const parent = document.createElement("div");
	parent.className = "filefolder active";
	sideNav.appendChild(parent);
	const loader = document.createElement("div");
	loader.className = "presetprogress";
	parent.appendChild(loader);
	const preset = document.createElement("a");
	preset.innerHTML = name + " Preset";
	parent.appendChild(preset);
	const files = document.createElement("div");
	files.className = "filegroup";
	parent.appendChild(files);
	preset.addEventListener("click", function() {
		const previous = files.style.display;
		parent.classList.toggle("active");
		files.style.display = previous === "none" ? "block" : "none";
	});
	fileList.push({ elem: parent });
	return { bar: loader, list: files, parent: parent };
}

function addDetail(details, name) {
	const detail = document.createElement("span");
	detail.innerHTML = name;
	details.appendChild(detail);
}

function loadPart2(json, elems, details, file, index) {
	if (json[index].audio) {
		urlBuffer(json[index].audio, function() {
			elems.bar.style.width = (index + 1) / json.length * 100 + "%";
			addDetail(details, "AUDIO");
			loadParts(json, elems, index);
		}, function() {
			elems.parent.classList.add("error");
			file.classList.add("error");
			addDetail(details, "ERROR");
			loadParts(json, elems, index);
		});
	} else {
		loadParts(json, elems, index);
	}
}

function loadPart1(json, elems, details, file, index) {
	if (json[index].transcript) {
		urlJson(json[index].transcript, function() {
			elems.bar.style.width = (index + 0.5) / json.length * 100 + "%";
			addDetail(details, "TRANSCRIPT");
			loadPart2(json, elems, details, file, index);
		}, function() {
			elems.parent.classList.add("error");
			file.classList.add("error");
			addDetail(details, "ERROR");
			loadPart2(json, elems, details, file, index);
		});
	} else {
		loadPart2(json, elems, details, file, index);
	}
}

function loadParts(json, elems, index) {
	if (index < json.length - 1) {
		const newIndex = index + 1;
		const details = document.createElement("div");
		details.className = "filedetails";
		const file = document.createElement("a");
		file.appendChild(details);
		const niceName = document.createTextNode(json[newIndex].name || (json[newIndex].transcript && json[newIndex].transcript.split("/").pop()) || "ERROR");
		file.appendChild(niceName);
		elems.list.appendChild(file);
		loadPart1(json, elems, details, file, newIndex);
	} else {
		setTimeout(function() {
			elems.bar.parentNode.removeChild(elems.bar);
		}, 100);
	}
}

function setupRecognition() {
	const Speech = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.oSpeechRecognition || window.msSpeechRecognition;
	if (!Speech) return;
	recognition = new Speech();
	recognition.continuous = true;
	recognition.interimResults = true;
	recognition.onresult = function(e) {
		interimTranscript.innerHTML = "";
		for (let i = e.resultIndex; i < e.results.length; i++) {
			if (event.results[i].isFinal) {
				finalTranscript.innerHTML += event.results[i][0].transcript;
			} else {
				interimTranscript.innerHTML += event.results[i][0].transcript;
			}
		}
	};
	recognition.onend = function() {
		transcriptElem.value += (transcriptElem.value ? " " : "") + finalTranscript.innerHTML;
		interimTranscript.innerHTML = "";
		finalTranscript.innerHTML = "";
	};
}

function setupRecording() {
	if (!window.MediaRecorder) return;
	navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function(stream) {
		recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
		const chunks = [];
		recorder.ondataavailable = function(e) {
			if (e.data.size > 0) {
				chunks.push(e.data);
			}
		};
		recorder.onstop = function() {
			stream.getTracks()[0].stop();
			const file = new File([new Blob(chunks)], "Recording" + recordIndex + ".wav", { type: "audio/wav" });
			updateTranscriptPlayer(file);
			listFile(file);
			recordIndex++;
		};
		recorder.start();
	}).catch(console.error);
}

function microphone(elem) {
	if (elem.classList.contains("active")) {
		elem.src = "microphone.png";
		if (recognition) {
			recognition.stop();
		}
		if (recorder) {
			recorder.stop();
		}
	} else {
		elem.src = "micactive.png";
		if (!recognition) {
			setupRecognition();
		}
		if (recognition) {
			recognition.start();
		}
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			setupRecording();
		}
	}
	elem.classList.toggle("active");
}

/*function drawBoxes(json, audio) {
	if (json) {
		context.font = "16px Courier New";
		context.textAlign = "center";
		for (const i = 0; i < json.words.length; i++) {
			const word = json.words[i];
			if (word.case === "not-found-in-audio") continue;
			if (word.active) {
				context.fillStyle = "#004000";
				const start = word.start * waveZoom - offset;
				context.fillRect(start, yPos + 20, -waveZoom * (word.active - player.currentTime), height - 40);
			}
			context.lineWidth = 1;
			context.fillStyle = "white";
			context.strokeStyle = "#004000";
			if (word.phones) {
				context.textBaseline = "bottom";
				const duration = word.start * waveZoom;
				for (const j = 0; j < word.phones.length; j++) {
					const phone = word.phones[j].phone.split("_")[0].toUpperCase();
					const length = word.phones[j].duration * waveZoom;
					drawLine(context, duration - offset, yPos + 20, duration - offset, yPos + height);
					drawLine(context, duration + length - offset, yPos + 20, duration + length - offset, yPos + height);
					context.fillText(phone, duration + length * 0.5 - offset, yPos + height);
					duration += length;
				}
			}
			context.lineWidth = 2;
			context.strokeStyle = "#00FF00";
			drawLine(context, word.start * waveZoom - offset, yPos, word.start * waveZoom - offset, yPos + height);
			drawLine(context, word.end * waveZoom - offset, yPos, word.end * waveZoom - offset, yPos + height);
			context.textBaseline = "top";
			const difference = (word.end - word.start) * 0.5;
			context.fillText(word.word, waveZoom * (word.start + difference) - offset, yPos);
		}
	}
	if (audio) {
		COPIED UP THERE ALREADY
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
	const lines = canvas.width * 8;
	for (const k = 0; k < lines; k++) {
		const x = k / lines * canvas.width;
		const y = scrollHeight * 0.5;
		const index = audio[Math.floor(k / lines * audio.length)];
		context.lineTo(x, y + scrollHeight * (index || 0));
	}
	context.stroke();
	context.lineWidth = 2;
	context.strokeStyle = "#00FF00";
	const position = (offset * sampleRate * canvas.width) / (waveZoom * audio.length);
	const size = (sampleRate * canvas.width * canvas.width) / (waveZoom * audio.length);
	context.strokeRect(position, 0, size, scrollHeight);
}

function clamp(offset) {
	if (sample) {
		return Math.min(Math.max(offset, 0), sample.buffer.length * waveZoom / sampleRate - canvas.width);
	} else {
		return Math.max(offset, 0);
	}
}

function clicked(e) {
	e.preventDefault();
	if (!json || !json.words) return;
	if (e.pageY > yPos && e.pageY < yPos + height) {
		const match;
		for (const i = 0; i < json.words.length; i++) {
			const word = json.words[i];
			const start = word.start * waveZoom - offset;
			const end = word.end * waveZoom - offset;
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
			const source = player.createBufferSource();
			source.buffer = sample && sample.buffer;
			source.connect(player.destination);
			const duration = match.end - match.start;
			source.start(0, match.start, duration);
			match.active = player.currentTime;
			window.setTimeout(function() {
				match.active = false;
			}, duration * 1000);
		}
	} else if (e.pageY < scrollHeight) {
		if (!sample) return;
		const start = (offset * sampleRate * canvas.width) / (sample.buffer.length * waveZoom);
		const end = (canvas.width * sampleRate * canvas.width) / (sample.buffer.length * waveZoom);
		if (near(e.pageX, start)) {
			dragging = { initial: offset, direction: true };
		} else if (near(e.pageX, start + end)) {
			dragging = { initial: offset, direction: false };
		} else {
			offset = clamp((e.pageX * sample.buffer.length * waveZoom) / (sampleRate * canvas.width) - (0.5 * canvas.width));
			canvas.style.cursor = "grabbing";
			dragging = true;
		}
	}
}

function moved(e) {
	e.preventDefault();
	if (!json || !json.words) return;
	if (!dragging && e.pageY > yPos && e.pageY < yPos + height) {
		const hovering = false;
		for (const i = 0; i < json.words.length; i++) {
			const word = json.words[i];
			const start = word.start * waveZoom - offset;
			const end = word.end * waveZoom - offset;
			if (near(e.pageX, start) || near(e.pageX, end)) {
				hovering = true;
			}
		}
		canvas.style.cursor = hovering ? "col-resize" : "auto";
	} else if (!dragging && e.pageY < scrollHeight) {
		if (!sample) return;
		const start = (offset * sampleRate * canvas.width) / (sample.buffer.length * waveZoom);
		const end = (sampleRate * canvas.width * canvas.width) / (sample.buffer.length * waveZoom);
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
			dragging.key[dragging.value] = (e.pageX + offset) / waveZoom;
			canvas.style.cursor = "col-resize";
		} else if (dragging.direction !== undefined) {
			if (dragging.direction) {
				//offset = (offset / dragging.initial) * sampleRate;
				//waveZoom = (sampleRate * canvas.width * canvas.width) / (sample.buffer.length * e.pageX); // todo
				//offset = clamp((e.pageX * sample.buffer.length * waveZoom) / (sampleRate * canvas.width));
			} else {
				//waveZoom = (sampleRate * canvas.width * canvas.width) / (sample.buffer.length * e.pageX);
				//offset = (dragging.initial / offset); // todo
			}
		} else {
			offset = clamp((e.pageX * sample.buffer.length * waveZoom) / (sampleRate * canvas.width) - (0.5 * canvas.width));
			canvas.style.cursor = "grabbing";
		}
	}
}*/