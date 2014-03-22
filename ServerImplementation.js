(function (root, factory) { // UMD adapted from https://github.com/umdjs/umd/blob/master/returnExports.js
	"use strict";
	if (typeof exports === 'object') {
		module.exports = factory(require('sync-it/Constant'));
	} else {
		define(['sync-it/Constant'], factory);
	}
})(this, function (SyncIt_Constant) {

// Author: Matthew Forrester <matt_at_keyboardwritescode.com>
// Copyright: 2013 Matthew Forrester
// License: MIT/BSD-style

"use strict";

/**
 * ### new TestServer()
 * 
 * Constructor
 * 
 * #### Parameters
 * 
 * * **@param {ServerPersist} `serverPersist`** A [ServerPersist](ServerPersist/MemoryAsync.js.html) instance.
 */
var TestServer = function(serverPersist) {
	this._serverPersist = serverPersist;
};

/**
 * ### TestServer.getDatasetNames()
 * 
 * Retrieves a list of *Dataset* names.
 *
 * #### Parameters
 *
 * * **@param {Function} `responder`** Callback. Signature: `function (err, statusString, data)`
 *	 * **@param {String} `responder.statusString`** Always 'ok'
 *	 * **@param {Array} `responder.data`** An Array of *Dataset* names
 */
TestServer.prototype.getDatasetNames = function(responder) {
	this._serverPersist.getDatasetNames(function(err, status, names) {
		if (err) { return responder(err); }
		responder(err, 'ok', names);
	});
};

/**
 * ### TestServer.getQueueitems()
 * 
 * Retrieves a list of Queueitem from a previously known one.
 *
 * #### Parameters
 *
 * * **@param {String} `dataset`** REQUIRED: The *Dataset* you want to download updates from
 * * **@param {String|null} `seqId`** The last known Id for a Queueitem, if not undefined all items from, but not including that Queueitem will be downloaded.
 * * **@param {Function} `responder`** Callback. Signature: `function (err, statusString, data)`
 *	 * **@param {String} `responder.statusString`** 'validation_error' if no dataset supplied, 'ok' otherwise.
 *	 * **@param {Object} `responder.data`** An object in the form `{queueitems: [<Queueitem>,<Queu...>], seqId: <QueueitemId>}`
 */
TestServer.prototype.getQueueitems = function(dataset, seqId,  responder) {
	
	this._serverPersist.getQueueitems(
		dataset,
		seqId,
		function(err, status, queueitems, toSeqId) {
			if (err) { return responder(err); }
			return responder(err, 'ok',{ queueitems: queueitems, seqId: toSeqId});
		}
	);
};

/**
 * ### TestServer.getDatasetDatakeyVersion()
 * 
 * Retrieves a list of Queueitem from a previously known one.
 *
 * #### Parameters
 *
 * * **@param {String} `dataset`** The *Dataset* you want to download the update for
 * * **@param {String} `datakey`** The *Datakey* you want to download the update for
 * * **@param {Number} `version`** The *Version* of the update you want to get
 * * **@param {Function} `responder`** Callback. Signature: `function (err, statusString, data)`
 *	 * **@param {String} `responder.statusString`** 'validation_error' if no dataset supplied, 'ok' otherwise.
 *	 * **@param {Object} `responder.data`** The change
 */
TestServer.prototype.getDatasetDatakeyVersion = function(dataset, datakey, version, responder) {
	
	this._serverPersist.getDatasetDatakeyVersion(
		dataset,
		datakey,
		version,
		function(err, status, atVersion) {
			if (err) { throw err; }
			if (err === SyncIt_Constant.Error.NO_DATA_FOUND) {
				return responder(err, 'not_found', null);
			}
			return responder(err, 'ok', atVersion);
		}
	);
};

/**
 * ### TestServer.getValue()
 *
 * #### Parameters
 *
 * * **@param {String} `dataset`** REQUIRED: The *Dataset* you want to get the value from.
 * * **@param {String} `datakey`** REQUIRED: The *Datakey* you want to get the value from.
 * * **@param {Function} `responder`** Callback. Signature: `function (err, statusString, data)`
 *	 * **@param {String} `responder.statusString`** `validation_error` if not given a valid looking Dataset and Datakey. `not_found` If the Dataset and Datakey has no records. `gone` If there was data, but it has been deleted. `ok` should data be found.
 *	 * **@param {Object} `responder.data`** The Jrec stored at that location.
 */
TestServer.prototype.getValue = function(dataset, datakey, responder) {
	
	this._serverPersist.getValue(
		dataset,
		datakey,
		function(err, status, jrec) {
			if (err) { return responder(err); }
			if (status === SyncIt_Constant.Error.NO_DATA_FOUND) {
				return responder(err,'not_found',null);
			}
			if (jrec.r) {
				return responder(err,'gone',jrec);
			}
			return responder(err,'ok',jrec);
		}
	);
};

/**
 * ### TestServer.push()
 * 
 * Attempts to add a Queueitem to a dataset / datakey.
 *
 * * **@param {Queueitem} `queueitem`** Should look like a Queueitem.
 * * **@param {Function} `responder`** Callback. Signature: `function (err, statusString, data)`
 *	 * **@param {String} `responder.statusString`** Quite a set... `validation_error` || `service_unavailable` || `conflict` || `out_of_date` || `gone` || `created` || `ok`
 *	 * **@param {Object} `responder.data`**
 *	 * **@param {String} `responder.data.seqId`** The update number within the Dataset
 *	 * **@param {Queueitem} `responder.data.queueitem`** The Queueitem which has just been added
 */
TestServer.prototype.push = function(queueitem,responder) {
	
	// Translations from SyncIt_Constant.Error to StatusString.
	var feedErrors = {
		lockedError:function(status) {
			if (status === SyncIt_Constant.Error.UNABLE_TO_PROCESS_BECAUSE_LOCKED) {
				return 'service_unavailable';
			}
			return false;
		},
		versionError: function(status) {
			if (status === SyncIt_Constant.Error.TRYING_TO_ADD_FUTURE_QUEUEITEM) {
				return 'precondition_failed';
			}
			return false;
		},
		unexpectedError: function(status) {
			if (status !== SyncIt_Constant.Error.OK) {
				throw "TestServer.unexpectedError: Unexpected error code "+status;
			}
			return false;
		},
		tryingToApplyOld: function(status) {
			if (status == SyncIt_Constant.Error.TRYING_TO_ADD_QUEUEITEM_BASED_ON_OLD_VERSION) {
				return 'conflict';
			}
			return false;
		},
		modifyRemoved: function(status) {
			if (status == SyncIt_Constant.Error.DATA_ALREADY_REMOVED) {
				return 'gone';
			}
			return false;
		}
	};
	
	var inst = this;
	inst._serverPersist.push(
		queueitem,
		function(err, status, processedQueueitem, processedJrec, createdId) {
			
			if (err) { return responder(err); }
			
			var emit = false;
			
			if (status === SyncIt_Constant.Error.OK) {
				emit = true;
			}
			
			if (status === SyncIt_Constant.Error.TRYING_TO_ADD_ALREADY_ADDED_QUEUEITEM) {
				status = SyncIt_Constant.Error.OK;
			}
			
			var checks = [
				feedErrors.lockedError,
				feedErrors.versionError,
				feedErrors.tryingToApplyOld,
				feedErrors.modifyRemoved,
				feedErrors.unexpectedError
			];
			
			var r = false;
			
			for (var i=0;i<checks.length;i++) {
				r = checks[i].call(this, status);
				if (r !== false) {
					return responder(err,r,null);
				}
			}
			
			if (!emit) {
				return responder(
					err,
					'see_other',
					{ seqId: createdId, queueitem: processedQueueitem }
				);
			}

			return responder(
				err,
				queueitem.b === 0 ? 'created' : 'ok',
				{ seqId: createdId, queueitem: processedQueueitem, jrec: processedJrec }
			);
		},
		function() {
		}
	);

};

return TestServer;
});
