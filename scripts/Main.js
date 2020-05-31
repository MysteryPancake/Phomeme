"use strict";

let lookup;
let inputData;
let outputData;
let dictionary;

function requestFile(method, file, error, func, data) {
	const request = new XMLHttpRequest();
	request.open(method, file, true);
	request.onreadystatechange = function() {
		if (this.readyState === 4 && this.status === 200) {
			func(this.responseText);
		}
	};
	request.onerror = function() {
		document.getElementById("title").textContent = "Error";
		document.getElementById("waiting").textContent = error + " Try installing a cross-origin extension.";
		document.getElementById("spinner").style.display = "none";
	};
	request.send(data);
}

function addLink(name, data, type, extension) {
	const blob = new Blob([data], { type: type });
	const url = window.URL.createObjectURL(blob);
	const element = document.getElementById(name);
	element.href = url;
	element.download = name + "." + extension;
}

function readFile(file, func) {
	const reader = new FileReader();
	reader.onload = function() {
		func(this.result, file.name, file.type);
	};
	reader.readAsText(file, "UTF-8");
}

function addBlob(file, extension, isInput) {
	const url = window.URL.createObjectURL(file);
	const player = document.getElementById(isInput ? "inputPlayer" : "outputPlayer");
	player.style.display = "inline-block";
	player.src = url;
	const name = isInput ? "input" : "output";
	const link = document.getElementById(name);
	link.style.display = "block";
	link.href = url;
	link.download = name + "." + extension;
}

function checkJson(element) {
	const isInput = element.id === "inputAudio";
	const file = element.files[0];
	if (!file) return;
	const lower = file.name.toLowerCase();
	if (lower.endsWith("json") || lower.endsWith("txt")) {
		readFile(file, function(content) {
			const transcript = document.getElementById(isInput ? "inputScript" : "outputScript");
			transcript.textContent = lower.endsWith("txt") ? content : JSON.parse(content).transcript;
		});
	} else if (file.type.startsWith("audio")) {
		addBlob(file, file.name.split(".").pop(), isInput);
	}
}

function updatePresets(element) {
	const presets = document.getElementsByClassName("preset");
	const div = document.getElementById(element.value);
	for (let i = 0; i < presets.length; i++) {
		const preset = presets[i];
		preset.style.display = div === preset ? "block" : "none";
		for (let j = 0; j < preset.childNodes.length; j++) {
			preset.childNodes[j].required = div === preset;
		}
	}
}

function getText(node) {
	if (node.childNodes.length) {
		let result = "";
		for (let i = 0; i < node.childNodes.length; i++) {
			result += getText(node.childNodes[i]) + " ";
		}
		return result;
	} else {
		return node.textContent;
	}
}

function setWeight(elem) {
	document.getElementById(elem.id + "Label").textContent = (elem.value * 100) + "%";
	updateDownloads();
}

function updateDownloads() {
	const final = (dictionary ? textToSpeech : speechToSpeech)(inputData, outputData, {
		method: document.getElementById("sortMethod").value,
		matchWords: document.getElementById("matchWords").checked,
		matchOneForward: document.getElementById("matchOneForward").checked,
		matchOneBackward: document.getElementById("matchOneBackward").checked,
		matchPunctuation: document.getElementById("matchPunctuation").checked,
		matchGeneral: document.getElementById("matchGeneral").checked,
		ignoreWordGaps: document.getElementById("ignoreWordGaps").checked,
		overlapStart: parseFloat(document.getElementById("overlapStart").value),
		overlapEnd: parseFloat(document.getElementById("overlapEnd").value),
		sampleRate: parseInt(document.getElementById("sampleRate").value),
		methodWeight: parseFloat(document.getElementById("methodWeight").value),
		forwardWeight: parseFloat(document.getElementById("forwardWeight").value),
		backwardWeight: parseFloat(document.getElementById("backwardWeight").value)
	});
	addLink("session", final, "application/xml", "sesx");
}

function microphone(element) {
	const isInput = element.id === "inputMic";
	const transcript = document.getElementById(isInput ? "inputScript" : "outputScript");
	if (element.active) {
		if (element.recognition) {
			element.recognition.stop();
		}
		if (element.recorder) {
			element.recorder.stop();
		}
		transcript.setAttribute("contenteditable", true);
		element.src = "microphone.png";
		element.active = false;
	} else {
		const Speech = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.oSpeechRecognition || window.msSpeechRecognition;
		if (Speech) {
			transcript.setAttribute("contenteditable", false);
			if (!element.recognition) {
				element.recognition = new Speech();
				element.recognition.continuous = true;
				element.recognition.interimResults = true;
				let final = transcript.innerHTML;
				element.recognition.onresult = function(e) {
					let temp = "";
					for (let i = e.resultIndex; i < e.results.length; i++) {
						if (event.results[i].isFinal) {
							final += event.results[i][0].transcript;
						} else {
							temp += event.results[i][0].transcript;
						}
					}
					transcript.innerHTML = final + "<span>" + temp + "</span>";
				};
				element.recognition.onend = function() {
					transcript.innerHTML = final;
				};
			}
			element.recognition.start();
		}
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function(stream) {
				element.recorder = new MediaRecorder(stream);
				const chunks = [];
				element.recorder.ondataavailable = function(e) {
					chunks.push(e.data);
				};
				element.recorder.onstop = function() {
					stream.getTracks()[0].stop();
					const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
					//document.getElementById(isInput ? "inputAudio" : "outputAudio").files = new FileList(new File([blob], "filename"));
					addBlob(blob, "ogg", isInput);
				};
				element.recorder.start();
			}).catch(console.error);
		}
		element.src = "micactive.png";
		element.active = true;
	}
	return false;
}

function complete() {
	requestFile("GET", "lookup.json", "Couldn't load lookup table!", function(response) {
		lookup = JSON.parse(response);
		updateDownloads();
		document.getElementById("spinner").style.display = "none";
		document.getElementById("waiting").style.display = "none";
		document.getElementById("options").style.display = "block";
	});
}

function addOutput(data, name, type) {
	const extension = name ? name.split(".").pop() : "json";
	addLink("output", data, type || "application/json", extension);
	if (extension === "json") {
		data = JSON.parse(data);
	}
	outputData = { data: data, type: extension, file: "output.wav" };
	complete();
}

function finalResponse() {
	document.getElementById("waiting").textContent = "Response received! Waiting for the final response...";
	const file = document.getElementById("outputAudio").files[0];
	if (file) {
		if (file.type.startsWith("audio")) {
			const output = new FormData();
			output.append("audio", file);
			output.append("transcript", getText(document.getElementById("outputScript")));
			requestFile("POST", "http://gentle-demo.lowerquality.com/transcriptions?async=false", "Couldn't receive a response!", addOutput, output);
		} else {
			readFile(file, addOutput);
		}
	} else {
		document.getElementById("waiting").textContent = "Loading phone dictionary...";
		document.getElementById("sortMethod").value = "longest";
		requestFile("GET", "phonedictionary.txt", "Couldn't load phone dictionary!", function(response) {
			dictionary = {};
			const lines = response.split("\n");
			for (let i = 0; i < lines.length; i++) {
				const phones = lines[i].split(" ");
				dictionary[phones[0]] = phones.slice(1);
			}
			const data = getText(document.getElementById("outputScript"));
			addLink("output", data, "text/plain", "txt");
			outputData = { data: data, type: "txt", file: "output.wav" };
			complete();
		});
	}
}

function addInput(data, name, type) {
	const extension = name ? name.split(".").pop() : "json";
	addLink("input", data, type || "application/json", extension);
	if (extension === "json") {
		data = JSON.parse(data);
	}
	inputData = { data: data, type: extension, file: "input.wav" };
	finalResponse();
}

function crossOrigin(func) {
	const input = document.getElementById("inputAudio").files[0];
	const output = document.getElementById("outputAudio").files[0];
	if (input && input.type.startsWith("audio") || output && output.type.startsWith("audio")) {
		const request = new XMLHttpRequest();
		request.open("GET", "http://gentle-demo.lowerquality.com", true);
		request.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				func();
			}
		};
		request.onerror = function() {
			window.alert("Please install a cross-origin extension for this to work!");
		};
		request.send();
	} else {
		func();
	}
}

function phomeme() {
	crossOrigin(function() {
		const preset = document.getElementById("preset").value;
		if (preset === "custom") {
			const file = document.getElementById("inputAudio").files[0];
			if (file.type.startsWith("audio")) {
				const input = new FormData();
				input.append("audio", file);
				input.append("transcript", getText(document.getElementById("inputScript")));
				requestFile("POST", "http://gentle-demo.lowerquality.com/transcriptions?async=false", "Couldn't receive a response!", addInput, input);
			} else {
				readFile(file, addInput);
			}
		} else {
			document.getElementById("waiting").textContent = "Loading " + preset + "...";
			requestFile("GET", preset + "/complete.json", "Couldn't load " + preset + "!", addInput);
		}
		document.getElementById("form").style.display = "none";
		document.getElementById("result").style.display = "block";
	});
	return false;
}