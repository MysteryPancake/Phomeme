{
	function absolutePath(base, relative) {
		var stack = base.split("/");
		var parts = relative.split("/");
		for (var i = 0; i < parts.length; i++) {
			if (parts[i] === ".") {
				continue;
			}
			if (parts[i] === "..") {
				stack.pop();
			} else {
				stack.push(parts[i]);
			}
		}
		return stack.join("/");
	}

	function importBackup(absolute, relative, session, duration) {
		var path = new File(absolute);
		var backup = new File(absolutePath(session, relative));
		if (path.exists || backup.exists) {
			var options = new ImportOptions(path.exists && path || backup);
			return app.project.importFile(options);
		} else {
			return app.project.importPlaceholder(absolute || relative, 1920, 1080, 60, duration);
		}
	}

	function gainToDecibels(num) {
		return (Math.log(num) / Math.log(10)) * 20;
	}

	function panVolume(pan, volume) {
		var normal = pan * 0.01;
		var left = gainToDecibels(volume * Math.min(1, normal + 1));
		var right = gainToDecibels(volume * Math.min(1, -normal + 1));
		return [left, right];
	}

	function parse(xml, session) {
		var master;
		var comps = [];
		var files = {};
		var rate = Number(xml.session.@sampleRate) || 44100;
		var duration = Number(xml.session.@duration) || 1323000;
		var folder = app.project.items.addFolder(session.name);
		folder.selected = true;
		for each (var audio in xml.files) {
			var file = importBackup(audio.@absolutePath.toString(), audio.@relativePath.toString(), session.path, duration / rate);
			files[audio.@id.toString()] = file;
			file.parentFolder = folder;
			file.selected = false;
		}
		for each (var prop in xml.session.tracks) {
			var comp = app.project.items.addComp(prop.trackParameters.name.toString(), 1920, 1080, 1, duration / rate, 60);
			comp.time = Number(xml.session.sessionState.@ctiPosition) / rate;
			comp.parentFolder = folder;
			for each (var clip in prop..audioClip) {
				var file = clip.@fileID.toString();
				var layer = comp.layers.add(files[file]);
				layer.name = clip.@name.toString();
				layer.stretch = (Number(clip.clipStretch.@stretchRatio) || 1) * 100;
				var startTime = Number(clip.@sourceInPoint) / rate;
				var inPoint = Number(clip.@startPoint) / rate;
				var outPoint = Number(clip.@endPoint) / rate;
				layer.startTime = inPoint - startTime;
				layer.inPoint = inPoint;
				layer.outPoint = outPoint;
				layer.locked = clip.@lockedInTime.toString() === "true";
				layer.audioEnabled = clip.component.(@name == "Mute").parameter.(@index == "1").@parameterValue.toString() === "0";
				var pan = Number(clip.component.(@name == "StereoPanner").parameter.(@name == "Pan").@parameterValue);
				var volume = Number(clip.component.(@name == "volume").parameter.(@name == "volume").@parameterValue);
				var gain = Number(clip.component.(@name == "volume").parameter.(@name == "static gain").@parameterValue);
				if (layer.hasAudio) {
					layer.audio.audioLevels.setValue(panVolume(pan, volume * gain));
				}
			}
			if (prop.name() == "masterTrack") {
				master = comp;
			} else {
				comps.unshift({
					comp: comp,
					solo: prop.trackAudioParameters.@solo.toString() === "true",
					mute: prop.trackAudioParameters.component.(@name == "Mute").parameter.(@index == "1").@parameterValue.toString() === "0",
					pan: Number(prop.trackAudioParameters.component.(@name == "StereoPanner").parameter.(@name == "Pan").@parameterValue),
					volume: Number(prop.trackAudioParameters.component.(@name == "volume").parameter.(@name == "volume").@parameterValue),
					gain: Number(prop.trackAudioParameters.component.(@name == "volume").parameter.(@name == "static gain").@parameterValue)
				});
			}
		}
		if (master) {
			for (var i = 0; i < comps.length; i++) {
				var comp = master.layers.add(comps[i].comp);
				comp.solo = comps[i].solo;
				comp.enabled = comps[i].mute;
				comp.audioEnabled = comps[i].mute;
				if (comp.hasAudio) {
					comp.audio.audioLevels.setValue(panVolume(comps[i].pan, comps[i].volume * comps[i].gain));
				}
			}
		}
	}

	function importSession() {
		var session = File.openDialog("Import Audition Session");
		if (!session) return;
		if (session.open("r")) {
			var extension = session.name.split(".").pop();
			if (extension === "sesx") {
				var content = session.read();
				session.close();
				var xml = new XML(content);
				parse(xml, session);
			} else {
				alert("Not an Audition Session!\nPlease open .sesx files, not ." + extension + " files!");
				importSession();
			}
		} else {
			alert("Couldn't read the file!");
		}
	}

	importSession();
}