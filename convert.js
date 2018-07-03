"use strict";

const fs = require("fs");
const session = require("./session.js");

function saveJson(transcript) {
	fs.writeFileSync("input.json", JSON.stringify(transcript));
}

function process(phones) {
	const mix = new session("session", 16, 16000);
	for (let phone in phones) {
		for (let i = 0; i < phones[phone].length; i++) {
			mix.addClip(phones[phone][i].file, phone, phones[phone][i].start, phones[phone][i].end, phones[phone][i].start, phones[phone][i].end, 1);
		}
	}
	mix.save();
}

module.exports = function(json, file) {
	if (json.transcript === "<Multiple Transcripts>") {
		return json;
	}
	const transcript = {
		transcript: json.transcript,
		words: {},
		phones: {}
	};
	let prevWord, prevPhone;
	for (let i = 0; i < json.words.length; i++) {
		const word = json.words[i];
		if (word.case === "not-found-in-audio") continue;
		const aligned = word.word.toLowerCase();
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
		let start = word.start;
		for (let j = 0; j < word.phones.length; j++) {
			const phone = word.phones[j];
			if (prevPhone) {
				transcript.phones[prevPhone][transcript.phones[prevPhone].length - 1].next = phone.phone;
			}
			transcript.phones[phone.phone] = transcript.phones[phone.phone] || [];
			const data = {
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
	//saveJson(transcript);
	//process(phones);
	return transcript;
};