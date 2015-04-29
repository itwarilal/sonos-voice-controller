/*
*NOTE* verify that your permissions are correct:

GET http://authz.dev.ws.sonos.com:8080/v0/subject/SUBJECT_ID/object/HOUSEHOLD/roles
where SUBJECT_ID = your sonos id, and HOUSEHOLD = the household of your sonos group. The above should return owner and a TTL.

For example - I (Ryan) have infinite owner privileges on my household:
http://auth.dev.ws.sonos.com:8080/v0/subject/112295027/object/Sonos_7ckpqjKQignitM5ky0l1Quz3f1/roles

If you are making the request from a browser, you'll run into CORS issues. In this case, use the proxy at port 80:
GET http://authz.dev.ws.sonos.com:8080/v0/subject/SUBJECT_ID/object/HOUSEHOLD/roles
*/


var authzBaseUrl = 'http://authz.dev.ws.sonos.com:8080';
var museEndpoint = 'ws://muse-frontend.dev.ws.sonos.com:8080/muse-server/v0/websocket';
//var museEndpoint = 'ws://localhost:8080/muse-server/v0/websocket';
var tokenEndpoint = 'https://mitch.ws.sonos.com/auth/oauth/v2/token';
//var tokenEndpoint = 'https://api-dev1.sonos.com/auth/oauth/v2/token';
var clientCredentials = 'NjAyMjNhYmItMzYwMy00NzQxLWJlNTktZjgyMjMxNWJkODMzOjlhYmFkY2MzLTJiOTUtNDkyNy1hNjM0LTE0M2ZiZjg3NThmOA==';
var client;
var activeAccessToken;
var activeHouseholdId;
var activeGroupId = null;
var onGetHouseholdsCB = null;
var onGetVolumeResponseCB = null;
var onErrorCB = null;


function login(username, password) {
    var body = 'username='+username+'&password='+password+'&grant_type=password';
    var headers = [['Authorization', 'Basic ' + clientCredentials], ['Content-Type', 'application/x-www-form-urlencoded']];
    http_request(tokenEndpoint, 'POST', headers, body, onToken);
}

function onToken(responseText) {
    responseBody = JSON.parse(responseText);
    console.log("result =" + responseText);
    connect(responseBody.access_token);
}

function logout() {
    client.close();
}

function connect(token) {
    activeGroupId = null;
    activeHouseholdId = null;
    activeAccessToken = token;
    console.log('Access token = ' + token);
    client = new WebSocket(museEndpoint);
    initClientHandlers();
}

function initClientHandlers() {
    client.onopen = function( event ) {
        onOpen();
    }
    client.onclose = function( event ) {
        console.log('Disconnected from Mitch');
    }
    client.onmessage = function( event ) {
        onMessageHandler(event.data);
    }
    client.onError = function(event) {
        if (onErrorCB)
            onErrorCB(event.data);
    }
}

function onMessageHandler(responseData) {
    var responseJson = JSON.parse(responseData);
    var responseHeader;
    var responseBody;

    if (typeof(responseJson.header) == 'undefined') {
        // MitC format
        responseHeader = responseJson[0];
        responseBody = responseJson[1];
    }
    else {
        // Muse on the LAN format
        responseHeader = responseJson.header;
        responseBody = responseJson.body;
    }

    console.log(responseData);

    if (typeof(responseHeader) == 'undefined' || responseHeader.event == 'error') {
        client.onError(responseData);
    }
    else
    if (responseHeader.namespace == 'authentication:1') {
        if (responseHeader.response == 'authenticate')
            onAuthenticateResponse();
    }
    else
    if (responseHeader.namespace == 'households:1') {
        if (responseHeader.response == 'getHouseholds')
            onGetHouseholdsResponse(responseBody.households);
    }
    else
    if (responseHeader.namespace == 'topology:1') {
        if (responseHeader.response == 'getTopologyStatus')
            onGetTopologyStatusResponse(responseBody.devices);
    }
    else
    if (responseHeader.namespace == 'groupvolume:1') {
        if (responseHeader.event == 'groupVolume') {
            if (onGetVolumeResponseCB)
                onGetVolumeResponseCB(responseBody.volume);
        }
    }
}

function onOpen() {
    authenticate(activeAccessToken);
}

function onAuthenticateResponse() {
    getHouseholds();
}

function onGetHouseholdsResponse(householdIds) {
    if (householdIds.length == 0) {
        alert("No households found. Your player might not be connected to Lechmere. Read the user's guide.");
    }
    else {
        if (onGetHouseholdsCB)
            onGetHouseholdsCB(householdIds);
    }
}

function setActiveHouseholdId(householdId) {
    activeHouseholdId = householdId;
    console.log('Set active household: ' + activeHouseholdId)
    getTopologyStatus(activeHouseholdId);
}

function onGetTopologyStatusResponse(devices) {
    devices.forEach(function(device) {
        if (activeGroupId == null && typeof(device.isInvisible) == 'undefined' && device.name != 'BOOST' && device.name != 'BRIDGE') {
            activeGroupId = device.groupId;
        }
    });
    if (null == activeGroupId) {
        alert("Could not find active group Id.");
    }
    else {
        console.log('Set active groupId: ' + activeGroupId)
        if (onConnectCB)
            onConnectCB(activeGroupId);
    }
}

function authorizeHousehold(householdId, subjectId) {
    console.log('Authorizing "' + subjectId + '" as owner of household "' + householdId + '"');
    http_request(authzBaseUrl + '/v0/grant/user/' + subjectId + '/household/' + householdId + '/role/owner', 'POST', 1000)
}

function sendMuseCommand(namespace, command, body) {
    if (typeof(body) == 'undefined') body = {};
    client.send(JSON.stringify([{"namespace" : namespace, "command" : command}, body]));
}

function sendMuseCommandToGroup(namespace, command, groupId, body) {
    if (typeof(body) == 'undefined') body = {};
    client.send(JSON.stringify([{"namespace" : namespace, "command" : command, "groupId" : groupId}, body]));
}

function sendMuseCommandToHousehold(namespace, command, householdId, body) {
    if (typeof(body) == 'undefined') body = {};
    json = JSON.stringify([{"namespace" : namespace, "command" : command, "householdId" : householdId}, body]);
    client.send(json);
}

function http_request(url, method, headers, body, responseCB) {
    var xmlHttp = new XMLHttpRequest();

    xmlHttp.open(method, url, true);
    xmlHttp.addEventListener("progress", updateProgress, false);
    if (typeof(headers) != 'undefined') {
        headers.forEach(function(header) {
            xmlHttp.setRequestHeader(header[0], header[1]);
        })
    }
    if (typeof(body) != 'undefined')
        xmlHttp.send( body );
    else
        xmlHttp.send();

    function updateProgress() {
        if (xmlHttp.readyState == 3 && xmlHttp.status == 200) {
            if (typeof(responseCB) != 'undefined')
                responseCB(xmlHttp.responseText);
        }
    }
}


//================= MUSE COMMANDS START ======================
function authenticate(token) {
    sendMuseCommand('authentication:1', 'authenticate', {'accessToken' : token});
}

function getHouseholds() {
    sendMuseCommand('households:1', 'getHouseholds');
}

function play(groupId) {
    sendMuseCommandToGroup("playback:1", "play", groupId);
}

function pause(groupId) {
    sendMuseCommandToGroup("playback:1", "pause", groupId);
}

function previous(groupId) {
    sendMuseCommandToGroup("playback:1", "skipToPreviousTrack", groupId);
}

function next(groupId) {
    sendMuseCommandToGroup("playback:1", "skipToNextTrack", groupId);
}

function getVolume(groupId) {
    sendMuseCommandToGroup("groupvolume:1", "getVolume", groupId);
}

function setVolume(groupId, volume) {
    sendMuseCommandToGroup("groupvolume:1", "setVolume", groupId, {"volume": volume});
}

function getTopologyStatus(householdId) {
    sendMuseCommandToHousehold("topology:1", "getTopologyStatus", householdId);
}

function subscribe(groupId, namespace) {
    sendMuseCommandToGroup(namespace, "subscribe", groupId, {"groupId": groupId});
}
//================= MUSE COMMANDS END ======================
