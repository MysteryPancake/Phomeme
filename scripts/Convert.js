"use strict";

var punctuation = { "?": true, "!": true, ".": true };

function convert(json, file) {
	var transcript = {
		words: {},
		phones: {}
	};
	if (Array.isArray(json)) {
		for (var i = 0; i < json.length; i++) {
			var script = convert(json[i].script, json[i].file);
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
	} else {
		var prev;
		for (var i = 0; i < json.words.length; i++) {
			var word = json.words[i];
			if (word.case === "not-found-in-audio") continue;
			var aligned = word.word.toLowerCase();
			var char = json.transcript.charAt(word.endOffset);
			if (prev && prev.word) {
				transcript.words[prev.word][transcript.words[prev.word].length - 1].next = punctuation[char] ? char : aligned;
			}
			transcript.words[aligned] = transcript.words[aligned] || [];
			transcript.words[aligned].push({
				start: word.start,
				end: word.end,
				dur: word.end - word.start,
				phone: aligned,
				prev: punctuation[char] ? prev && prev.char : prev && prev.word,
				phones: [],
				file: file
			});
			prev = { word: aligned, char: char };
			var start = word.start;
			var prevPhone;
			for (var j = 0; j < word.phones.length; j++) {
				var phone = word.phones[j];
				var simple = phone.phone.split("_").shift().toUpperCase();
				if (prevPhone) {
					transcript.phones[prevPhone][transcript.phones[prevPhone].length - 1].next = simple;
				}
				transcript.phones[simple] = transcript.phones[simple] || [];
				var data = {
					start: start,
					end: start + phone.duration,
					dur: phone.duration,
					phone: simple,
					prev: prevPhone,
					file: file
				};
				transcript.words[aligned][transcript.words[aligned].length - 1].phones.push(data);
				transcript.phones[simple].push(data);
				start += phone.duration;
				prevPhone = simple;
			}
		}
	}
	return transcript;
}