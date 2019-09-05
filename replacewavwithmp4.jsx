(function() {

	function replaceWAVWithMP4() {
		for (var i = 1; i <= app.project.numItems; i++) {
			var item = app.project.item(i);
			if (item instanceof FootageItem) {
				var file = item.file;
				if (file) {
					var name = file.name;
					if (name) {
						var extension = file.name.split(".").pop();
						if (extension === "wav") {
							var mp4 = new File(file.fullName.replace(".wav", ".mp4"));
							if (mp4.exists) {
								item.replace(mp4);
							}
						}
					}
				}
			}
		}
	}

	replaceWAVWithMP4();
})();