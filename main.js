const { app, BrowserWindow } = require("electron");
//const { PythonShell } = require("python-shell");

function createWindow() {
	let mainWindow = new BrowserWindow({
		backgroundColor: "#000000",
		title: "Phomeme",
		show: false,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false
		}
	});
	mainWindow.loadFile("editor.html");
	mainWindow.maximize();
	//mainWindow.webContents.openDevTools();
	mainWindow.on("ready-to-show", function() {
		mainWindow.show();
		mainWindow.focus();
	});
	/*PythonShell.run("align.py", {
		args: ["gentle/examples/data/lucier.mp3", "gentle/examples/data/lucier.txt"],
		scriptPath: "gentle"
	}, function(err, results) {
		if (err) {
			console.log(err);
		}
		console.log(results);
	});*/
}

app.whenReady().then(createWindow);

app.on("window-all-closed", function() {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", function () {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});