"use strict";

var recorder;
var inputJson;
var outputJson;
var dictionary;
var recognition;

function requestFile(method, file, error, func, data) {
	var request = new XMLHttpRequest();
	request.open(method, file, true);
	request.onreadystatechange = function() {
		if (this.readyState === 4 && this.status === 200) {
			func(this.responseText);
		}
	};
	request.onerror = function() {
		document.getElementById("title").innerHTML = "Error";
		document.getElementById("waiting").innerHTML = error + " Try using a cross-origin extension.";
		document.getElementById("spinner").style.display = "none";
	};
	request.send(data);
}

function addLink(name, data, type, extension) {
	var element = document.getElementById(name);
	element.href = "data:" + type + ";charset=utf-8," + encodeURIComponent(data);
	element.download = name + "." + extension;
}

function readJson(file, func) {
	var reader = new FileReader();
	reader.onload = function(e) {
		func(e.target.result);
	};
	reader.readAsText(file, "UTF-8");
}

function addBlob(file, extension, isInput) {
	var url = window.URL.createObjectURL(file);
	var player = document.getElementById(isInput ? "inputPlayer" : "outputPlayer");
	player.style.display = "inline-block";
	player.src = url;
	var name = isInput ? "input" : "output";
	var link = document.getElementById(name);
	link.style.display = "block";
	link.href = url;
	link.download = name + "." + extension;
}

function checkJson(element) {
	var isInput = element.id === "inputAudio";
	var file = element.files[0];
	if (file.type === "application/json") {
		readJson(file, function(content) {
			var transcript = document.getElementById(isInput ? "inputScript" : "outputScript");
			transcript.value = JSON.parse(content).transcript;
		});
	} else if (file.type.startsWith("audio")) {
		addBlob(file, file.name.split(".").pop(), isInput);
	}
	/*var isInput = element.id === "inputAudio";
	for (var i = 0; i < element.files.length; i++) {
		var file = element.files[i];
		// todo
	}*/
}

function updatePresets(element) {
	var presets = document.getElementsByClassName("preset");
	var div = document.getElementById(element.value);
	for (var i = 0; i < presets.length; i++) {
		var preset = presets[i];
		preset.style.display = div === preset ? "block" : "none";
		for (var j = 0; j < preset.childNodes.length; j++) {
			preset.childNodes[j].required = div === preset;
		}
	}
}

function updateDownloads() {
	var matchWords = document.getElementById("matchWords").checked;
	var matchDiphones = document.getElementById("matchDiphones").checked;
	var matchTriphones = document.getElementById("matchTriphones").checked;
	var chooseMethod = document.getElementById("chooseMethod").value;
	var overlapStart = parseFloat(document.getElementById("overlapStart").value);
	var overlapEnd = parseFloat(document.getElementById("overlapEnd").value);
	var final;
	if (dictionary) {
		var sentence = document.getElementById("outputScript").value;
		outputJson = convertSentence(sentence, dictionary);
		addLink("output", JSON.stringify(outputJson), "application/json", "json");
		final = speak(inputJson, outputJson, matchWords, matchDiphones, matchTriphones, chooseMethod, overlapStart, overlapEnd);
	} else {
		final = sing(inputJson, outputJson, matchWords, matchDiphones, matchTriphones, chooseMethod, overlapStart, overlapEnd);
	}
	addLink("session", final, "text/xml", "sesx");
}

function microphone(element) {
	if (element.active) {
		if (recognition) {
			recognition.stop();
		}
		if (recorder) {
			recorder.stop();
		}
		element.src = "microphone.png";
		element.active = false;
	} else {
		var isInput = element.id === "inputMic";
		if (window.webkitSpeechRecognition) {
			recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
			recognition.continuous = true;
			recognition.interimResults = true;
			var script = "";
			var transcript = document.getElementById(isInput ? "inputScript" : "outputScript");
			recognition.onresult = function(e) {
				var temp = script;
				for (var i = e.resultIndex; i < e.results.length; i++) {
					temp += e.results[i][0].transcript;
					if (event.results[i].isFinal) {
						script += e.results[i][0].transcript;
					}
				}
				transcript.value = temp;
			};
			recognition.onend = function() {
				transcript.value = script;
			};
			recognition.start();
		}
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function(stream) {
				recorder = new MediaRecorder(stream);
				var chunks = [];
				recorder.ondataavailable = function(e) {
					chunks.push(e.data);
				};
				recorder.onstop = function() {
					stream.getTracks()[0].stop();
					var blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
					//document.getElementById(isInput ? "inputAudio" : "outputAudio").files = blob;
					addBlob(blob, "ogg", isInput);
				};
				recorder.start();
			}).catch(console.error);
		}
		element.src = "micactive.png";
		element.active = true;
	}
	return false;
}

function complete() {
	updateDownloads();
	document.getElementById("spinner").style.display = "none";
	document.getElementById("waiting").style.display = "none";
	document.getElementById("options").style.display = "block";
}

function addOutput(data) {
	addLink("output", data, "application/json", "json");
	outputJson = JSON.parse(data);
	complete();
}

function finalResponse() {
	document.getElementById("waiting").innerHTML = "Response received! Waiting for the final response...";
	var file = document.getElementById("outputAudio").files[0];
	if (file) {
		if (file.type === "application/json") {
			readJson(file, addOutput);
		} else {
			var output = new FormData();
			output.append("audio", file);
			output.append("transcript", document.getElementById("outputScript").value);
			requestFile("POST", "http://gentle-demo.lowerquality.com/transcriptions?async=false", "Couldn't receive a response!", addOutput, output);
		}
	} else {
		document.getElementById("waiting").innerHTML = "Loading phone dictionary...";
		document.getElementById("chooseMethod").value = "average";
		requestFile("GET", "phonedictionary.txt", "Couldn't load phone dictionary!", function(response) {
			dictionary = {};
			var lines = response.split("\n");
			for (var i = 0; i < lines.length; i++) {
				var phones = lines[i].split(" ");
				dictionary[phones[0]] = phones.slice(1);
			}
			complete();
		});
	}
}

function addInput(data) {
	addLink("input", data, "application/json", "json");
	inputJson = JSON.parse(data);
	finalResponse();
}

function phomeme() {
	var preset = document.getElementById("preset").value;
	if (preset === "custom") {
		var file = document.getElementById("inputAudio").files[0];
		if (file.type === "application/json") {
			readJson(file, addInput);
		} else {
			var input = new FormData();
			input.append("audio", file);
			input.append("transcript", document.getElementById("inputScript").value);
			requestFile("POST", "http://gentle-demo.lowerquality.com/transcriptions?async=false", "Couldn't receive a response!", addInput, input);
		}
	} else {
		document.getElementById("waiting").innerHTML = "Loading " + preset + "...";
		requestFile("GET", preset + "/complete.json", "Couldn't load " + preset + "!", addInput);
	}
	document.getElementById("form").style.display = "none";
	document.getElementById("result").style.display = "block";
	return false;
}