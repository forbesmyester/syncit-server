# syncit-server

Basic Server for SyncIt using MongoDB / Mongoskin (or Memory) and designed to be embedded into Node.JS's Express.

## MongoDB Data Model

The data is stored in the following format

	{
		"s" : "cars",
		"k" : "bmw",
		"b" : 1,
		"m" : "userId@deviceId",
		"r" : null,
		"u" : "{\"$set\":{\"model\":\"320d"}}",
		"o" : "update",
		"t" : 1399316280922,
		"j" : {
			"i" : {
				"color" : "blue",
				"size" : "medium",
				"model" : "320d"
			},
			"v" : 2,
			"r" : false,
			"t" : 1399316280922,
			"m" : "userId@deviceId"
		},
		"_id" : ObjectId("5367df39f0dfe30104790dbf")
	}

This tells us the following information:

 * Dataset: This is the major classification of data, it takes the place of what would be a table in MySQL. In the example the data is "cars".
 * Datakey: A Datakey uniquely identifies a piece of data within a Dataset. The "bmw" data here can only occur once.
 * Based On: 1 - This change is based on version 1 of the cars.bmw Dataset / Datakey.
 * Modifier: The modifier was userId@deviceId - Note this must be unique for every synchronization client, even if they are the same user.
 * Removed: There was no change to the removed status.
 * Update: The update set the "model" to "320d" while preserving all other data.
 * Operation: The operation was an "update". It is possible to do other operations such as "set", for example.
 * Time: The time when the client made the change  was the timestamp 1399316280922 (according to the client)
 * There is some de-normalized data in "J" which is so that we can get the data without reading all previous updates to the Dataset / Datakey.
 * Id: This is used partly as a sequencer for the data. It is possible to request / recieve updates on a specified dataset after this.

The code in this repository will also set up a unique non-sparse index on across "s", "k" and "b" to ensure that there is only one update for each data point... The clients, are in charge of merging changes.

Should you wish to shard this data, you should use just "s" as your shard key.

## Processes

### Request changes within a Dataset - Suggested URL: /syncit/sequence/:s[/:seqId]

When a client wants to request data, it will request it for a known Dataset. It may or may not already have data for that Dataset, it it does it can also pass the optional parameter 'seqId' as part of the URL. The expected response to this a a "200 OK" with the following data format.

	{
		"queueitems": [
			{
				"s": "cars",
				"k": "bmw",
				"b": 0,
				"m": "userId@deviceId",
				"r": null,
				"u": {
					"color" : "blue",
					"size" : "medium",
				},
				"o": "set",
				"t": 1399576539003
			}
		],
		"seqId": "536bd7db7a2c620a469b37dd"
	}

If the Dataset has not been written to it will __still__ respond with a "200 OK", taking it as a Dataset which has just not been written to yet. It probably should, but does not currently validate the Dataset name.

### Keep updated with new Changes - Suggested URL: '/sync/:deviceId?dataset[]=...&dataset[]=...'

Ideally, when the user is connected to the internet and the App is open they should not have to wait for updates. This URL will provide an EventSource (Server Sent Events) connection so they do not have to. The data format for the events is as follows:

	{
		"command": "queueitem",
		"queueitem": {
			"s": "wks79OnGbgwa",
			"k": "X7p6au7g00",
			"b": 0,
			"m": "X2pbtb9q00",
			"t": 1399578164699,
			"u": { "completed":false, "editing":false, "title":"j" },
			"o": "set"
		},
		"seqId": "536bd7db7a2c620a469b37dd"
	}

This connection will be held open as long as possible, until it is severed by server disconnection or a communication error. As such there is no HTTP status code. Note as datasets are passed as part of the URL you should be wary of making applications that require watching of vast amounts of datasets.

### Push changes onto server - Suggested URL: '/syncit/:deviceId'

Being able to get changes, by itself will serve no purpose should changes to be able to be pushed onto the server. This could be done with a HTTP POST request with the following data:

	{
		"o": "set",
		"u": {
			"completed": false,
			"editing": false,
			"title": "a"
		},
		"s": "wks79OnGbgwa",
		"k": "X7rmhofr00",
		"t": 1399662274271,
		"b": 0
	}

This will respond with one of the following HTTP Status codes:

	* 200 OK - When an Queueitem has been added to a Dataset / Datakey which already existed.
	* 201 Created - Queueitem added to the Dataset / Datakey which did not already exist.
	* 400 Bad Request - The URL or data provided is not valid.
	* 301 See Other - The Modifier (deviceId) has already added data for that Dataset / Datakey / Version (b).
	* 412 Precondition Failed - The "b" field (version) is higher than what is expected.
	* 409 Conflict - There already exists data for the supplied Dataset / Datakey / Version (and that deviceId (m) did not add it.
	* 410 Gone - All given data is valid however the Queueitem already has been removed (the "r" flag).

The data returned within the body of this request will look something like the following:

	{
		"sequence": "/syncit/sequence/cars/536d2f9f6fbc9fb87644aa61",
		"change": "/syncit/change/cars/bmw/1"
	}

This data gives you the path portions of two URL's. The "change" is the change you just uploaded. The "sequence" is a URL which you can use to get all changes posted __after__ this one, it does not include this change itself.

## Usage

Note this is mostly taken from the [SyncItTodoMvc](https://github.com/forbesmyester/SyncItTodoMvc) project.

### Import Classes

Load the required classes.

	var SseCommunication = require('./lib/SseCommunication/Simple'),
		ReferenceServer = require('syncit-server/ReferenceServer'),
		mongoskin = require('mongoskin');

### Setup SyncIt Server instances

When creating an instance of ServerPersistMongodb you will need to provide a serialization function, a Mongoskin connection, The MongoDB ObjectId class, The collection to store the data in and a logging function (empty in the example). This ServerPersistMongodb instance will then be passed into the ReferenceServer class, along with a class for doing Server Sent Events communcation and a function used for extracting deviceIds (modifiers).

	var sseCommunication = new SseCommunication(),
		mongoskinConnection = mongoskin.db(
			'mongodb://mongodb.yourdomain.com:27017/syncitdb,
			{w:true}
		),
		mongoDbPersistance = new ServerPersistMongodb(
			function(v) { "use strict"; return JSON.parse(JSON.stringify(v)); },
			mongoskinConnection,
			mongoskin.ObjectID,
			appConfig.syncit.data_collection,
			function() {}
		),
		referenceServer = new ReferenceServer(
			function(req) { "use strict"; return req.params.deviceId; }, // The method of how to retrieve the deviceId... Depending on your use case this may need to be more secure than this... deviceIds are public to anyone with access to the Dataset.
			mongoDbPersistance,
			sseCommunication
		);
	
### Common Functions

ReferenceServer does not actually respond with HTTP Status codes, but with strings such as "bad_request" for code readability sake. There are functions here for transforming those strings into real status codes as well the "getQueueitemSequence()" function which is only there to keep the code DRY.

	var statusCodesObj = (function(data) {
		"use strict";
		var oData = {};
		for (var i=0, l=data.length; i<l; i++) {
			oData[
				data[i].description.toLowerCase().replace(/[^a-z]/,'_')
			] = data[i].status;
		}
		return oData;
	}(require('./res/http_status_codes.js')));

	var getStatusCode = function(status) {
		"use strict";
		var aliases = {
			validation_error: 'bad_request'
		};
		if (aliases.hasOwnProperty(status)) {
			status = aliases[status];
		}
		if (!statusCodesObj.hasOwnProperty(status)) {
			throw "Could not find status code for status '" + status + "'";
		}
		return statusCodesObj[status];
	};

	var getQueueitemSequence = function(req, res, next) {
		"use strict";
		referenceServer.getQueueitems(
			req,
			function(err, status, data) {
				if (err) { return next(err); }
				res.json(getStatusCode(status), data);
			}
		);
	};

## Set up the URL's

	app.get('/syncit/sequence/:s/:seqId', getQueueitemSequence);
	app.get('/syncit/sequence/:s', getQueueitemSequence);

	app.get('/sync/:deviceId', referenceServer.sync.bind(referenceServer));

	app.get('/syncit/change/:s/:k/:v', function(req, res, next) {
		"use strict";
		referenceServer.getDatasetDatakeyVersion(
			req,
			function(err, status, data) {
				if (err) { return next(err); }
				res.json(getStatusCode(status), data);
			}
		);
	});

	app.post('/syncit/:deviceId', function(req, res, next) {
		"use strict";
		referenceServer.push(req, function(err, status, data) {
			if (err) { return next(err); }
			res.json(getStatusCode(status), data);
		});
	});

