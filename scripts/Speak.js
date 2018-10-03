"use strict";

function convertSentence(sentence, dict, matchPunctuation) {
	var words = sentence.toLowerCase().match(/\w+(?:'\w+)*|(?<![!?.])[!?.]/g);
	var punctuation = { "!": true, "?": true, ".": true };
	var transcript = {
		transcript: sentence,
		words: [],
		phones: []
	};
	for (var i = 0; i < words.length; i++) {
		var word = words[i];
		if (punctuation[word]) continue;
		transcript.words.push({
			prev: words[i - (matchPunctuation && punctuation[words[i - 1]] ? 1 : 2)],
			next: words[i + (matchPunctuation && punctuation[words[i + 1]] ? 1 : 2)],
			phone: word
		});
		var phones = dict[word];
		if (phones) {
			transcript.words[transcript.words.length - 1].phones = [];
			for (var j = 0; j < phones.length; j++) {
				var data = {
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

function speak(vocals, output, chooseMethod, matchWords, matchDiphones, matchTriphones, matchPunctuation, matchReverse, overlapStart, overlapEnd) {
	var input = convert(vocals, "input.wav", matchPunctuation);
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