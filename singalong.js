"use strict";

const fs = require("fs");
const Session = require("./session.js");
const triphone = require("./triphone.js");
const convert = require("./convert.js");

function addClip(target, phones, mix, method, diphones, triphones, func) {
	if (phones) {
		const match = triphone(target, phones, method, diphones, triphones);
		const stretch = Math.min(8, target.dur / match.dur);
		mix.addClip(match.file, target.phone, target.start, target.end, match.start * stretch, match.end * stretch, stretch);
	} else {
		func(target);
	}
}

function sing(vocals, acapella, chooseMethod, matchWords, matchDiphones, matchTriphones, matchPunctuation, matchExact, overlapStart, overlapEnd) {
	const input = convert(fs.readFileSync(vocals + ".json", "utf8"), "json", vocals + ".wav", matchPunctuation, matchExact);
	const output = convert(fs.readFileSync(acapella + ".json", "utf8"), "json", acapella + ".wav", matchPunctuation, matchExact);
	const mix = new Session("session", 32, 44100);
	mix.overlapStart = overlapStart;
	mix.overlapEnd = overlapEnd;
	if (matchWords && input.words && output.words) {
		for (let word in output.words) {
			for (let i = 0; i < output.words[word].length; i++) {
				addClip(output.words[word][i], input.words[word], mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
					console.log("USING PHONES FOR: " + target.phone);
					for (let j = 0; j < target.phones.length; j++) {
						const data = target.phones[j];
						addClip(data, input.phones[data.phone], mix, chooseMethod, matchDiphones, matchTriphones, function(phone) {
							console.log("MISSING PHONE: " + phone.phone);
						});
					}
				});
			}
		}
	} else {
		for (let phone in output.phones) {
			for (let j = 0; j < output.phones[phone].length; j++) {
				addClip(output.phones[phone][j], input.phones[phone], mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
					console.log("MISSING PHONE: " + target.phone);
				});
			}
		}
	}
	mix.save();
}

sing("input", "output", "duration", true, true, true, true, 0, 0.025);