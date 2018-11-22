"use strict";

const fs = require("fs");
const Session = require("./session.js");
const triphone = require("./triphone.js");
const convert = require("./convert.js");

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

function speak(sentence, chooseMethod, matchWords, matchDiphones, matchTriphones, matchPunctuation, overlapStart, overlapEnd) {
	const input = convert(fs.readFileSync("input.json", "utf8"), "json", "input.wav", matchPunctuation);
	const output = convert(sentence, "txt", "input.wav", matchPunctuation);
	const mix = new Session("session", 32, 44100);
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

speak("sample text", "longest", true, true, true, true, 0, 0.025);