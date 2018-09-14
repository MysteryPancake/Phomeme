"use strict";

function addClip(target, phones, mix, method, diphones, triphones, func) {
	if (phones) {
		var match = triphone(target, phones, method, diphones, triphones);
		var stretch = Math.min(8, target.dur / match.dur);
		mix.addClip(match.file, target.phone, target.start, target.end, match.start * stretch, match.end * stretch, stretch);
	} else {
		func(target);
	}
}

function sing(vocals, acapella, chooseMethod, matchWords, matchDiphones, matchTriphones, matchPunctuation, matchReverse, overlapStart, overlapEnd) {
	var input = convert(vocals, "input.wav", matchPunctuation);
	var output = convert(acapella, "output.wav", matchPunctuation);
	var mix = new session("session", 32, 44100);
	mix.overlapStart = overlapStart;
	mix.overlapEnd = overlapEnd;
	if (matchWords && input.words && output.words) {
		for (var word in output.words) {
			for (var i = 0; i < output.words[word].length; i++) {
				addClip(output.words[word][i], input.words[word], mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
					console.log("USING PHONES FOR: " + target.phone);
					for (var j = 0; j < target.phones.length; j++) {
						var data = target.phones[j];
						addClip(data, input.phones[data.phone], mix, chooseMethod, matchDiphones, matchTriphones, function(phone) {
							console.log("MISSING PHONE: " + phone.phone);
						});
					}
				});
			}
		}
	} else {
		for (var phone in output.phones) {
			for (var j = 0; j < output.phones[phone].length; j++) {
				addClip(output.phones[phone][j], input.phones[phone], mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
					console.log("MISSING PHONE: " + target.phone);
				});
			}
		}
	}
	return mix.compile();
}