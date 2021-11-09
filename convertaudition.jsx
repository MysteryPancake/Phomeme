(function() {

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
		// Attempt to load the file, checking both the absolute and relative paths
		var path = new File(absolute);
		var backup = new File(absolutePath(session, relative));
		if (path.exists || backup.exists) {
			var options = new ImportOptions(path.exists ? path : backup);
			return app.project.importFile(options);
		} else {
			// Fallback to a placeholder solid
			return app.project.importPlaceholder(absolute || relative, 1920, 1080, 60, duration);
		}
	}

	function gainToDecibels(num) {
		// Convert gain from a linear scale to a logarithmic scale
		return (Math.log(num) / Math.log(10)) * 20;
	}

	function panVolume(pan, volume) {
		var normal = pan * 0.01;
		// Decrease the left and right volume based on the pan
		var left = gainToDecibels(volume * Math.min(1, normal + 1));
		var right = gainToDecibels(volume * Math.min(1, -normal + 1));
		return [left, right];
	}

	function addClips(list, comp, files, sampleRate) {
		for each (var clip in list) {
			var layer = comp.layers.add(files[clip.@fileID.toString()]);
			layer.name = clip.@name.toString();
			layer.stretch = (parseFloat(clip.clipStretch.@stretchRatio) || 1) * 100;
			var startTime = parseFloat(clip.@sourceInPoint) / sampleRate;
			var inPoint = parseFloat(clip.@startPoint) / sampleRate;
			var outPoint = parseFloat(clip.@endPoint) / sampleRate;
			layer.startTime = inPoint - startTime;
			layer.inPoint = inPoint;
			layer.outPoint = outPoint;
			layer.locked = clip.@lockedInTime.toString() === "true";
			layer.audioEnabled = clip.component.(@name == "Mute").parameter.(@index == "1").@parameterValue.toString() === "0";
			var pan = parseFloat(clip.component.(@name == "StereoPanner").parameter.(@name == "Pan").@parameterValue);
			var volume = parseFloat(clip.component.(@name == "volume").parameter.(@name == "volume").@parameterValue);
			var gain = parseFloat(clip.component.(@name == "volume").parameter.(@name == "static gain").@parameterValue);
			if (layer.hasAudio) {
				// Take the pan, volume and gain into account when calculating audio levels (this ignores audio and pan keyframes)
				layer.audio.audioLevels.setValue(panVolume(pan, volume * gain));
			}
		}
	}

	function addMarkers(data) {
		// TODO: GET THIS TO ACTUALLY ADD MARKERS
		if (!ExternalObject.AdobeXMPScript) {
			ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
		}
		var rdf = new Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
		var xmp = new Namespace("http://ns.adobe.com/xap/1.0/");
		var xmpMM = new Namespace("http://ns.adobe.com/xap/1.0/mm/");
		var stEvt = new Namespace("http://ns.adobe.com/xap/1.0/sType/ResourceEvent#");
		var stRef = new Namespace("http://ns.adobe.com/xap/1.0/sType/ResourceRef#");
		var dc = new Namespace("http://purl.org/dc/elements/1.1/");
		var AEScart = new Namespace("http://ns.adobe.com/aes/cart/");
		var xmpDM = new Namespace("http://ns.adobe.com/xmp/1.0/DynamicMedia/");
		var meta = new XMPMeta(data.toXMLString());
		for each (var data in meta) {
			alert(data);
		}
	}

	function parse(xml, session) {
		var master;
		var comps = [];
		var files = {};
		// These could probably be parseInt, but allowing float support for fun
		var sampleRate = parseFloat(xml.session.@sampleRate) || 44100;
		var duration = parseFloat(xml.session.@duration) || 1323000;
		var folder = app.project.items.addFolder(decodeURIComponent(session.name));
		folder.selected = true;
		for each (var audio in xml.files) {
			var file = importBackup(audio.@absolutePath.toString(), audio.@relativePath.toString(), session.path, duration / sampleRate);
			files[audio.@id.toString()] = file;
			file.parentFolder = folder;
			file.selected = false;
		}
		for each (var prop in xml.session.tracks) {
			var comp = app.project.items.addComp(prop.trackParameters.name.toString(), 1920, 1080, 1, duration / sampleRate, 60);
			comp.time = parseFloat(xml.session.sessionState.@ctiPosition) / sampleRate;
			comp.parentFolder = folder;
			addClips(prop..audioClip, comp, files, sampleRate);
			addClips(prop..videoClip, comp, files, sampleRate);
			if (prop.name() == "masterTrack") {
				// All tracks are routed to the master, so it makes sense to put them in the same comp
				master = comp;
			} else {
				// Add to the end of the array since the loop goes in reverse
				comps.unshift({
					comp: comp,
					solo: prop.trackAudioParameters.@solo.toString() === "true",
					mute: prop.trackAudioParameters.component.(@name == "Mute").parameter.(@index == "1").@parameterValue.toString() === "0",
					pan: parseFloat(prop.trackAudioParameters.component.(@name == "StereoPanner").parameter.(@name == "Pan").@parameterValue),
					volume: parseFloat(prop.trackAudioParameters.component.(@name == "volume").parameter.(@name == "volume").@parameterValue),
					gain: parseFloat(prop.trackAudioParameters.component.(@name == "volume").parameter.(@name == "static gain").@parameterValue)
				});
			}
		}
		if (master) {
			// Put all tracks into the master comp
			for (var i = 0; i < comps.length; i++) {
				var comp = master.layers.add(comps[i].comp);
				comp.solo = comps[i].solo;
				comp.audioEnabled = comps[i].mute;
				if (comp.hasAudio) {
					comp.audio.audioLevels.setValue(panVolume(comps[i].pan, comps[i].volume * comps[i].gain));
				}
			}
			//addMarkers(xml.session.xmpMetadata);
		}
	}

	function fileFilter(file) {
		return (file instanceof Folder) || (file.name.split(".").pop() == "sesx");
	}

	function importSession() {
		// File filter doesn't seem to work on Mac, but just in case
		var session = File.openDialog("Import Audition Session", File.fs == "Macintosh" ? fileFilter : "Audition Session:*.sesx;All files:*.*");
		if (!session) return;
		if (session.open("r")) {
			var extension = session.name.split(".").pop();
			if (extension === "sesx") {
				var content = session.read();
				var xml = new XML(content);
				parse(xml, session);
			} else {
				alert("Not an Audition Session!\nPlease open .sesx files, not ." + extension + " files!");
				importSession();
			}
			session.close();
		} else {
			alert("Couldn't read the file!");
		}
	}

	importSession();

})();