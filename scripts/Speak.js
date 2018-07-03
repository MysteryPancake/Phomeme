"use strict";

var length = 0;

function convertSentence(sentence, dict) {
	var words = sentence.toLowerCase().match(/\w+(?:'\w+)*/g);
	var transcript = {
		words: [],
		phones: []
	};
	var prevPhone;
	for (var i = 0; i < words.length; i++) {
		var word = words[i];
		transcript.words.push({
			prev: words[i - 1],
			next: words[i + 1],
			phone: word
		});
		var phones = dict[word];
		if (phones) {
			transcript.words[transcript.words.length - 1].phones = [];
			for (var j = 0; j < phones.length; j++) {
				var phone = phones[j];
				if (prevPhone) {
					transcript.phones[transcript.phones.length - 1].next = phone;
				}
				var data = {
					prev: prevPhone,
					phone: phone
				};
				transcript.words[transcript.words.length - 1].phones.push(data);
				transcript.phones.push(data);
				prevPhone = phone;
			}
		} else {
			console.log("MISSING DEFINITION: " + word);
		}
	}
	return transcript;
}

function addClips(targets, phones, mix, method, diphones, triphones, func) {
	for (var i = 0; i < targets.length; i++) {
		var target = targets[i];
		var words = phones[target.phone];
		if (words) {
			var match = triphone(target, words, method, diphones, triphones);
			mix.addClip(match.file, target.phone, length, length + match.dur, match.start, match.end, 1);
			length += match.dur;
		} else {
			func(target);
		}
	}
}

function speak(vocals, acapella, dict, matchWords, matchDiphones, matchTriphones, chooseMethod, overlapStart, overlapEnd) {
	var input = convert(vocals, "input.wav");
	var output = convertSentence(acapella, dict);
	var mix = new session("session", 32, 44100);
	mix.overlapStart = overlapStart;
	mix.overlapEnd = overlapEnd;
	if (matchWords && input.words && output.words) {
		addClips(output.words, input.words, mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
			console.log("USING PHONES FOR: " + target.phone);
			if (target.phones) {
				addClips(target.phones, input.phones, mix, chooseMethod, matchDiphones, matchTriphones, function(data) {
					console.log("MISSING PHONE: " + data.phone);
				});
			} else {
				console.log("MISSING DEFINITION: " + target.phone);
			}
		});
	} else {
		addClips(output.phones, input.phones, mix, chooseMethod, matchDiphones, matchTriphones, function(target) {
			console.log("MISSING PHONE: " + target.phone);
		});
	}
	return mix.compile();
}