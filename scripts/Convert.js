"use strict";

function convertSentence(sentence, matchPunctuation) {
	var words = sentence.toLowerCase().match(/\w+(?:'\w+)*|[!?.](?![!?.])/g);
	var punctuation = { "!": true, "?": true, ".": true };
	var transcript = {
		transcript: sentence,
		words: [],
		phones: []
	};
	for (var i = 0; i < words.length; i++) {
		var word = words[i];
		if (punctuation[word]) continue;
		transcript.words.push({
			prev: words[i - (matchPunctuation && punctuation[words[i - 1]] ? 1 : 2)],
			next: words[i + (matchPunctuation && punctuation[words[i + 1]] ? 1 : 2)],
			phone: word
		});
		var phones = dictionary[word];
		if (phones) {
			transcript.words[transcript.words.length - 1].phones = [];
			for (var j = 0; j < phones.length; j++) {
				var data = {
					prev: phones[j - 1],
					next: phones[j + 1],
					phone: phones[j]
				};
				transcript.words[transcript.words.length - 1].phones.push(data);
				transcript.phones.push(data);
			}
		} else {
			console.log("MISSING DEFINITION: " + word);
		}
	}
	return transcript;
}

function convertTextGrid(transcript, str, file, matchExact) {
	var lines = str.split("\n");
	var mode = "words";
	var intervals = 0;
	var size = 2;
	var prev;
	while (lines.length > 0) {
		var line = lines.shift().trim();
		if (line.endsWith("<exists>")) {
			size = parseInt(lines.shift().split("=").pop().trim());
		} else if (line.endsWith("\"IntervalTier\"")) {
			intervals++;
			prev = undefined;
			for (var i = 0; i < 3; i++) {
				lines.shift();
			}
			if (mode) {
				var count = parseInt(lines.shift().split("=").pop());
				for (var j = 0; j < count; j++) {
					var xmin = lines.shift();
					if (xmin.match(/\[[0-9]+\]:/)) {
						xmin = lines.shift();
					}
					xmin = parseFloat(xmin.split("=").pop());
					var xmax = parseFloat(lines.shift().split("=").pop());
					var text = lines.shift().split("=").pop().trim().slice(1, -1);
					if (mode === "words") {
						text = text.toLowerCase();
					} else {
						var match = matchExact ? text : lookup.textgrid[text];
						if (!match) {
							console.log("USING OOV FOR: " + text);
						}
						text = match || "OOV";
					}
					if (prev) {
						transcript[mode][prev][transcript[mode][prev].length - 1].next = text;
					}
					transcript[mode][text] = transcript[mode][text] || [];
					var data = {
						start: xmin,
						end: xmax,
						dur: xmax - xmin,
						phone: text,
						prev: prev,
						file: file
					};
					transcript[mode][text].push(data);
					if (mode === "phones") {
						for (var word in transcript.words) {
							for (var k = 0; k < transcript.words[word].length; k++) {
								var phone = transcript.words[word][k];
								if (xmin >= phone.start && xmax <= phone.end) {
									phone.phones = phone.phones || [];
									phone.phones.push(data);
								}
							}
						}
					}
					prev = text;
				}
			}
			mode = intervals + 1 === size && "phones";
		}
	}
	return transcript;
}

function convertJson(transcript, json, file, matchPunctuation, matchExact) {
	var prev = {};
	var punctuation = { "?": true, "!": true, ".": true };
	for (var i = 0; i < json.words.length; i++) {
		var word = json.words[i];
		if (word.case === "not-found-in-audio") continue;
		var aligned = word.word.toLowerCase();
		var char = json.transcript.charAt(word.endOffset);
		if (prev.word) {
			transcript.words[prev.word][transcript.words[prev.word].length - 1].next = matchPunctuation && punctuation[char] ? char : aligned;
		}
		transcript.words[aligned] = transcript.words[aligned] || [];
		transcript.words[aligned].push({
			start: word.start,
			end: word.end,
			dur: word.end - word.start,
			phone: aligned,
			prev: matchPunctuation && punctuation[char] ? prev.char : prev.word,
			phones: [],
			file: file
		});
		prev = { word: aligned, char: char };
		var start = word.start;
		for (var j = 0; j < word.phones.length; j++) {
			var phone = word.phones[j];
			var match = matchExact ? phone.phone : lookup.json[phone.phone];
			if (!match) {
				console.log("USING OOV FOR: " + phone.phone);
				match = "OOV";
			}
			if (prev.phone) {
				transcript.phones[prev.phone][transcript.phones[prev.phone].length - 1].next = match;
			}
			transcript.phones[match] = transcript.phones[match] || [];
			var data = {
				start: start,
				end: start + phone.duration,
				dur: phone.duration,
				phone: match,
				prev: prev.phone,
				file: file
			};
			transcript.words[aligned][transcript.words[aligned].length - 1].phones.push(data);
			transcript.phones[match].push(data);
			start += phone.duration;
			prev.phone = match;
		}
	}
	return transcript;
}

function convertMultiple(transcript, json, matchPunctuation, matchExact) {
	for (var i = 0; i < json.length; i++) {
		var script = convert(json[i].script, json[i].type, json[i].file, matchPunctuation, matchExact);
		for (var word in script.words) {
			transcript.words[word] = transcript.words[word] || [];
			for (var j = 0; j < script.words[word].length; j++) {
				transcript.words[word].push(script.words[word][j]);
			}
		}
		for (var phone in script.phones) {
			transcript.phones[phone] = transcript.phones[phone] || [];
			for (var k = 0; k < script.phones[phone].length; k++) {
				transcript.phones[phone].push(script.phones[phone][k]);
			}
		}
	}
	return transcript;
}

function convert(data, type, file, matchPunctuation, matchExact) {
	var transcript = {
		words: {},
		phones: {}
	};
	var lower = type.toLowerCase();
	if (lower === "textgrid") {
		return convertTextGrid(transcript, data, file, matchExact);
	} else if (lower === "json") {
		var json = JSON.parse(data);
		if (Array.isArray(json)) {
			return convertMultiple(transcript, json, matchPunctuation, matchExact);
		} else {
			return convertJson(transcript, json, file, matchPunctuation, matchExact);
		}
	} else {
		return convertSentence(data, matchPunctuation);
	}
}