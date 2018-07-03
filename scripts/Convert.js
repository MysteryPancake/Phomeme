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
	var prevWord, prevPhone;
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
		for (var j = 0; j < word.phones.length; j++) {
			var phone = word.phones[j];
			if (prevPhone) {
				transcript.phones[prevPhone][transcript.phones[prevPhone].length - 1].next = phone.phone;
			}
			transcript.phones[phone.phone] = transcript.phones[phone.phone] || [];
			var data = {
				start: start,
				end: start + phone.duration,
				dur: phone.duration,
				phone: phone.phone,
				prev: prevPhone,
				file: file
			};
			transcript.words[aligned][transcript.words[aligned].length - 1].phones.push(data);
			transcript.phones[phone.phone].push(data);
			start += phone.duration;
			prevPhone = phone.phone;
		}
	}
	return transcript;
}