"use strict";

const speechToSpeech = (function() {

	function addClip(target, phones, mix, method, diphones, triphones, func) {
		if (phones) {
			const match = triphone(target, phones, method, diphones, triphones);
			const stretch = Math.min(8, target.dur / match.dur);
			mix.addClip(match.file, target.phone, target.start, target.end, match.start * stretch, match.end * stretch, stretch);
		} else {
			func(target);
		}
	}

	return function(source, destination, chooseMethod, matchWords, matchDiphones, matchTriphones, matchPunctuation, matchExact, ignoreWordGaps, overlapStart, overlapEnd, sampleRate) {
		const input = convert(source.data, source.type, "input.wav", matchPunctuation, matchExact, ignoreWordGaps);
		const output = convert(destination.data, destination.type, "output.wav", matchPunctuation, matchExact, ignoreWordGaps);
		const mix = new AuditionSession("session", 32, sampleRate);
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
		return mix.compile();
	};
	
}());