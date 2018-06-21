"use strict";

function addClip(target, phones, mix, method, diphones, triphones, func) {
	if (phones) {
		var match = triphone(target, phones, method, diphones, triphones);
		var stretch = Math.min(8, target.dur / match.dur);
		mix.addClip(target.phone, target.start, target.end, match.start * stretch, match.end * stretch, stretch);
	} else {
		func(target);
	}
}

function sing(input, output, matchWords, matchDiphones, matchTriphones, chooseMethod) {
	var vocals = convert(input);
	var acapella = convert(output);
	var mix = new session("vocals", 32, 44100);
	if (matchWords && acapella.words && vocals.words) {
		for (var word in acapella.words) {
			for (var i = 0; i < acapella.words[word].length; i++) {
				addClip(acapella.words[word][i], vocals.words[word], mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
					console.log("USING PHONES FOR: " + target.phone);
					for (var j = 0; j < target.phones.length; j++) {
						var info = target.phones[j];
						addClip(info, vocals.phones[info.phone], mix, chooseMethod, matchDiphones, matchTriphones, function(phone) {
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