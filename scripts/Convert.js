"use strict";

function convert(json) {
	var words = {};
	var phones = {};
	var prevWord, prevPhone;
	for (var i = 0; i < json.words.length; i++) {
		var word = json.words[i];
		if (word.case === "not-found-in-audio") continue;
		if (prevWord) {
			words[prevWord][words[prevWord].length - 1].next = word.alignedWord;
		}
		words[word.alignedWord] = words[word.alignedWord] || [];
		var last = words[word.alignedWord].push({
			phone: word.alignedWord,
			start: word.start,
			end: word.end,
			dur: word.end - word.start,
			prev: prevWord,
			phones: []
		});
		prevWord = word.alignedWord;
		var start = word.start;
		for (var j = 0; j < word.phones.length; j++) {
			var phone = word.phones[j];
			if (prevPhone) {
				phones[prevPhone][phones[prevPhone].length - 1].next = phone.phone;
			}
			phones[phone.phone] = phones[phone.phone] || [];
			var data = {
				phone: phone.phone,
				start: start,
				end: start + phone.duration,
				dur: phone.duration,
				prev: prevPhone,
				word: word.alignedWord
			};
			words[word.alignedWord][last - 1].phones.push(data);
			phones[phone.phone].push(data);
			start += phone.duration;
			prevPhone = phone.phone;
		}
	}
	var transcript = {
		words: words,
		phones: phones
	};
	return transcript;
}