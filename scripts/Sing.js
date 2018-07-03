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

function sing(vocals, acapella, matchWords, matchDiphones, matchTriphones, chooseMethod) {
	var input = convert(vocals);
	var output = convert(acapella);
	var mix = new session("session", 32, 44100);
	if (matchWords && input.words && output.words) {
		for (var word in output.words) {
			for (var i = 0; i < output.words[word].length; i++) {
				addClip(output.words[word][i], input.words[word], mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
					console.log("USING PHONES FOR: " + target.phone);
					for (var j = 0; j < target.phones.length; j++) {
						var info = target.phones[j];
						addClip(info, input.phones[info.phone], mix, chooseMethod, matchDiphones, matchTriphones, function(phone) {
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