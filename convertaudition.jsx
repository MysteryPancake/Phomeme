{
	function absolutePath(base, relative) {
		var stack = base.split("/");
		var parts = relative.split("/");
		stack.pop();
		if (parts[0] === "..") {
			stack.pop();
		}
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

	function parse(xml, session) {
		var master;
		var comps = [];
		var files = {};
		var itemList = app.project.items;
		for each (var audio in xml.files) {
			var path = audio.attribute("relativePath").toString();
			var file = File(audio.attribute("absolutePath").toString());
			var backup = new File(absolutePath(session.path, path));
			var io = new ImportOptions(file.exists && file || backup);
			files[audio.attribute("id").toString()] = app.project.importFile(io);
		}
		for each (var prop in xml.session.tracks) {
			var label = prop.trackParameters.name.toString();
			var rate = Number(xml.session.attribute("sampleRate"));
			var duration = Number(xml.session.attribute("duration"));
			var comp = itemList.addComp(label, 1920, 1080, 1, duration / rate, 60);
			for each (var clip in prop) {
				if (clip.name().toString() === "audioClip") {
					var file = clip.attribute("fileID").toString();
					var layer = comp.layers.add(files[file]);
					layer.name = clip.attribute("name").toString();
					var ratio = Number(clip.clipStretch.attribute("stretchRatio")) || 1;
					layer.stretch = ratio * 100;
					var startTime = Number(clip.attribute("sourceInPoint")) / rate;
					var inPoint = Number(clip.attribute("startPoint")) / rate;
					var outPoint = Number(clip.attribute("endPoint")) / rate;
					layer.startTime = (inPoint / ratio) - (startTime / ratio);
					layer.inPoint = inPoint;
					layer.outPoint = outPoint;
				}
			}
			if (label.toString() === "Master") {
				master = comp;
			} else {
				comps.unshift(comp);
			}
		}
		if (master) {
			for (var i = 0; i < comps.length; i++) {
				master.layers.add(comps[i]);
			}
		}
	}

	function importFile() {
		var session = File.openDialog("Import Session");
		if (session && session.open("r")) {
			var content = session.read();
			session.close();
			parse(new XML(content), session);
		}
	}

	importFile();
}