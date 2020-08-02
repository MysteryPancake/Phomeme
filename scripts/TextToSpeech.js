"use strict";

const textToSpeech = (function() {

	function addClips(targets, phones, mix, params, length, func) {
		for (let i = 0; i < targets.length; i++) {
			const target = targets[i];
			const words = phones[target.label];
			if (words) {
				// For now, choose first candidate (editor should allow multiple choices)
				const match = triphone(words, target, params)[0];
				mix.addClip(match.file, target.label, length - params.overlapStart, length + match.dur + params.overlapEnd, match.start - params.overlapStart, match.end + params.overlapEnd, 1, 0, 1);
				length += match.dur;
			} else {
				length = func(target, length) || length;
			}
		}
		return length;
	}

	return function(source, destination, params) {
		const input = convert(source, params);
		const output = convert(destination, params);
		const mix = new AuditionSession("session", 32, params.sampleRate);
		if (params.matchWords && input.words && output.words) {
			addClips(output.words, input.words, mix, params, 0, function(target, length) {
				console.log(`USING PHONES FOR: ${target.label}`);
				if (target.phones) {
					return addClips(target.phones, input.phones, mix, params, length, function(data) {
						console.log(`MISSING PHONE: ${data.label}`);
					});
				} else {
					console.log(`MISSING DEFINITION: ${target.label}`);
				}
			});
		} else {
			addClips(output.phones, input.phones, mix, params, 0, function(target) {
				console.log(`MISSING PHONE: ${target.label}`);
			});
		}
		return mix.compile();
	};

}());