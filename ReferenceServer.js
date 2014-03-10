(function (root, factory) { // UMD adapted from https://github.com/umdjs/umd/blob/master/returnExports.js
	"use strict";
	
	if (typeof exports === 'object') {
		module.exports = factory(
			require('syncit/js/Constant.js'),
			require('add-events')
		);
	} else {
		define(
			['syncit/Constant', 'add-events'],
			factory
		);
	}
})(this, function (SyncIt_Constant, addEvents) {


// Author: Matthew Forrester <matt_at_keyboardwritescode.com>
// Copyright: 2013 Matthew Forrester
// License: MIT/BSD-style

"use strict";

var queueitemProperties = ['s','k','b','m','t','u','o'];

/**
 * ### new TestServer()
 * 
 * Constructor
 * 
 * #### Parameters
 * 
 * * **@param {ServerImplementation} `serverImplementation`**
 * * **@param {Function} `extractModifierFromRequestFunc`** This function will be used to get the modifier for a Dataset / Datakey, it is anticipated this is from the Express Request.
 */
var ReferenceServer = function(extractModifierFromRequestFunc, serverImplementation) {
	if (typeof extractModifierFromRequestFunc != 'function') {
		throw "You must specify a way to get the modifier";
	}
	this._getModifier = extractModifierFromRequestFunc;
	this._inst = serverImplementation;
};

/**
 * ### TestServer.getDatasetNames()
 * 
 * Retrieves a list of *Dataset* names.
 *
 * #### Parameters
 *
 * * **@param {Request} `req`** A Express like Request Object
 * * **@param {Function} `responder`** Callback. Signature: `function (statusString, data)`
 *   * **@param {String} `responder.statusString`** Always 'ok'
 *   * **@param {Array} `responder.data`** An Array of *Dataset* names
 */
ReferenceServer.prototype.getDatasetNames = function(req, responder) {
	this._inst.getDatasetNames(responder);
};

/**
 * ### ReferenceServer.getQueueitems()
 * 
 * Retrieves a list of Queueitem from a previously known one.
 *
 * #### Parameters
 *
 * * **@param {Request} `req`** A Express like Request Object
 *   * **@param {String} `req.(param|query|body).s`** REQUIRED: The *Dataset* you want to download updates from
 *   * **@param {String} `req.(param|query|body).seqId`** OPTIONAL: The last known Id for a Queueitem, if supplied all items from, but not including that Queueitem will be downloaded.
 * * **@param {Function} `responder`** Callback. Signature: `function (statusString, data)`
 *   * **@param {String} `responder.statusString`** 'validation_error' if no dataset supplied, 'ok' otherwise.
 *   * **@param {Object} `responder.data`** An object in the form `{queueitems: [<Queueitem>,<Queu...>], seqId: <QueueitemId>}`
 */
ReferenceServer.prototype.getQueueitems = function(req, responder) {
	var reqInfo = this._extractInfoFromRequest(req, ['seqId']);
	if (!this._validateInputFieldAgainstRegexp(
		's',
		SyncIt_Constant.Validation.DATASET_REGEXP,
		reqInfo
	)) {
		return responder('validation_error',null);
	}
	this._inst.getQueueitems(
		reqInfo.s,
		reqInfo.hasOwnProperty('seqId') ? reqInfo.seqId : null,
		responder
	);
};

/**
 * ### ReferenceServer.getDatasetDatakeyVersion()
 * 
 * Retrieves a list of Queueitem from a previously known one.
 *
 * #### Parameters
 *
 * * **@param {Request} `req`** A Express like Request Object
 *   * **@param {String} `req.(param|query|body).s`** REQUIRED: The *Dataset* you want to download updates from
 *   * **@param {String} `req.(param|query|body).k`** REQUIRED: The *Datakey* you want to download updates from
 *   * **@param {String} `req.(param|query|body).v`** OPTIONAL: The version of the change you want to get.
 * * **@param {Function} `responder`** Callback. Signature: `function (statusString, data)`
 *   * **@param {String} `responder.statusString`** 'validation_error' if no dataset supplied, 'ok' otherwise.
 *   * **@param {Object} `responder.data`** An object in the form `{queueitems: [<Queueitem>,<Queu...>], seqId: <QueueitemId>}`
 */
ReferenceServer.prototype.getDatasetDatakeyVersion = function(req, responder) {
	var reqInfo = this._extractInfoFromRequest(req, ['v']);
	if (!this._validateInputFieldAgainstRegexp(
		's',
		SyncIt_Constant.Validation.DATASET_REGEXP,
		reqInfo
	)) {
		return responder('validation_error',null);
	}
	if (!this._validateInputFieldAgainstRegexp(
		'k',
		SyncIt_Constant.Validation.DATAKEY_REGEXP,
		reqInfo
	)) {
		return responder('validation_error',null);
	}
	this._inst.getDatasetDatakeyVersion(
		reqInfo.s,
		reqInfo.k,
		reqInfo.hasOwnProperty('v') ? reqInfo.v : null,
		responder
	);
};

/**
 * ### ReferenceServer.getValue()
 *
 * #### Parameters
 *
 * * **@param {Request} `req`** A Express like Request Object
 *   * **@param {String} `req.(param|query|body).k`** REQUIRED: The *Datakey* you want to get the value from.
 *   * **@param {String} `req.(param|query|body).s`** REQUIRED: The *Dataset* you want to get the value from.
 * * **@param {Function} `responder`** Callback. Signature: `function (statusString, data)`
 *   * **@param {String} `responder.statusString`** `validation_error` if not given a valid looking Dataset and Datakey. `not_found` If the Dataset and Datakey has no records. `gone` If there was data, but it has been deleted. `ok` should data be found.
 *   * **@param {Object} `responder.data`** The Jrec stored at that location.
 */
ReferenceServer.prototype.getValue = function(req, responder) {
	var reqInfo = this._extractInfoFromRequest(req);
	
	if (!this._validateInputFieldAgainstRegexp(
		's',
		SyncIt_Constant.Validation.DATASET_REGEXP,
		reqInfo
	)) { return responder('validation_error',null); }
	if (!this._validateInputFieldAgainstRegexp(
		'k',
		SyncIt_Constant.Validation.DATAKEY_REGEXP,
		reqInfo
	)) { return responder('validation_error',null); }
	
	this._inst.getValue(reqInfo.s, reqInfo.k, responder);
};

/**
 * ### TestServer._setRemoveOrUpdate()
 * 
 * TestServer.PATCH(), TestServer.PUT() and TestServer.DELETE() really all do 
 * the same thing, that being to put a Queueitem on the Queue and then calculate
 * the result of that operation. Therefore all the functions wrap this general
 * purpose function.
 *
 * * **@param {Request} `req`** A Express like Request Object
 *   * **@param {Object} `req.(param|query|body)`** Should look like a Queueitem.
 * * **@param {Function} `responder`** Callback. Signature: `function (statusString, data)`
 *   * **@param {String} `responder.statusString`** Quite a set... `validation_error` || `service_unavailable` || `conflict` || `out_of_date` || `gone` || `created` || `ok`
 *   * **@param {Object} `responder.data`**
 *   * **@param {String} `responder.data.seqId`** The update number within the Dataset
 *   * **@param {Queueitem} `responder.data.queueitem`** The Queueitem which has just been added
 */
ReferenceServer.prototype.push = function(req, responder) {

	if (!this._validate_queueitem(req)) {
		return responder('validation_error',null);
	}
	
	var queueitem = this._extractInfoFromRequest(req);

	if (!queueitem.hasOwnProperty('o')) {
		return responder('validation_error');
	}
	
	if (!queueitem.hasOwnProperty('b')) {
		return responder('validation_error');
	}
	
	this._inst.push(queueitem, function(status, data) {
		if (['ok', 'created'].indexOf(status) !== -1) {
			this._emit(
				'fed',
				req,
				data.seqId,
				data.queueitem.s,
				data.queueitem.k,
				data.queueitem,
				data.jrec
			);
		}
		responder(status, data);
	}.bind(this));
	
};


/**
 * ### ReferenceServer.PUT()
 *
 * The operation (o) in the Request (`req.body`) object should be 'set'. For all other documentation see [ReferenceServer.push()](#referenceserver.push--).
 */
ReferenceServer.prototype.PUT = function(req,responder) {
	if (this._extractInfoFromRequest(req).o !== 'set') {
		return responder('validation_error');
	}
	this.push(req,responder);

};
/**
 * ### ReferenceServer.PATCH()
 *
 * The operation (o) in the Request (`req.body`) object should be 'update'. For all other documentation see [ReferenceServer.push()](#referenceserver.push--).
 */
ReferenceServer.prototype.PATCH = function(req,responder) {
	if (this._extractInfoFromRequest(req).o !== 'update') {
		return responder('validation_error');
	}
	this.push(req,responder);
};
/**
 * ### ReferenceServer.DELETE()
 *
 * The operation (o) in the Request (`req.body`) object should be 'remove'. For all other documentation see [ReferenceServer.push()](#referenceserver.push--).
 */
ReferenceServer.prototype.DELETE = function(req,responder) {
	if (this._extractInfoFromRequest(req).o !== 'remove') {
		return responder('validation_error');
	}
	this.push(req,responder);
};


/**
 * ### TestServer._extractInfoFromRequest()
 * 
 * Extracts Queueitem information and any extra from an express `req`.
 * 
 * Expects to see something like the following:
 * 
 * ```
 * {
 *     s: <Dataset>,
 *     k: <Datakey>,
 *     b: <Basedonversion>,
 *     m: <Modifier>, // (Note: This should not be here, or at least should be overridden by the Session or something that the User cannot control)
 *     t: <Modificationtime>,
 *     o: <Operation>,
 *     u: <Update>,
 * }
 * ```
 *
 * See [SyncIt documentation](SyncIt.js.html) for details about what a Queueitem is etc.
 *
 * #### Parameters
 *
 * * **@param {Request} `req`** A Express like Request Object.
 * * **@param {Array} `extras`** See description.
 */
ReferenceServer.prototype._extractInfoFromRequest = function(req, extras) {
	
	var r = {},
		i = 0,
		j = 0,
		inputZones = ['body', 'query', 'params'];
	
	for (i=0; i<inputZones.length; i++) {
		if (!req.hasOwnProperty(inputZones[i])) {
			continue;
		}
		for (j=0; j<queueitemProperties.length; j++) {
			if (req[inputZones[i]].hasOwnProperty(queueitemProperties[j])) {
				r[queueitemProperties[j]] = req[inputZones[i]][queueitemProperties[j]];
			}
		}
		if (extras !== undefined) {
			for (j=0; j<extras.length; j++) {
				if (req[inputZones[i]].hasOwnProperty(extras[j])) {
					r[extras[j]] = req[inputZones[i]][extras[j]];
				}
			}
		}
	}
	
	r.m = this._getModifier(req);
	
	var fixTypesBeforeStore = function(ob) {
		
		var forceStr = function(v) { return "" + v; };
		var forceInt = function(v) { return parseInt(v,10); };
		var forceBool = function(v) { return v ? true : false; };
		var forceField = function(ob,field,forcingFunc) {
			if (ob.hasOwnProperty(field)) {
				ob[field] = forcingFunc(ob[field]);
			}
			return ob;
		};
		
		ob = forceField(ob, 's', forceStr);
		ob = forceField(ob, 'k', forceStr);
		ob = forceField(ob, 'b', forceInt);
		ob = forceField(ob, 'm', forceStr);
		ob = forceField(ob, 'r', forceBool);
		ob = forceField(ob, 'o', forceStr);
		ob = forceField(ob, 't', forceInt);
		
		return ob;
	};
	
	return fixTypesBeforeStore(r);

};

/**
 * ### validateInputFieldAgainstRegex
 * 
 * Validates a Request (`req`) `field` within either the `req.body` or `req.params` against a `regexp`.
 *
 * #### Parameters
 *
 * * **@param {String} `field`** The field you are checking.
 * * **@param {Regexp} `regexp`** The RegExp you are checking the field against.
 * * **@param {Request} `reqInfo`** Information extract from an express `req` via TestServer._extractInfoFromRequest()
 * * **@return {Boolean}** `true` if the input is OK.
 */
ReferenceServer.prototype._validateInputFieldAgainstRegexp = function(field,regexp,reqInfo) {
	if (!regexp) {
		return false;
	}
	if (!reqInfo.hasOwnProperty(field)) {
		return false;
	}
	if (reqInfo[field].match(regexp) !== null) {
		return true;
	}
	return false;
};

ReferenceServer.prototype._validate_queueitem = function(req) {
	
	var reqInfo = this._extractInfoFromRequest(req);
	
	// dataset
	if (!this._validateInputFieldAgainstRegexp(
		's',
		SyncIt_Constant.Validation.DATASET_REGEXP,
		reqInfo
	)) { return false; }
	
	// datakey
	if (!this._validateInputFieldAgainstRegexp(
		'k',
		SyncIt_Constant.Validation.DATAKEY_REGEXP,
		reqInfo
	)) { return false; }
	
	// modifier
	if (!this._validateInputFieldAgainstRegexp(
		'm',
		SyncIt_Constant.Validation.MODIFIER_REGEXP,
		reqInfo
	)) { return false; }
	
	// operation
	if (!this._validateInputFieldAgainstRegexp(
		'o',
		SyncIt_Constant.Validation.OPERATION_REGEXP,
		reqInfo
	)) { return false; }
	
	for (var i=0; i < queueitemProperties.length; i++) {
		if (!reqInfo.hasOwnProperty(queueitemProperties[i])) {
			return false;
		}
	}
	
	return true;
};


/**
 * ### TestServer.listenForFed()
 * 
 * Listen for data changes.
 *
 * #### Parameters
 *
 * * **@param {Function} `listener`** Callback. Signature: `function (processedQueueitem, processedJrec)`.
 *   * **@param {Request} `listener.req`** An Express Request (first param of TestServer._setRemoveOrUpdate()).
 *   * **@param {Request} `listener.to`** The sequence within the Dataset.
 *   * **@param {String} `listener.dataset`** The dataset of the just fed Queueitem.
 *   * **@param {String} `listener.datakey`** The datakey of the just fed Queueitem.
 *   * **@param {Queueitem} `listener.processedQueueitem`** The Queueitem which has just been added
 *   * **@param {Storerecord} `listener.processedJrec`** The resulting data after the Queueitem has been applied
 */
ReferenceServer.prototype.listenForFed = function(listener) {
	this.listen('fed',listener);
};
/**
 * ### TestServer.listen()
 *
 * See [TestServer.listenForFed()](#testserver.listenforfed--), as that is the only supported event.
 *
 * #### Parameters
 *
 * * **@param {String} `event`** The event to listen to
 * * **@param {Function} `listener`** The function which will be fired when the event occurs
 */
ReferenceServer.prototype.listen = function(event,listener) {
	
	var propertyNames = (function(ob) {
		var r = [];
		for (var k in ob) { if (ob.hasOwnProperty(k)) {
			r.push(k);
		} }
		return r;
	})(this._listeners);
	
	if (propertyNames.indexOf(event) == -1) {
		return false;
	}
	this._listeners[event].push(listener);
	return true;
};

addEvents(ReferenceServer,['fed']);

return ReferenceServer;

});
