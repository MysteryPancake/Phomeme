"use strict";

function addClips(targets, phones, mix, method, diphones, triphones, length, func) {
	for (var i = 0; i < targets.length; i++) {
		var target = targets[i];
		var words = phones[target.phone];
		if (words) {
			var match = triphone(target, words, method, diphones, triphones);
			mix.addClip(match.file, target.phone, length, length + match.dur, match.start, match.end, 1);
			length += match.dur;
		} else {
			length = func(target, length) || length;
		}
	}
	return length;
}

function speak(vocals, acapella, chooseMethod, matchWords, matchDiphones, matchTriphones, matchPunctuation, overlapStart, overlapEnd) {
	var input = convert(vocals.data, vocals.type, "input.wav", matchPunctuation);
	var output = convert(acapella.data, acapella.type, "input.wav", matchPunctuation);
	var mix = new Session("session", 32, 44100);
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
	return mix.compile();
}