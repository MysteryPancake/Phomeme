"use strict";

const fs = require("fs");
const session = require("./session.js");
const triphone = require("./triphone.js");
const convert = require("./convert.js");

const matchWords = true;
const matchDiphones = true;
const matchTriphones = true;
const chooseMethod = "longest";
const overlapStart = 0;
const overlapEnd = 0.025;

function dictionary() {
	const dict = {};
	const lines = fs.readFileSync("WEBSITE/phonedictionary.txt", "utf8").split("\n");
	for (let i = 0; i < lines.length; i++) {
		const phones = lines[i].split(" ");
		dict[phones[0]] = phones.slice(1);
	}
	return dict;
}

const punctuation = { "!": true, "?": true, ".": true };

function convertSentence(sentence) {
	const words = sentence.toLowerCase().match(/\w+(?:'\w+)*|(?<![!?.])[!?.]/g);
	const dict = dictionary();
	const transcript = {
		transcript: sentence,
		words: [],
		phones: []
	};
	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		if (punctuation[word]) continue;
		transcript.words.push({
			prev: words[i - 1],
			next: words[i + 1],
			phone: word
		});
		const phones = dict[word];
		if (phones) {
			transcript.words[transcript.words.length - 1].phones = [];
			for (let j = 0; j < phones.length; j++) {
				const data = {
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

function addClips(targets, phones, mix, method, diphones, triphones, length, func) {
	for (let i = 0; i < targets.length; i++) {
		const target = targets[i];
		const words = phones[target.phone];
		if (words) {
			const match = triphone(target, words, method, diphones, triphones);
			mix.addClip(match.file, target.phone, length, length + match.dur, match.start, match.end, 1);
			length += match.dur;
		} else {
			length = func(target, length) || length;
		}
	}
	return length;
}

function sayWords(sentence) {
	const input = convert(JSON.parse(fs.readFileSync("input.json")), "input.wav");
	const output = convertSentence(sentence);
	const mix = new session("session", 32, 44100);
	mix.overlapStart = overlapStart;
	mix.overlapEnd = overlapEnd;
	if (matchWords && input.words && output.words) {
		addClips(output.words, input.words, mix, chooseMethod, matchDiphones, matchTriphones, 0, function(target, length) {
			console.log("USING PHONES FOR: " + target.phone);
			if (target.phones) {
				return addClips(target.phones, input.phones, mix, chooseMethod, matchDiphones, matchTriphones, length, function(data) {
					console.log("MISSING PHONE: " + data.phone);
				});
			} else {
				console.log("MISSING DEFINITION: " + target.phone);
			}
		});
	} else {
		addClips(output.phones, input.phones, mix, chooseMethod, matchDiphones, matchTriphones, 0, function(target) {
			console.log("MISSING PHONE: " + target.phone);
		});
	}
	mix.save();
}

sayWords("sample text");