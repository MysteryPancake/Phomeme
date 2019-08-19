"use strict";

function xmlSafe(str) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/"/g, "&apos;");
}

function AuditionSession(name, bitDepth, sampleRate) {
	this.name = name || "Untitled Session";
	this.depth = bitDepth || 16;
	this.rate = sampleRate || 16000;
	this.before = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\" ?>\n<!DOCTYPE sesx>\n<sesx version=\"1.1\">\n\t<session appBuild=\"8.0.0.192\" appVersion=\"8.0\" audioChannelType=\"stereo\" bitDepth=\"" + this.depth + "\" sampleRate=\"" + this.rate + "\">\n\t\t<name>" + this.name + ".sesx</name>\n\t\t<tracks>\n\t\t\t<audioTrack automationLaneOpenState=\"false\" id=\"10001\" index=\"1\" select=\"false\" visible=\"true\">\n\t\t\t\t<trackParameters trackHeight=\"134\" trackHue=\"-1\" trackMinimized=\"false\">\n\t\t\t\t\t<name>Phomeme</name>\n\t\t\t\t</trackParameters>\n\t\t\t\t<trackAudioParameters audioChannelType=\"stereo\" automationMode=\"1\" monitoring=\"false\" recordArmed=\"false\" solo=\"false\" soloSafe=\"false\">\n\t\t\t\t\t<trackOutput outputID=\"10000\" type=\"trackID\"/>\n\t\t\t\t\t<trackInput inputID=\"1\"/>\n\t\t\t\t</trackAudioParameters>\n";
	this.middle = "\t\t\t</audioTrack>\n\t\t</tracks>\n\t</session>\n\t<files>\n";
	this.after = "\t</files>\n</sesx>";
	this.overlapStart = 0;
	this.overlapEnd = 0;
	this.files = [];
	this.addFile = function(path) {
		return this.files.push({
			xml: "\t\t<file id=\"" + this.files.length + "\" importerPrivateSettings=\"Compression:0:0;LargeFileSupport:0:0;SampleType:0:40;\" mediaHandler=\"AmioWav\" relativePath=\"" + path + "\"/>\n",
			path: path
		});
	};
	this.clips = [];
	this.addClip = function(path, phone, start, end, sourceStart, sourceEnd, stretch) {
		var id;
		for (var i = 0; i < this.files.length; i++) {
			if (this.files[i].path === path) {
				id = i;
			}
		}
		if (id === undefined) {
			id = this.addFile(path) - 1;
		}
		this.clips.push("\t\t\t\t<audioClip clipAutoCrossfade=\"true\" crossFadeHeadClipID=\"-1\" crossFadeTailClipID=\"-1\" endPoint=\"" + (end + this.overlapEnd) * this.rate + "\" fileID=\"" + id + "\" hue=\"-1\" id=\"" + this.clips.length + "\" lockedInTime=\"false\" looped=\"false\" name=\"" + xmlSafe(phone) + "\" offline=\"false\" select=\"false\" sourceInPoint=\"" + (sourceStart - this.overlapStart) * this.rate + "\" sourceOutPoint=\"" + (sourceEnd + this.overlapEnd) * this.rate + "\" startPoint=\"" + (start - this.overlapStart) * this.rate + "\" zOrder=\"" + this.clips.length + "\">\n\t\t\t\t\t<clipStretch adaptiveWindowSize=\"37\" pitchAdjustment=\"0\" preserveFormants=\"true\" stretchMode=\"rendered\" stretchQuality=\"high\" stretchRatio=\"" + stretch + "\" stretchType=\"solo\" transientSensitivity=\"40\"/>\n\t\t\t\t</audioClip>\n");
	};
	this.compile = function() {
		var result = this.before;
		for (var i = 0; i < this.clips.length; i++) {
			result += this.clips[i];
		}
		result += this.middle;
		for (var j = 0; j < this.files.length; j++) {
			result += this.files[j].xml;
		}
		result += this.after;
		return result;
	};
}