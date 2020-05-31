"use strict";

const speechToSpeech = (function() {

	function addClip(target, phones, mix, params, func) {
		if (phones) {
			const match = triphone(phones, target, params);
			const stretch = Math.min(8, target.dur / match.dur);
			let startOverlap = params.overlapStart;
			let endOverlap = params.overlapEnd;
			if (startOverlap + endOverlap > match.dur * stretch) {
				startOverlap = 0;
				endOverlap = 0;
			}
			mix.addClip(match.file, target.label, target.start - startOverlap, target.end + endOverlap, (match.start * stretch) - startOverlap, (match.end * stretch) + endOverlap, stretch);
		} else {
			func(target);
		}
	}

	return function(source, destination, params) {
		const input = convert(source, params);
		const output = convert(destination, params);
		const mix = new AuditionSession("session", 32, params.sampleRate);
		if (params.matchWords && input.words && output.words) {
			for (let word in output.words) {
				if (!output.words.hasOwnProperty(word)) continue;
				for (let i = 0; i < output.words[word].length; i++) {
					addClip(output.words[word][i], input.words[word], mix, params, function(target) {
						console.log("USING PHONES FOR: " + target.label);
						for (let j = 0; j < target.phones.length; j++) {
							const data = target.phones[j];
							addClip(data, input.phones[data.label], mix, params, function(phone) {
								console.log("MISSING PHONE: " + phone.label);
							});
						}
					});
				}
			}
		} else {
			for (let phone in output.phones) {
				if (!output.phones.hasOwnProperty(phone)) continue;
				for (let j = 0; j < output.phones[phone].length; j++) {
					addClip(output.phones[phone][j], input.phones[phone], mix, params, function(target) {
						console.log("MISSING PHONE: " + target.label);
					});
				}
			}
		}
		return mix.compile();
	};

}());