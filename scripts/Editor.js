"use strict";

let step1;
let step2;
let popup;
let editor;
let tracks;
let topNav;
let sideNav;
let zoomDrag;
let playhead;
let playback;
let playlist;
let fileTabs;
let activeTab;
let boxSelect;
let timeLabel;
let prefsMenu;
let presetMenu;
let playButton;
let presetList;
let activeDrag;
let zoomCanvas;
let zoomContext;
let recognition;
let draggedFile;
let playlistArea;
let popupOverlay;
let navigationArea;
let activeSession;
let waveDetailElem;
let zoomAmountElem;
let transcriptMenu;
let transcriptElem;
let timelineCanvas;
let timelineContext;
let transcriptPlayer;
let interimTranscript;
let finalTranscript;
let lastTopScroll = 0;
let lastLeftScroll = 0;
let selectedFiles = [];
let recordIndex = 1;
let waveDetail = 16;
let zoomAmount = 1.25;
let autoScroll = false;
let presetsLoaded = false;
let playlistSetup = false;
let ignoreScroll = false;
const wheelZoom = {};
const tabList = [];
const fileList = [];
const peakScale = 0.7;
const minCanvasWidth = 1;
const requestFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(e) { return window.setTimeout(e, 1000 / 60); };

function interleave(inputL, inputR) {
	const length = inputL.length + inputR.length;
	const result = new Float32Array(length);
	let index = 0;
	let inputIndex = 0;
	while (index < length) {
		result[index++] = inputL[inputIndex];
		result[index++] = inputR[inputIndex];
		inputIndex++;
	}
	return result;
}

function floatTo16BitPCM(output, offset, input) {
	for (let i = 0; i < input.length; i++, offset += 2) {
		const s = Math.max(-1, Math.min(1, input[i]));
		output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
	}
}

function writeString(view, offset, str) {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
}

function encodeWAV(samples, sampleRate, numChannels) {
	const buffer = new ArrayBuffer(44 + samples.length * 2);
	const view = new DataView(buffer);
	writeString(view, 0, "RIFF");
	view.setUint32(4, 36 + samples.length * 2, true);
	writeString(view, 8, "WAVE");
	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * numChannels * 2, true);
	view.setUint16(32, numChannels * 2, true);
	view.setUint16(34, 16, true);
	writeString(view, 36, "data");
	view.setUint32(40, samples.length * 2, true);
	floatTo16BitPCM(view, 44, samples);
	return view;
}

function updateTranscriptPlayer(file) {
	const url = window.URL.createObjectURL(file);
	transcriptPlayer.style.display = "inline-block";
	transcriptPlayer.src = url;
}

function isLeftClick(e) {
	return e.which === 1 || e.button === 0;
}

function drawLine(context, x, y, x2, y2) {
	context.beginPath();
	context.moveTo(x, y);
	context.lineTo(x2, y2);
	context.stroke();
}

function isDecodable(file) {
	return file.type.startsWith("audio") || file.type.startsWith("video");
}

function deselectFiles() {
	for (let i = 0; i < fileList.length; i++) {
		fileList[i].elem.classList.remove("active");
	}
	selectedFiles = [];
}

function deselectNonDraggableFiles() {
	for (let i = 0; i < fileList.length; i++) {
		const file = fileList[i];
		if (!file.elem.draggable) {
			const index = selectedFiles.indexOf(file);
			if (index !== -1) {
				file.elem.classList.remove("active");
				selectedFiles.splice(index, 1);
			}
		}
	}
}

function setMenu(name) {
	player.pauseIfPlaying();
	editor.style.display = name === "editor" ? "block" : "none";
	step1.style.display = name === "step1" ? "block" : "none";
	step2.style.display = name === "step2" ? "block" : "none";
}

function ListedFile(file) {
	this.file = file;
	this.elem = document.createElement("a");
	this.elem.innerHTML = file.name;
	this.dragStart = function(e) {
		deselectNonDraggableFiles();
		draggedFile = this;
		e.dataTransfer.setData("text/plain", "Firefox");
	};
	if (isDecodable(file)) {
		this.elem.draggable = true;
		this.elem.addEventListener("dragstart", this.dragStart.bind(this));
	} else {
		this.elem.className = "boxselectable";
	}
	this.select = function() {
		selectedFiles.push(this);
		this.elem.classList.add("active");
	};
	this.clicked = function() {
		deselectFiles();
		if (activeSession) {
			activeSession.deselectClips();
		}
		this.select();
	};
	this.elem.addEventListener("click", this.clicked.bind(this));
	this.doubleClick = function() {
		if (this.file.type === "session") {
			setMenu("editor");
			if (activeSession !== this.file) {
				this.file.open();
			}
		} else if (isDecodable(this.file) && activeSession) {
			activeSession.deselectClips();
			activeSession.decentTrack().addClip(activeSession.playheadTime, this.file);
		}
	};
	this.elem.addEventListener("dblclick", this.doubleClick.bind(this));
	this.remove = function() {
		const index = fileList.indexOf(this);
		if (index !== -1) {
			fileList.splice(index, 1);
		}
		if (this.file.type === "session") {
			this.file.remove();
		}
		this.elem.parentNode.removeChild(this.elem);
	};
	fileList.push(this);
}

function listFile(file) {
	const listed = new ListedFile(file);
	sideNav.appendChild(listed.elem);
}

function SessionPlayer() {
	this.sampleRate = 44100;
	this.running = false;
	this.recording = false;
	this.lastPlayhead = 0;
	this.lastTime = 0;
	this.bufferNodes = [];
	this.chunks = [];
	this.ensureContext = function() {
		if (!this.context) {
			this.context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
		}
	};
	this.unshake = function() {
		sideNav.style.transform = "none";
		topNav.style.transform = "none";
		document.body.style.transform = "none";
		document.body.style.overflow = "initial";
	};
	this.toggleShakeAnalyser = function(enabled) {
		if (enabled) {
			if (!this.shakeAnalyser) {
				this.shakeAnalyser = this.context.createAnalyser();
				this.shakeAnalyser.fftSize = 2048;
				if (this.bufferNodes.length) {
					for (let i = 0; i < this.bufferNodes.length; i++) {
						this.bufferNodes[i].connect(this.shakeAnalyser);
					}
				}
			}
			if (!this.shakeData) {
				this.shakeData = new Uint8Array(this.shakeAnalyser.frequencyBinCount);
			}
		} else {
			this.shakeAnalyser = undefined;
			this.unshake();
		}
	};
	this.pause = function() {
		if (this.bufferNodes.length) {
			for (let i = 0; i < this.bufferNodes.length; i++) {
				this.bufferNodes[i].stop();
			}
			this.bufferNodes = [];
		}
		if (this.shakeAnalyser) {
			this.unshake();
		}
		playButton.innerHTML = "►";
		this.running = false;
	};
	this.startRecording = function(stream, createClip) {
		if (this.recording) return;
		this.ensureContext();
		this.stream = stream;
		this.chunks = [];
		if (createClip) {
			this.recordingClip = activeSession.decentTrack().addClip(activeSession.playheadTime);
			this.recordingClip.startRecording();
		}
		const mediaStream = this.context.createMediaStreamSource(stream);
		this.recordingProcessor = this.context.createScriptProcessor(4096, 2, 2);
		this.recordingProcessor.onaudioprocess = function(e) {
			for (let i = 0; i < e.inputBuffer.numberOfChannels; i++) {
				this.chunks[i] = this.chunks[i] || [];
				const data = e.inputBuffer.getChannelData(i).slice();
				this.chunks[i].push(data);
				if (this.recordingClip && i === 0) {
					this.recordingClip.addDisplayData(data);
				}
			}
		}.bind(this);
		mediaStream.connect(this.recordingProcessor);
		this.recordingProcessor.connect(this.context.destination);
		this.recording = true;
	};
	this.mergeChunks = function() {
		if (!this.chunks.length) return;
		let length = 0;
		for (let i = 0; i < this.chunks[0].length; i++) {
			length += this.chunks[0][i].length;
		}
		const buffer = this.context.createBuffer(this.chunks.length, length, this.sampleRate);
		for (let i = 0; i < this.chunks.length; i++) {
			let offset = 0;
			for (let j = 0; j < this.chunks[i].length; j++) {
				buffer.copyToChannel(this.chunks[i][j], i, offset);
				offset += this.chunks[i][j].length;
			}
		}
		return buffer;
	};
	this.bufferToFile = function(buffer) {
		let interleaved;
		if (buffer.numberOfChannels > 1) {
			interleaved = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
		} else {
			interleaved = buffer.getChannelData(0);
		}
		const view = encodeWAV(interleaved, buffer.sampleRate, Math.min(buffer.numberOfChannels, 2));
		return new File([new Blob([view], { type: "audio/wav" })], "Recording" + recordIndex + ".wav", { type: "audio/wav" });
	};
	this.stopRecording = function() {
		if (!this.recording) return;
		this.stream.getTracks()[0].stop();
		this.recordingProcessor.disconnect();
		this.recordingProcessor = undefined;
		const buffer = this.mergeChunks();
		const file = this.bufferToFile(buffer);
		if (this.recordingClip) {
			this.recordingClip.stopRecording(buffer);
			this.recordingClip = undefined;
		} else {
			updateTranscriptPlayer(file);
		}
		listFile(file);
		recordIndex++;
		this.recording = false;
	};
	this.shake = function() {
		this.shakeAnalyser.getByteFrequencyData(this.shakeData);
		const bass = this.shakeData[0];
		document.body.style.overflow = "hidden";
		document.body.style.transform = "rotate(" + ((bass - 80) * 0.001) + "deg) translateY(" + ((bass - 120) * -0.1) + "px";
		const mid = this.shakeData[256] - 40;
		sideNav.style.transform = "rotate(" + (mid * -0.005) + "deg)";
		const treble = this.shakeData[512];
		topNav.style.transform = "rotate(" + ((treble - 80) * 0.005) + "deg) translateY(" + ((treble - 40) * 0.1) + "px";
	};
	this.schedule = function() {
		for (let i = 0; i < activeSession.trackList.length; i++) {
			for (let j = 0; j < activeSession.trackList[i].clips.length; j++) {
				const clip = activeSession.trackList[i].clips[j];
				if (clip.scale === 1) {
					const clipDuration = clip.outTime - clip.inTime - Math.max(0, this.lastPlayhead - clip.startTime);
					if (clipDuration > 0) {
						const bufferNode = this.context.createBufferSource();
						//bufferNode.playbackRate.value = 1 / clip.scale;
						bufferNode.buffer = clip.audioBuffer;
						if (this.shakeAnalyser) {
							bufferNode.connect(this.shakeAnalyser);
						}
						bufferNode.connect(this.context.destination);
						//bufferNode.start(Math.max(0, clip.startTime - this.timeOffset), Math.max(0, (-clip.startTime + this.timeOffset) / clip.scale), clip.duration);
						let when = clip.startTime - this.lastPlayhead;
						let offset = clip.inTime;
						if (when < 0) {
							offset -= when;
							when = 0;
						}
						bufferNode.start(this.lastTime + when, offset, clipDuration);
						this.bufferNodes.push(bufferNode);
					}
				} else {
					// todo: use phase vocoding to stretch audio
					/*const script = this.context.createScriptProcessor(this.bufferSize, 2, 2);
					script.onaudioprocess = function(e) {

					}
					script.connect(this.context.destination)
					const vocoder = new PhaseVocoder2(4096, this.sampleRate);
					vocoder.init();
					vocoder.set_alpha(clip.scale);
					const outData = new Float32Array(clip.audioData.length);
					vocoder.process(numSampsToProcess, clip.audioData, 0, outData, 0);
					console.log(outData);
					const result = vocoder.process(clip.audioData);
					console.log(result);
					vocoder.process(numSampsToProcess, inData, inDataOffset, outData, outDataOffset)*/
				}
			}
		}
	};
	this.playingTime = function() {
		return this.lastPlayhead + this.context.currentTime - this.lastTime;
	};
	this.play = function() {
		if (this.recordingClip) return;
		this.ensureContext();
		this.lastTime = this.context.currentTime;
		this.lastPlayhead = activeSession.playheadTime;
		this.schedule();
		playButton.innerHTML = "❚❚";
		this.running = true;
	};
	this.pauseIfPlaying = function() {
		if (this.running) {
			this.pause();
		}
	};
	this.togglePlayback = function() {
		if (this.running) {
			this.pause();
		} else {
			this.play();
		}
	};
	this.decode = function(data, func, err) {
		this.ensureContext();
		this.context.decodeAudioData(data, func, err);
	};
}

const player = new SessionPlayer();

function fileBuffer(file, func, err) {
	const reader = new FileReader();
	reader.onload = function() {
		player.decode(this.result, func, err);
	};
	reader.onerror = err;
	reader.readAsArrayBuffer(file);
}

function readFile(file, func, err) {
	const reader = new FileReader();
	reader.onload = function() {
		func(this.result, file.name, file.type);
	};
	reader.onerror = err;
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
		return minutes + ":" + padTime(seconds, 2);
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

function updateZoomCanvas() {
	if (!zoomContext || !activeSession) return;
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
	if (!timelineContext || !activeSession) return;
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
	const notchCount = Math.min(512, Math.ceil(timelineCanvas.width / activeSession.zoom) + 1);
	const notchWidth = timelineCanvas.width / notchCount;
	for (let i = 0; i < notchCount; i++) {
		let seconds = i;
		while (seconds - activeSession.scroll < -0.5) {
			seconds += notchCount;
		}
		const position = activeSession.zoom * (seconds - activeSession.scroll);
		drawLine(timelineContext, position, 4, position, timelineCanvas.height);
		if (notchWidth > 20) {
			timelineContext.fillText(niceTime(seconds, false), position + 4, 4);
		} else if (i % 2 === 0) {
			timelineContext.fillText(niceTime(seconds, false), position + 4, 4);
		}
	}
	timelineContext.fillStyle = "white";
	timelineContext.fillRect(activeSession.zoom * (activeSession.playheadTime - activeSession.scroll), 0, 1, timelineCanvas.height);
}

function parseTime(elem) {
	player.pauseIfPlaying();
	activeSession.setPlayhead(Math.min(timeStringToSeconds(elem.innerHTML), activeSession.duration), false);
}

function forceTime() {
	player.pauseIfPlaying();
	activeSession.setPlayhead(Math.min(timeStringToSeconds(timeLabel.innerHTML), activeSession.duration), true);
}

function togglePlayback() {
	player.togglePlayback();
}

function urlBuffer(url, func, err) {
	const audioRequest = new XMLHttpRequest();
	audioRequest.open("GET", url, true);
	audioRequest.responseType = "arraybuffer";
	audioRequest.onreadystatechange = function() {
		if (this.readyState === 4) {
			if (this.status === 200) {
				player.decode(this.response, func, err);
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

function updateClipCanvases() {
	if (!activeSession) return;
	for (let i = 0; i < activeSession.trackList.length; i++) {
		const track = activeSession.trackList[i];
		for (let j = 0; j < track.clips.length; j++) {
			track.clips[j].updateCanvas();
		}
	}
}

function updateZoomDragger() {
	if (!activeSession) return;
	zoomDrag.style.left = activeSession.zoomPosition() + "px";
	const width = activeSession.zoomWidth();
	if (width < minCanvasWidth) {
		zoomDrag.style.width = minCanvasWidth + "px";
	} else {
		zoomDrag.style.width = width + "px";
	}
}

function resize() {
	zoomCanvas.width = zoomCanvas.clientWidth;
	zoomCanvas.height = zoomCanvas.clientHeight;
	updateZoomCanvas();
	timelineCanvas.width = timelineCanvas.clientWidth;
	timelineCanvas.height = timelineCanvas.clientHeight;
	updateTimeCanvas();
	updateZoomDragger();
	updateClipCanvases();
}

function updatePlaylistDuration() {
	let maxEndTime = 0;
	for (let i = 0; i < activeSession.trackList.length; i++) {
		const track = activeSession.trackList[i];
		for (let j = 0; j < track.clips.length; j++) {
			const endTime = track.clips[j].endTime();
			if (endTime > maxEndTime) {
				maxEndTime = endTime;
			}
		}
	}
	activeSession.setDuration(Math.max(playlist.clientWidth / activeSession.zoom, maxEndTime));
	updateZoomDragger();
	updateZoomCanvas();
}

function updatePlaylistZoom() {
	activeSession.setPlayhead(activeSession.playheadTime, false);
	updateClipCanvases();
}

function forceCanvasRedraw() {
	window.setTimeout(function() {
		updateZoomCanvas();
		updateTimeCanvas();
		updateClipCanvases();
	}, 1000);
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
	if (ignoreScroll) {
		ignoreScroll = false;
	} else {
		if (playlistArea.scrollTop !== lastTopScroll) {
			playhead.style.top = playlistArea.scrollTop + "px";
			lastTopScroll = playlistArea.scrollTop;
		}
		if (activeSession && playlistArea.scrollLeft !== lastLeftScroll) {
			activeSession.setScroll(playlistArea.scrollLeft / activeSession.zoom, false);
			updateTimeCanvas();
			lastLeftScroll = playlistArea.scrollLeft;
		}
	}
}

function setupZoomDraggers() {
	const zoomDragLeft = document.getElementById("zoomdragleft");
	const zoomDragRight = document.getElementById("zoomdragright");
	zoomDragLeft.addEventListener("mousedown", function(e) {
		if (!isLeftClick(e)) return;
		e.preventDefault();
		e.stopPropagation();
		activeDrag = { type: "zoomdragleft", dragWidth: e.pageX, dragPosition: e.pageX - activeSession.zoomPosition(), leftElem: zoomDragLeft, rightElem: zoomDragRight, lastWidth: activeSession.zoomWidth(), lastPosition: activeSession.zoomPosition() + activeSession.zoomWidth() };
	});
	zoomDragRight.addEventListener("mousedown", function(e) {
		if (!isLeftClick(e)) return;
		e.preventDefault();
		e.stopPropagation();
		activeDrag = { type: "zoomdragright", drag: e.pageX, leftElem: zoomDragLeft, rightElem: zoomDragRight, lastWidth: activeSession.zoomWidth(), lastScroll: activeSession.scroll };
	});
	zoomDrag.addEventListener("mousedown", function(e) {
		if (!isLeftClick(e)) return;
		activeDrag = { type: "zoomdrag", drag: e.pageX - activeSession.zoomPosition() };
	});
}

function draw() {
	if (player.running) {
		const time = player.playingTime();
		if (time > activeSession.duration) {
			player.pauseIfPlaying();
		} else {
			activeSession.setPlayhead(time, true);
		}
		if (autoScroll) {
			const visibleWidth = activeSession.visibleWidth(activeSession.zoom);
			const scroll = time - visibleWidth * 0.5;
			if (scroll > 0 && scroll + visibleWidth < activeSession.duration) {
				activeSession.setScroll(scroll, true);
			}
		}
		if (player.shakeAnalyser) {
			player.shake();
		}
	}
	requestFrame(draw);
}

function setupPlaylist() {
	setupZoomCanvas();
	setupTimeCanvas();
	setupZoomDraggers();
	playlistSetup = true;
}

function openPopup(name) {
	transcriptMenu.style.display = name === "transcript" ? "block" : "none";
	presetMenu.style.display = name === "preset" ? "block" : "none";
	prefsMenu.style.display = name === "prefs" ? "block" : "none";
	popupOverlay.style.display = "block";
	popup.style.display = "block";
}

function ClipDragger(clip, left) {
	this.clip = clip;
	this.drag = 0;
	this.left = left;
	this.type = "clipdragger";
	this.elem = document.createElement("div");
	this.elem.className = this.left ? "clipdragleft" : "clipdragright";
	this.clip.parent.appendChild(this.elem);
	this.clicked = function(e) {
		if (!isLeftClick(e)) return;
		e.preventDefault();
		activeDrag = this;
		if (this.left) {
			this.drag = {
				in: e.pageX - (this.clip.inTime * this.clip.session.zoom),
				start: e.pageX - (this.clip.startTime * this.clip.session.zoom),
				lastStart: this.clip.startTime - this.clip.inTime
			};
		} else {
			this.drag = e.pageX - (this.clip.outTime * this.clip.session.zoom);
		}
	};
	this.updateDrag = function(newPosition) {
		player.pauseIfPlaying();
		if (this.left) {
			//this.clip.setScale(this.drag - newPosition);
			const inTime = (newPosition - this.drag.in) / this.clip.session.zoom;
			const minimum = ((this.clip.outTime * this.clip.session.zoom) - minCanvasWidth) / this.clip.session.zoom;
			if (inTime > minimum) {
				this.clip.setStart(this.drag.lastStart + minimum);
				this.clip.setInTime(minimum);
			} else if (inTime > 0) {
				this.clip.setStart((newPosition - this.drag.start) / this.clip.session.zoom);
				this.clip.setInTime(inTime);
			} else {
				this.clip.setStart(this.drag.lastStart);
				this.clip.setInTime(0);
			}
		} else {
			const outTime = (newPosition - this.drag) / this.clip.session.zoom;
			const maximum = ((this.clip.inTime * this.clip.session.zoom) + minCanvasWidth) / this.clip.session.zoom;
			if (outTime < maximum) {
				this.clip.setOutTime(maximum);
			} else if (outTime > this.clip.duration) {
				this.clip.setOutTime(this.clip.duration);
			} else {
				this.clip.setOutTime(outTime);
			}
			//this.clip.setScale(newPosition - this.drag);
		}
	};
	this.deny = function() {
		this.elem.style.display = "none";
	};
	this.allow = function() {
		this.elem.style.display = "block";
	};
	this.elem.addEventListener("mousedown", this.clicked.bind(this));
}

function Clip(session) {
	this.session = session;
	this.drag = 0;
	this.scale = 1;
	this.displayWave;
	this.type = "clip";
	this.audioBuffer;
	this.duration = 0;
	this.inTime = 0;
	this.outTime = 0;
	this.startTime = 0;
	this.fakeOffset = 0;
	this.elem = document.createElement("canvas");
	this.elem.className = "clip";
	this.elem.width = 1;
	this.elem.height = 128;
	this.parent = document.createElement("div");
	this.parent.className = "clipdiv";
	this.parent.appendChild(this.elem);
	this.leftDragger = new ClipDragger(this, true);
	this.rightDragger = new ClipDragger(this, false);
	this.context = this.elem.getContext("2d", { alpha: true });
	this.drawCanvas = function() {
		this.context.clearRect(0, 0, this.elem.width, this.elem.height);
		const lines = this.elem.width * waveDetail;
		this.context.lineWidth = 0.5;
		this.context.strokeStyle = "white";
		this.context.beginPath();
		const scale = waveDetail * this.session.zoom;
		const offset = this.inTime * player.sampleRate - this.fakeOffset;
		for (let k = 0; k < lines; k++) {
			const x = k / lines * this.elem.width;
			const y = this.elem.height * 0.5;
			const index = this.displayWave[Math.floor(k * player.sampleRate / scale + offset)];
			this.context.lineTo(x, y + (index || 0) * y * peakScale);
		}
		this.context.stroke();
		this.context.lineWidth = 1;
		this.context.strokeStyle = "#00FF00";
		drawLine(this.context, 0, 16, this.elem.width, 16);
		drawLine(this.context, 0, this.elem.height - 16, this.elem.width, this.elem.height - 16);
		//this.drawLabel();
	};
	/*this.drawLabel = function() {
		this.context.fillStyle = "white";
		this.context.textAlign = "center";
		this.context.textBaseline = "top";
		this.context.font = "12px Arial";
		this.context.fillText("TESTING", this.elem.width * 0.5, 4);
	};*/
	this.pixelWidth = function() {
		return (this.outTime - this.inTime) * this.session.zoom;
	};
	this.updateCanvas = function() {
		if (this.displayWave) {
			let width = this.pixelWidth();
			const startTime = this.startTime - this.session.scroll;
			const startPosition = startTime * this.session.zoom;
			const amountOver = startPosition + width - zoomCanvas.width;
			if (amountOver > 0) {
				width -= amountOver;
				this.rightDragger.deny();
			} else {
				this.rightDragger.allow();
			}
			if (startPosition < 0) {
				this.parent.style.left = this.session.scroll * this.session.zoom + "px";
				this.fakeOffset = startTime * player.sampleRate;
				this.leftDragger.deny();
				width += startPosition;
			} else {
				this.parent.style.left = this.startTime * this.session.zoom + "px";
				this.fakeOffset = 0;
				this.leftDragger.allow();
			}
			if (width > 0) {
				if (width <= 8) {
					this.leftDragger.deny();
					this.rightDragger.deny();
				}
				if (width < minCanvasWidth) {
					this.elem.width = minCanvasWidth;
				} else {
					this.elem.width = width;
				}
				this.parent.style.display = "block";
				this.drawCanvas();
			} else {
				this.elem.width = 1;
				this.parent.style.display = "none";
			}
			//this.drawLabel();
		} else {
			this.parent.style.left = this.startTime * this.session.zoom + "px";
		}
	};
	this.select = function() {
		this.session.selectedClips.push(this);
		this.parent.classList.add("active");
	};
	this.updateDrag = function(newPosition) {
		player.pauseIfPlaying();
		for (let i = 0; i < this.session.selectedClips.length; i++) {
			this.session.selectedClips[i].setStart((newPosition - this.session.selectedClips[i].drag) / this.session.zoom);
		}
	};
	this.clicked = function(e) {
		if (!isLeftClick(e)) return;
		e.preventDefault();
		activeDrag = this;
		if (this.session.selectedClips.indexOf(this) === -1) {
			if (!e.shiftKey) {
				this.session.deselectClips();
			}
			deselectFiles();
			this.select();
		}
		for (let i = 0; i < this.session.selectedClips.length; i++) {
			this.session.selectedClips[i].drag = e.pageX - (this.session.selectedClips[i].startTime * this.session.zoom);
		}
	};
	this.elem.addEventListener("mousedown", this.clicked.bind(this));
	this.setOutTime = function(time) {
		if (time > this.duration) {
			this.outTime = this.duration;
		} else {
			this.outTime = time;
		}
		updateZoomCanvas();
		this.updateCanvas();
	};
	this.setInTime = function(time) {
		if (time < 0) {
			this.inTime = 0;
		} else {
			this.inTime = time;
		}
		updateZoomCanvas();
		this.updateCanvas();
	};
	this.setPlayheadInTime = function(time) {
		const inTime = this.inTime + time - this.startTime;
		if ((this.outTime - inTime) * this.session.zoom < minCanvasWidth) return;
		if (inTime > 0) {
			this.setStart(time);
		} else {
			this.setStart(time - inTime);
		}
		this.setInTime(inTime);
	};
	this.setPlayheadOutTime = function(time) {
		const outTime = time - this.startTime + this.inTime;
		if ((outTime - this.inTime) * this.session.zoom < minCanvasWidth) return;
		this.setOutTime(outTime);
	};
	this.duplicate = function() {
		const clip = new Clip(this.session);
		clip.duration = this.duration;
		clip.track = this.track;
		clip.inTime = this.inTime;
		clip.startTime = this.startTime;
		clip.outTime = this.outTime;
		clip.displayWave = this.displayWave;
		clip.audioBuffer = this.audioBuffer;
		return clip;
	};
	this.splitClip = function(time) {
		const inTime = this.inTime + time - this.startTime;
		const outTime = time - this.startTime + this.inTime;
		if ((this.outTime - inTime) * this.session.zoom < minCanvasWidth) return;
		if ((outTime - this.inTime) * this.session.zoom < minCanvasWidth) return;
		const dupe = this.duplicate();
		dupe.outTime = outTime;
		this.track.insertClip(dupe);
		dupe.updateCanvas();
		dupe.select();
		this.startTime = time;
		this.inTime = inTime;
		this.updateCanvas();
	};
	/*this.setScale = function(scale) {
		this.scale = (scale + this.lastWidth) / this.elem.width;
		this.elem.style.width = this.scale * this.elem.width + "px";
	};*/
	this.endTime = function() {
		return this.startTime + this.outTime - this.inTime;
	};
	this.drawLoading = function() {
		this.elem.width = 128;
		this.context.fillStyle = "white";
		this.context.textAlign = "center";
		this.context.textBaseline = "middle";
		this.context.font = "16px Arial";
		this.context.fillText("LOADING...", this.elem.width * 0.5, this.elem.height * 0.5);
	};
	this.drawError = function() {
		this.elem.width = 128;
		this.context.fillStyle = "#FF000040";
		this.context.fillRect(0, 0, this.elem.width, this.elem.height);
		this.context.fillStyle = "#FF0000";
		this.context.textAlign = "center";
		this.context.textBaseline = "middle";
		this.context.font = "16px Arial";
		this.context.fillText("ERROR", this.elem.width * 0.5, this.elem.height * 0.5);
	};
	this.loadBuffer = function(buffer) {
		this.audioBuffer = buffer;
		this.displayWave = buffer.getChannelData(0).slice();
		this.duration = buffer.duration;
		this.outTime = this.duration;
		this.elem.width = this.duration * this.session.zoom;
		this.updateCanvas();
		updatePlaylistDuration();
	};
	this.startRecording = function() {
		this.displayWave = [];
	};
	this.stopRecording = function(buffer) {
		this.loadBuffer(buffer);
		this.session.setPlayhead(this.endTime(), true);
	};
	this.addDisplayData = function(left) {
		for (let i = 0; i < left.length; i++) {
			this.displayWave.push(left[i]);
		}
		this.duration = this.displayWave.length / player.sampleRate;
		this.outTime = this.duration;
		this.elem.width = this.duration * this.session.zoom;
		this.updateCanvas();
		updatePlaylistDuration();
		this.session.setPlayhead(this.endTime(), true);
	};
	this.loadedFile = function(buffer) {
		this.loadBuffer(buffer);
		forceCanvasRedraw();
	};
	this.loadFile = function(file) {
		this.drawLoading();
		this.leftDragger.deny();
		this.rightDragger.deny();
		fileBuffer(file, this.loadedFile.bind(this), this.drawError.bind(this));
	};
	this.changeTrack = function(track) {
		this.track.removeClip(this);
		track.insertClip(this);
	};
	this.setStart = function(time) {
		this.startTime = time;
		updatePlaylistDuration();
		this.updateCanvas();
	};
	this.setEnd = function(time) {
		this.setStart(time - this.outTime + this.inTime);
	};
	this.remove = function() {
		this.track.removeClip(this);
		this.parent.parentNode.removeChild(this.parent);
	};
}

function Track(trackSession) {
	this.clips = [];
	this.session = trackSession;
	this.elem = document.createElement("div");
	this.elem.className = "track";
	tracks.appendChild(this.elem);
	this.insertClip = function(clip) {
		clip.track = this;
		this.elem.appendChild(clip.parent);
		this.clips.push(clip);
	};
	this.index = function() {
		return this.session.trackList.indexOf(this);
	};
	this.select = function() {
		this.elem.classList.add("active");
	};
	this.deselect = function() {
		this.elem.classList.remove("active");
	};
	this.clicked = function() {
		if (this.session.selectedTrack === this) return;
		this.session.selectTrack(this);
	};
	this.elem.addEventListener("mousedown", this.clicked.bind(this));
	this.addClip = function(start, file) {
		player.pauseIfPlaying();
		const clip = new Clip(this.session);
		this.insertClip(clip);
		clip.startTime = start;
		clip.parent.style.left = start * this.session.zoom + "px";
		if (file) {
			clip.loadFile(file);
		}
		clip.select();
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
			e.stopPropagation();
			e.dataTransfer.dropEffect = "copy";
		}
	};
	this.elem.addEventListener("dragover", this.dragover.bind(this));
	this.drop = function(e) {
		if (draggedFile) {
			e.preventDefault();
			e.stopPropagation();
			this.session.deselectClips();
			const start = (e.clientX - this.elem.getBoundingClientRect().left) / this.session.zoom;
			this.addClip(start, draggedFile.file);
			if (draggedFile.elem.classList.contains("active") && selectedFiles.length) {
				let offset = 0;
				for (let i = 0; i < selectedFiles.length; i++) {
					const active = selectedFiles[i];
					if (active !== draggedFile && isDecodable(active.file)) {
						this.session.nextTrack(this, offset + 1).addClip(start, active.file);
						offset++;
					}
				}
			}
			draggedFile = undefined;
		} else if (e.dataTransfer && e.dataTransfer.files) {
			e.preventDefault();
			e.stopPropagation();
			let offset = 0;
			const start = (e.clientX - this.elem.getBoundingClientRect().left) / this.session.zoom;
			for (let i = 0; i < e.dataTransfer.files.length; i++) {
				const file = e.dataTransfer.files[i];
				listFile(file);
				if (isDecodable(file)) {
					this.session.nextTrack(this, offset).addClip(start, file);
					offset++;
				}
			}
		}
	};
	this.elem.addEventListener("drop", this.drop.bind(this));
}

function FileTab(session) {
	this.name = session.realName;
	this.session = session;
	this.elem = document.createElement("a");
	this.label = document.createElement("span");
	this.label.className = "filetabname";
	this.label.innerHTML = this.name;
	this.elem.appendChild(this.label);
	this.closeButton = document.createElement("span");
	this.closeButton.className = "filetabclose";
	this.closeButton.innerHTML = "x";
	this.elem.appendChild(this.closeButton);
	this.activate = function() {
		if (activeTab === this) return;
		player.pauseIfPlaying();
		if (activeTab) {
			activeTab.deactivate();
		}
		activeTab = this;
		this.session.activate();
		this.elem.classList.add("active");
	};
	this.deactivate = function() {
		this.elem.classList.remove("active");
		this.session.deactivate();
		if (activeTab === this) {
			activeTab = undefined;
		}
	};
	this.remove = function() {
		player.pauseIfPlaying();
		this.elem.parentNode.removeChild(this.elem);
		this.session.tab = undefined;
		this.session.close();
		const index = tabList.indexOf(this);
		if (index !== -1) {
			tabList.splice(index, 1);
		}
		if (activeTab === this) {
			activeTab = undefined;
			if (tabList.length) {
				const nextTab = tabList[index];
				const previousTab = tabList[index - 1];
				if (nextTab) {
					nextTab.activate();
				} else if (previousTab) {
					previousTab.activate();
				} else {
					tabList[0].activate();
				}
			} else {
				setMenu("step1");
			}
		}
	};
	this.closeButton.addEventListener("click", function(e) {
		e.stopPropagation();
		this.remove();
	}.bind(this));
	this.elem.addEventListener("click", this.activate.bind(this));
	fileTabs.appendChild(this.elem);
	tabList.push(this);
}

function Session(name, duration) {
	this.scroll = 0;
	this.zoom = timelineCanvas.width / duration;
	this.duration = duration;
	this.playheadTime = 0;
	this.realName = name;
	this.selectedClips = [];
	this.name = name + ".phomeme";
	this.type = "session";
	this.trackList = [];
	this.clipboard = [];
	this.deselectClips = function() {
		for (let i = 0; i < this.selectedClips.length; i++) {
			this.selectedClips[i].parent.classList.remove("active");
		}
		this.selectedClips = [];
	};
	this.removeClips = function() {
		for (let i = 0; i < this.selectedClips.length; i++) {
			this.selectedClips[i].remove();
		}
		this.selectedClips = [];
		updateZoomCanvas();
	};
	this.cutClips = function() {
		this.clipboard = this.selectedClips.slice();
		this.removeClips();
	};
	this.copyClips = function() {
		this.clipboard = this.selectedClips.slice();
	};
	this.minStartTime = function(clips) {
		let pasteTime;
		for (let i = 0; i < clips.length; i++) {
			const start = clips[i].startTime - this.playheadTime;
			if (pasteTime === undefined || start < pasteTime) {
				pasteTime = start;
			}
		}
		return pasteTime;
	};
	this.minTrackIndex = function(clips) {
		let pasteIndex;
		for (let i = 0; i < clips.length; i++) {
			const index = clips[i].track.index();
			if (pasteIndex === undefined || index < pasteIndex) {
				pasteIndex = index;
			}
		}
		return pasteIndex;
	};
	this.forceTrack = function(index) {
		const track = this.trackList[index];
		if (track) {
			return track;
		} else {
			let lastTrack;
			for (let i = this.trackList.length - 1; i < index; i++) {
				lastTrack = this.addTrack();
			}
			return lastTrack;
		}
	};
	this.nextTrack = function(track, offset) {
		const next = this.trackList[track.index() + offset];
		if (next) {
			return next;
		} else {
			return this.addTrack();
		}
	};
	this.pasteClips = function() {
		this.deselectClips();
		const pasteTime = this.minStartTime(this.clipboard);
		const pasteIndex = this.minTrackIndex(this.clipboard);
		const selectedIndex = this.selectedTrack.index();
		for (let i = 0; i < this.clipboard.length; i++) {
			const clip = this.clipboard[i].duplicate();
			clip.startTime -= pasteTime;
			clip.track = this.forceTrack(selectedIndex + clip.track.index() - pasteIndex);
			clip.track.insertClip(clip);
			clip.updateCanvas();
			clip.select();
		}
		updatePlaylistDuration();
	};
	this.selectClips = function() {
		this.selectedClips = [];
		for (let i = 0; i < this.trackList.length; i++) {
			const track = this.trackList[i];
			for (let j = 0; j < track.clips.length; j++) {
				track.clips[j].select();
			}
		}
	};
	this.duplicateClips = function() {
		const lastClips = this.selectedClips.slice();
		this.deselectClips();
		const pasteTime = this.minStartTime(lastClips);
		for (let i = 0; i < lastClips.length; i++) {
			const clip = lastClips[i];
			const dupe = clip.duplicate();
			dupe.startTime -= pasteTime;
			clip.track.insertClip(dupe);
			dupe.updateCanvas();
			dupe.select();
		}
		updatePlaylistDuration();
	};
	this.selectTrack = function(track) {
		if (this.selectedTrack) {
			this.selectedTrack.deselect();
		}
		track.select();
		this.selectedTrack = track;
	};
	this.addTrack = function() {
		const track = new Track(this);
		this.selectTrack(track);
		this.trackList.push(track);
		return track;
	};
	this.decentTrack = function() {
		return this.selectedTrack ? this.selectedTrack : this.addTrack();
	};
	this.pixelWidth = function() {
		return this.duration * this.zoom;
	};
	this.zoomPosition = function() {
		return this.scroll * zoomCanvas.width / this.duration;
	};
	this.zoomWidth = function() {
		return zoomCanvas.width * zoomCanvas.width / this.pixelWidth();
	};
	this.maxZoom = function() {
		return zoomCanvas.width / this.duration;
	};
	this.visibleWidth = function(zoom) {
		return zoomCanvas.width / zoom;
	};
	this.setPlayhead = function(seconds, updateLabel) {
		this.playheadTime = seconds;
		playhead.style.left = this.playheadTime * this.zoom + "px";
		updateTimeCanvas();
		if (updateLabel) {
			timeLabel.innerHTML = niceTime(seconds, true);
		}
	};
	this.activate = function() {
		for (let i = 0; i < this.trackList.length; i++) {
			if (!this.trackList[i].elem.parentNode) {
				tracks.appendChild(this.trackList[i].elem);
			}
			this.trackList[i].elem.style.display = "flex";
		}
		playlist.style.width = this.pixelWidth() + "px";
		playhead.style.left = this.playheadTime * this.zoom + "px";
		timeLabel.innerHTML = niceTime(this.playheadTime, true);
		playlistArea.scrollLeft = this.scroll * this.zoom;
		activeSession = this;
		updateZoomDragger();
		updateZoomCanvas();
		updateTimeCanvas();
	};
	this.deactivate = function() {
		for (let i = 0; i < this.trackList.length; i++) {
			this.trackList[i].elem.style.display = "none";
		}
		if (activeSession === this) {
			activeSession = undefined;
		}
	};
	this.close = function() {
		for (let i = 0; i < this.trackList.length; i++) {
			const trackElem = this.trackList[i].elem;
			trackElem.parentNode.removeChild(trackElem);
		}
		if (activeSession === this) {
			activeSession = undefined;
		}
	};
	this.open = function() {
		player.pauseIfPlaying();
		if (activeTab) {
			activeTab.deactivate();
		}
		if (!this.tab) {
			this.tab = new FileTab(this);
		}
		this.tab.activate();
	};
	this.setDuration = function(time) {
		this.duration = time;
		playlist.style.width = time * this.zoom + "px";
	};
	this.setZoom = function(zoom) {
		const maxZoom = this.maxZoom();
		if (maxZoom > zoom) {
			this.zoom = maxZoom;
		} else {
			this.zoom = zoom;
		}
		playlist.style.width = this.pixelWidth() + "px";
	};
	this.setScroll = function(time, updateNav) {
		const visibleWidth = this.visibleWidth(this.zoom);
		if (time < 0) {
			this.scroll = 0;
		} else if (time + visibleWidth > this.duration) {
			this.scroll = this.duration - visibleWidth;
		} else {
			this.scroll = time;
		}
		updateZoomDragger();
		updatePlaylistZoom();
		if (updateNav) {
			ignoreScroll = true;
			playlistArea.scrollLeft = this.scroll * this.zoom;
		}
	};
	this.remove = function() {
		if (this.tab) {
			this.tab.remove();
		}
	};
}

function closeMenus() {
	const dropdowns = document.getElementsByClassName("autoclose");
	for (let i = 0; i < dropdowns.length; i++) {
		dropdowns[i].style.display = "none";
	}
}

function movePlayhead(e) {
	player.pauseIfPlaying();
	activeSession.setPlayhead(Math.max(0, (e.clientX - playlist.getBoundingClientRect().left) / activeSession.zoom), true);
}

function isOverlapping(rect, x, y, width, height) {
	return !((x + width) < rect.left || x > rect.right || (y + height) < rect.top || y > rect.bottom);
}

function getZoomDraggerOffset(width) {
	return (zoomCanvas.width - width) / (zoomCanvas.width - minCanvasWidth) * -8;
}

function moved(e) {
	if (!activeDrag) return;
	if (activeDrag.type === "clip" || activeDrag.type === "clipdragger") {
		e.preventDefault();
		activeDrag.updateDrag(e.pageX);
	} else if (activeDrag.type === "zoomdrag") {
		e.preventDefault();
		activeSession.setScroll(activeSession.duration * (e.pageX - activeDrag.drag) / zoomCanvas.width, true);
	} else if (activeDrag.type === "zoomdragleft") {
		e.preventDefault();
		let position = e.pageX - activeDrag.dragPosition;
		let newWidth = activeDrag.lastWidth - (e.pageX - activeDrag.dragWidth);
		if (newWidth < minCanvasWidth) {
			newWidth = minCanvasWidth;
			position = activeDrag.lastPosition - minCanvasWidth;
		}
		const offset = getZoomDraggerOffset(newWidth);
		activeDrag.leftElem.style.left = offset + "px";
		activeDrag.rightElem.style.right = offset + "px";
		activeSession.setZoom(zoomCanvas.width / newWidth * activeSession.maxZoom());
		activeSession.setScroll(activeSession.duration * position / zoomCanvas.width, true);
	} else if (activeDrag.type === "zoomdragright") {
		e.preventDefault();
		let newWidth = activeDrag.lastWidth - (activeDrag.drag - e.pageX);
		if (newWidth < minCanvasWidth) {
			newWidth = minCanvasWidth;
		}
		const offset = getZoomDraggerOffset(newWidth);
		activeDrag.leftElem.style.left = offset + "px";
		activeDrag.rightElem.style.right = offset + "px";
		activeSession.setZoom(zoomCanvas.width / newWidth * activeSession.maxZoom());
		activeSession.setScroll(activeDrag.lastScroll, true);
	} else if (activeDrag === "playhead") {
		e.preventDefault();
		movePlayhead(e);
	} else if (activeDrag.type === "boxselect") {
		e.preventDefault();
		const xDistance = e.pageX - activeDrag.dragX;
		const yDistance = e.pageY - activeDrag.dragY;
		const x = activeDrag.dragX + Math.min(0, xDistance);
		const y = activeDrag.dragY + Math.min(0, yDistance);
		const width = Math.abs(xDistance);
		const height = Math.abs(yDistance);
		boxSelect.style.left = x + "px";
		boxSelect.style.top = y + "px";
		boxSelect.style.width = width + "px";
		boxSelect.style.height = height + "px";
		if (activeDrag.side) {
			selectedFiles = [];
			for (let i = 0; i < fileList.length; i++) {
				const file = fileList[i];
				const elem = file.elem;
				const rect = elem.getBoundingClientRect();
				if (isOverlapping(rect, x, y, width, height)) {
					elem.classList.add("active");
					selectedFiles.push(file);
				} else {
					elem.classList.remove("active");
				}
			}
		} else if (activeSession) {
			activeSession.selectedClips = [];
			for (let i = 0; i < activeSession.trackList.length; i++) {
				const track = activeSession.trackList[i];
				for (let j = 0; j < track.clips.length; j++) {
					const clip = track.clips[j];
					const elem = clip.parent;
					const rect = elem.getBoundingClientRect();
					if (isOverlapping(rect, x, y, width, height)) {
						clip.select();
					} else {
						elem.classList.remove("active");
					}
				}
			}
		}
	}
}

function ended() {
	if (!activeDrag) return;
	if (activeDrag.type === "boxselect") {
		boxSelect.style.display = "none";
	}
	activeDrag = undefined;
}

function centerZoom(newZoom) {
	const lastScroll = activeSession.zoomPosition();
	const lastWidth = activeSession.zoomWidth();
	activeSession.setZoom(newZoom);
	const half = lastScroll + (lastWidth - activeSession.zoomWidth()) * 0.5;
	activeSession.setScroll(half / zoomCanvas.width * activeSession.duration, true);
}

function zoomIn() {
	const newZoom = activeSession.zoom * zoomAmount;
	const visibleWidth = activeSession.visibleWidth(newZoom);
	if (activeSession.playheadTime >= activeSession.scroll && activeSession.playheadTime <= activeSession.scroll + visibleWidth) {
		activeSession.setZoom(newZoom);
		activeSession.setScroll(activeSession.playheadTime - visibleWidth * 0.5, true);
	} else {
		centerZoom(newZoom);
	}
}

function zoomOut() {
	centerZoom(activeSession.zoom / zoomAmount);
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

function holdingCtrl(e) {
	return e.ctrlKey || e.metaKey;
}

function keyDown(e) {
	if (e.target !== document.body) return;
	if (e.keyCode === 32) {
		e.preventDefault();
		togglePlayback();
	} else if (e.keyCode === 8 || e.keyCode === 46) {
		e.preventDefault();
		if (activeSession && activeSession.selectedClips.length) {
			player.pauseIfPlaying();
			activeSession.removeClips();
		} else if (selectedFiles.length) {
			for (let i = 0; i < selectedFiles.length; i++) {
				selectedFiles[i].remove();
			}
			selectedFiles = [];
		}
	} else if (e.keyCode === 75) {
		e.preventDefault();
		if (activeSession && activeSession.selectedClips.length) {
			for (let i = 0; i < activeSession.selectedClips.length; i++) {
				activeSession.selectedClips[i].splitClip(activeSession.playheadTime);
			}
		}
	} else if (e.keyCode === 219) {
		e.preventDefault();
		if (activeSession && activeSession.selectedClips.length) {
			player.pauseIfPlaying();
			for (let i = 0; i < activeSession.selectedClips.length; i++) {
				if (holdingCtrl(e)) {
					activeSession.selectedClips[i].setPlayheadInTime(activeSession.playheadTime);
				} else {
					activeSession.selectedClips[i].setStart(activeSession.playheadTime);
				}
			}
		}
	} else if (e.keyCode === 221) {
		e.preventDefault();
		if (activeSession && activeSession.selectedClips.length) {
			player.pauseIfPlaying();
			for (let i = 0; i < activeSession.selectedClips.length; i++) {
				if (holdingCtrl(e)) {
					activeSession.selectedClips[i].setPlayheadOutTime(activeSession.playheadTime);
				} else {
					activeSession.selectedClips[i].setEnd(activeSession.playheadTime);
				}
			}
		}
	} else if (holdingCtrl(e) && e.keyCode === 65) {
		e.preventDefault();
		if (activeSession) {
			activeSession.selectClips();
		}
	} else if (holdingCtrl(e) && e.keyCode === 68) {
		e.preventDefault();
		if (activeSession && activeSession.selectedClips.length) {
			player.pauseIfPlaying();
			activeSession.duplicateClips();
		}
	} else if (holdingCtrl(e) && e.keyCode === 88) {
		e.preventDefault();
		if (activeSession && activeSession.selectedClips.length) {
			player.pauseIfPlaying();
			activeSession.cutClips();
		}
	} else if (holdingCtrl(e) && e.keyCode === 67) {
		e.preventDefault();
		if (activeSession && activeSession.selectedClips.length) {
			activeSession.copyClips();
		}
	} else if (holdingCtrl(e) && e.keyCode === 86) {
		e.preventDefault();
		if (activeSession) {
			player.pauseIfPlaying();
			activeSession.pasteClips();
		}
	}
}

function startBoxSelect(e) {
	if (!isLeftClick(e)) return;
	const side = e.target.id === "sidenav" || e.target.classList.contains("boxselectable");
	if (e.target.id === "playlist" || e.target.id === "playlistarea" || e.target.classList.contains("track") || side) {
		e.preventDefault();
		activeDrag = { type: "boxselect", dragX: e.pageX, dragY: e.pageY, side: side };
		boxSelect.style.display = "block";
		boxSelect.style.left = e.pageX + "px";
		boxSelect.style.top = e.pageY + "px";
		boxSelect.style.width = "1px";
		boxSelect.style.height = "1px";
		deselectFiles();
		if (activeSession) {
			activeSession.deselectClips();
		}
	}
}

function navWheel(e) {
	if (!activeSession) return;
	if (e.ctrlKey) {
		e.preventDefault();
		if (wheelZoom.timer) {
			window.clearTimeout(wheelZoom.timer);
		}
		wheelZoom.timer = window.setTimeout(function() {
			wheelZoom.distance = undefined;
		}, 250);
		const newZoom = activeSession.zoom - (e.deltaY * activeSession.zoom * 0.01);
		if (!wheelZoom.distance) {
			wheelZoom.distance = (e.clientX - playlist.getBoundingClientRect().left) - (activeSession.scroll * activeSession.zoom);
		}
		const newScroll = activeSession.scroll + (wheelZoom.distance / activeSession.zoom) - (wheelZoom.distance / newZoom);
		activeSession.setZoom(newZoom);
		activeSession.setScroll(newScroll, true);
	}
}

function fakeNavEvents(e) {
	if (e.ctrlKey) {
		navWheel(e);
	} else {
		e.preventDefault();
		playlistArea.scrollLeft += e.deltaX;
		playlistArea.scrollTop += e.deltaY;
	}
}

function dragFile(e) {
	if (e.dataTransfer && e.dataTransfer.files) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	}
}

function dropFile(e) {
	e.preventDefault();
	if (e.dataTransfer && e.dataTransfer.files) {
		for (let i = 0; i < e.dataTransfer.files.length; i++) {
			const file = e.dataTransfer.files[i];
			listFile(file);
		}
	}
}

function setup() {
	interimTranscript = document.getElementById("interimtranscript");
	transcriptPlayer = document.getElementById("transcriptplayer");
	finalTranscript = document.getElementById("finaltranscript");
	waveDetailElem = document.getElementById("wavedetaillabel");
	zoomAmountElem = document.getElementById("zoomamountlabel");
	transcriptMenu = document.getElementById("transcriptmenu");
	navigationArea = document.getElementById("navigationarea");
	transcriptElem = document.getElementById("transcript");
	popupOverlay = document.getElementById("popupoverlay");
	playlistArea = document.getElementById("playlistarea");
	timelineCanvas = document.getElementById("timeline");
	presetMenu = document.getElementById("presetmenu");
	playButton = document.getElementById("playbutton");
	prefsMenu = document.getElementById("prefsmenu");
	boxSelect = document.getElementById("boxselect");
	presetList = document.getElementById("presets");
	fileTabs = document.getElementById("filetabs");
	playlist = document.getElementById("playlist");
	playback = document.getElementById("playback");
	playhead = document.getElementById("playhead");
	zoomDrag = document.getElementById("zoomer");
	zoomCanvas = document.getElementById("zoom");
	sideNav = document.getElementById("sidenav");
	timeLabel = document.getElementById("time");
	topNav = document.getElementById("topnav");
	editor = document.getElementById("editor");
	tracks = document.getElementById("tracks");
	step1 = document.getElementById("step1");
	step2 = document.getElementById("step2");
	popup = document.getElementById("popup");
	window.addEventListener("dragenter", dragFile);
	window.addEventListener("dragover", dragFile);
	window.addEventListener("drop", dropFile);
	window.addEventListener("mousemove", moved);
	window.addEventListener("mouseup", ended);
	window.addEventListener("resize", resize);
	window.addEventListener("orientationchange", resize);
	playlistArea.addEventListener("scroll", navScroll);
	playlistArea.addEventListener("wheel", navWheel);
	playback.addEventListener("wheel", fakeNavEvents);
	navigationArea.addEventListener("wheel", fakeNavEvents);
	timeLabel.addEventListener("keydown", preventTimeInput);
	timeLabel.addEventListener("blur", forceTime);
	window.addEventListener("mousedown", startBoxSelect);
	timelineCanvas.addEventListener("mousedown", function(e) {
		if (!isLeftClick(e)) return;
		e.preventDefault();
		activeDrag = "playhead";
	});
	timelineCanvas.addEventListener("click", movePlayhead);
	window.addEventListener("beforeunload", annoy);
	window.addEventListener("keydown", keyDown);
	window.addEventListener("click", function(e) {
		if (!e.target.matches(".autoclosebutton")) {
			closeMenus();
		}
	});
	playlistArea.addEventListener("dragover", function(e) {
		if (activeSession && e.target === this) {
			e.preventDefault();
			activeSession.addTrack();
			e.dataTransfer.dropEffect = "copy";
		}
	});
	playlistArea.addEventListener("mousemove", function(e) {
		if (activeSession && e.target === this && activeDrag && activeDrag.type === "clip") {
			e.preventDefault();
			activeDrag.changeTrack(activeSession.addTrack());
		}
	});
	playlistArea.addEventListener("click", function(e) {
		if (activeSession && e.target === this) {
			e.preventDefault();
			activeSession.addTrack();
		}
	});
	requestFrame(draw);
}

function closePopup() {
	popupOverlay.style.display = "none";
	popup.style.display = "none";
}

function toggle(elem) {
	const dropdown = elem.nextElementSibling;
	const previous = dropdown.style.display;
	closeMenus();
	dropdown.style.display = previous === "block" ? "none" : "block";
}

function listPreset(name) {
	const parent = document.createElement("div");
	parent.className = "filefolder open";
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
		parent.classList.toggle("open");
		files.style.display = previous === "none" ? "block" : "none";
	});
	//fileList.push({ elem: parent });
	return { bar: loader, list: files, parent: parent };
}

function loadPresets() {
	if (presetsLoaded) {
		openPopup("preset");
	} else {
		urlJson("presets.json", function(presets) {
			presetsLoaded = true;
			openPopup("preset");
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
						closePopup();
						setMenu("step2");
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

function transcribe() {
	openPopup("transcript");
}

function openPrefs() {
	openPopup("prefs");
}

function setZoomAmount(elem) {
	zoomAmountElem.innerHTML = elem.value + "x";
	zoomAmount = elem.value;
}

function toggleAutoScroll(elem) {
	autoScroll = elem.checked;
}

function setWaveDetail(elem) {
	waveDetailElem.innerHTML = elem.value;
	waveDetail = elem.value;
	updateClipCanvases();
}

function toggleShake(elem) {
	player.toggleShakeAnalyser(elem.checked);
}

function newSession() {
	const sessionName = window.prompt("Please enter a session name", "Untitled Session");
	if (sessionName) {
		setMenu("editor");
		if (!playlistSetup) {
			setupPlaylist();
		}
		const session = new Session(sessionName, 10);
		listFile(session);
		session.open();
	}
}

function loadSession(elem) {
	console.log(elem.files[0]);
	elem.value = null;
}

function exportSession() {
	// todo: export each session as audition .sesx and all subfiles using jszip
	// also add option for wav export
}

function importFile(elem) {
	for (let i = 0; i < elem.files.length; i++) {
		const file = elem.files[i];
		listFile(file);
	}
	elem.value = null;
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

function record(elem) {
	if (player.recording) {
		player.stopRecording();
		elem.classList.remove("active");
	} else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
		navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function(stream) {
			player.startRecording(stream, true);
			elem.classList.add("active");
		});
	}
}

function recordTranscript(elem) {
	if (player.recording) {
		player.stopRecording();
		if (recognition) {
			recognition.stop();
		}
		elem.src = "microphone.png";
	} else {
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function(stream) {
				player.startRecording(stream, false);
				elem.src = "micactive.png";
			});
		}
		if (!recognition) {
			setupRecognition();
		}
		if (recognition) {
			recognition.start();
		}
	}
}

function submitTranscript() {
	closePopup();
	setMenu("step2");
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