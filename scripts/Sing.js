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

function sing(input, output, matchWords, matchDiphones, matchTriphones, chooseMethod, overlapStart, overlapEnd) {
	var vocals = convert(input, "input.wav");
	var acapella = convert(output, "output.wav");
	var mix = new session("vocals", 32, 44100);
	mix.overlapStart = overlapStart;
	mix.overlapEnd = overlapEnd;
	if (matchWords && acapella.words && vocals.words) {
		for (var word in acapella.words) {
			for (var i = 0; i < acapella.words[word].length; i++) {
				addClip(acapella.words[word][i], vocals.words[word], mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
					console.log("USING PHONES FOR: " + target.phone);
					for (var j = 0; j < target.phones.length; j++) {
						var data = target.phones[j];
						addClip(data, vocals.phones[data.phone], mix, chooseMethod, matchDiphones, matchTriphones, function(phone) {
							console.log("MISSING PHONE: " + phone.phone);
						});
					}
				});
			}
		}
	} else {
		for (var phone in acapella.phones) {
			for (var j = 0; j < acapella.phones[phone].length; j++) {
				addClip(acapella.phones[phone][j], vocals.phones[phone], mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
					console.log("MISSING PHONE: " + target.phone);
				});
			}
		}
	}
	return mix.compile();
}