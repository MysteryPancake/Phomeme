"use strict";

function convert(json, file) {
	if (json.transcript === "<Multiple Transcripts>") {
		return json;
	}
	var transcript = {
		transcript: json.transcript,
		words: {},
		phones: {}
	};
	var prevWord;
	for (var i = 0; i < json.words.length; i++) {
		var word = json.words[i];
		if (word.case === "not-found-in-audio") continue;
		var aligned = word.word.toLowerCase();
		if (prevWord) {
			transcript.words[prevWord][transcript.words[prevWord].length - 1].next = aligned;
		}
		transcript.words[aligned] = transcript.words[aligned] || [];
		transcript.words[aligned].push({
			start: word.start,
			end: word.end,
			dur: word.end - word.start,
			phone: aligned,
			prev: prevWord,
			phones: [],
			file: file
		});
		prevWord = aligned;
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
	return transcript;
}