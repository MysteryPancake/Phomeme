"use strict";

function xmlSafe(str) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/"/g, "&apos;");
}

function session(name, bitDepth, sampleRate) {
	this.name = name || "Untitled Session";
	this.depth = bitDepth || 16;
	this.rate = sampleRate || 16000;
	this.before = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
	<!DOCTYPE sesx>
	<sesx version="1.1">
		<session appBuild="8.0.0.192" appVersion="8.0" audioChannelType="stereo" bitDepth="${this.depth}" sampleRate="${this.rate}">
			<name>${this.name}.sesx</name>
			<tracks>
				<audioTrack automationLaneOpenState="false" id="10001" index="1" select="false" visible="true">
					<trackParameters trackHeight="134" trackHue="-1" trackMinimized="false">
						<name>Phomeme</name>
					</trackParameters>
					<trackAudioParameters audioChannelType="stereo" automationMode="1" monitoring="false" recordArmed="false" solo="false" soloSafe="false">
						<trackOutput outputID="10000" type="trackID"/>
						<trackInput inputID="1"/>
					</trackAudioParameters>`;
	this.after = `</audioTrack>
			</tracks>
		</session>
		<files>
			<file id="0" importerPrivateSettings="Compression:0:0;LargeFileSupport:0:0;SampleType:0:40;" mediaHandler="AmioWav" relativePath="../${this.name}.wav"/>
		</files>
	</sesx>`;
	this.clips = [];
	this.addClip = function(phone, start, end, sourceStart, sourceEnd, stretch) {
		this.clips.push(`<audioClip clipAutoCrossfade="true" crossFadeHeadClipID="-1" crossFadeTailClipID="-1" endPoint="${end * this.rate}" fileID="0" hue="-1" id="${this.clips.length + 1}" lockedInTime="false" looped="false" name="${xmlSafe(phone)}" offline="false" select="false" sourceInPoint="${sourceStart * this.rate}" sourceOutPoint="${sourceEnd * this.rate}" startPoint="${start * this.rate}" zOrder="0">
			<clipStretch adaptiveWindowSize="37" pitchAdjustment="0" preserveFormants="true" stretchMode="rendered" stretchQuality="high" stretchRatio="${stretch}" stretchType="solo" transientSensitivity="40"/>
		</audioClip>`);
	};
	this.compile = function() {
		var result = this.before;
		for (var i = 0; i < this.clips.length; i++) {
			result += this.clips[i];
		}
		result += this.after;
		return result;
	};
}