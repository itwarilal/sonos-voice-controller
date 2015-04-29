var token;
var activeGroupId;

function onConnectCB(groupId) {
	activeGroupId = groupId;
	subscribe(activeGroupId, "groupvolume:1");
}

function onGetHouseholdsCB(householdIds) {
	if (householdIds.length == 1) {
		onHouseholdSelection(householdIds);
	}
}

function onHouseholdSelection(householdIds) {
	setActiveHouseholdId(householdIds[0]);
}

var mic = new Wit.Microphone(document.getElementById("microphone"));
  console.log(mic);
login('deepesh.tated@sonos.com', 'Sonos123');

var info = function(msg) {
	document.getElementById("info").innerHTML = msg;
};
var error = function(msg) {
	document.getElementById("error").innerHTML = msg;
};
mic.onready = function() {
	info("Microphone is ready to record");
};
mic.onaudiostart = function() {
	info("Recording started");
	error("");
};
mic.onaudioend = function() {
	info("Recording stopped, processing started");
};
mic.onresult = function(intent, entities) {
	var r = kv("intent", intent);

	for (var k in entities) {
		var e = entities[k];

		if (!(e instanceof Array)) {
			r += kv(k, e.value);
		} else {
			for (var i = 0; i < e.length; i++) {
				r += kv(k, e[i].value);
			}
		}
	}
	document.getElementById("result").innerHTML = r;

	switch (intent) {
		case "play":
			play(activeGroupId);
			break;
		case "pause":
			pause(activeGroupId);
			break;
		case "next":
			next(activeGroupId);
			break;
		case "previous":
			previous(activeGroupId);
			break;
		default:
			break;
	}
};
mic.onerror = function(err) {
	error("Error: " + err);
};
mic.onconnecting = function() {
	info("Microphone is connecting");
};
mic.ondisconnected = function() {
	info("Microphone is not connected");
};

mic.connect("4A3RJPLJXRAJ4HDSR7HMFZSQW3GYULKT");
// mic.start();
// mic.stop();

function kv(k, v) {
	if (toString.call(v) !== "[object String]") {
		v = JSON.stringify(v);
	}
	return k + "=" + v + "\n";
}