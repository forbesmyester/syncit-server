module.exports = (function() {

// Author: Matthew Forrester <matt_at_keyboardwritescode.com>
// Copyright: 2013 Matthew Forrester
// License: MIT/BSD-style

/**
 * ## SyncIt_ServerPersist_MongoDb
 *
 * ### Upgrade Procudure v0 -> v1
 *
 *     var r = db.dat.aggregate([ {$sort: {'_id.n': 1, '_id.s': 1}}, {$project: { _id: 0, s: '$_id.s', k: '$k', b: '$b', m: '$m', r: '$r', u: '$u', o: '$o', t: '$t', j: '$j' }} ]);
 *     db.syncit.insert(r.result);
 */


"use strict";

var CommonFuncs = require('./CommonFuncs.js');
var SyncIt_Constant = require('sync-it/Constant.js');
var getIncrementalNumber = require('./getIncrementalNumberFromMongodb');

/**
 * ### SyncIt_ServerPersist_MemoryAsync()
 * 
 * Constructor.
 *
 * * **@param {Function} `cloneFunc`** The function to used for cloning.
 * * **@param {MongoskinConnection} `mongoskinConnection`** Must be connected.
 * * **@param {String} `ObjectID`** The ObjectId class from MongoDB / Mongoskin
 * * **@param {String} `dataCollection`** The name of the collection to store (accepted) data in. 
 * * **@param {Function} `logger`** Optional function will will log information during DB insertions.
 */
var SyncIt_ServerPersist_MongoDb = function(cloneFunc, mongoskinConnection, ObjectID, dataCollection, logger) {
	this._cloneFunc = cloneFunc;
	this._ObjectID = ObjectID;
	this._dataCollection = dataCollection;
	this._mongoskinConnection = mongoskinConnection;
	this._logger = function() {};
	if (logger !== undefined) {
		this._logger = logger;
	}
	this._mongoskinConnection.collection(dataCollection).ensureIndex(
		{s: 1, k: 1, b: 1},
		{unique: 1, sparse: false},
		function(err,name) {
			if (err) {
				throw new Error("SyncIt: MongoDB: Index:", err, name);
			}
		}
	);
};

SyncIt_ServerPersist_MongoDb.prototype._find = function(collection, query, done) {
	this._mongoskinConnection.collection(collection).find(query).toArray(function(err, items) {
		if (err) {
			throw new Error("SyncIt: MongoDB: _find:", err, collection, query);
		}
		done(err, items);
	});
};

/**
 * ### SyncIt_ServerPersist_MemoryAsync.getDatasetNames()
 * 
 * #### Parameters
 * 
 * * **@param {Function} `done`** Signature: `function (err, status, datasetNames)`
 *   * **@param {Errorcode} `done.err`**
 *   * **@param {Array} `done.datasetNames`** The names of all Dataset
 */
SyncIt_ServerPersist_MongoDb.prototype.getDatasetNames = function(done) {
	this._mongoskinConnection.collection(this._dataCollection).aggregate(
		{ $group: {'_id': '$s'} },
		function(e, res) {
			if (e) { return done(e); }
			var r = [],
				i, l;
			for (i=0, l=res.length; i<l; i++) {
				r.push(res[i]._id);
			}
			return done(null, r);
		}
	);
};

SyncIt_ServerPersist_MongoDb.prototype._unserialize = function(rec) {
	return {
		s: rec.s,
		k: rec.k,
		b: rec.b,
		m: rec.m,
		r: rec.r,
		u: JSON.parse(rec.u),
		o: rec.o,
		t: rec.t,
		j: rec.j
	};
};

/**
 * ### SyncIt_ServerPersist_MemoryAsync.getQueueitems()
 * 
 * #### Parameters
 * 
 * * **@param {String} `dataset`**
 * * **@param {String|null} `fromSeqId`** Where to read Queueitem from (not inclusive).
 * * **@param {Function} `done`** Signature: `done(err, status, queueitems, lastQueueitemIdentifier)`
 *   * **@param {Number} `done.err`** 
 *   * **@param {Number} `done.status`** See SyncIt_Constant.Error
 *   * **@param {Array} `done.queueitems`** An array of Queueitem
 *   * **@param {Object} `done.lastQueueitemIdentifier`** The internal reference of that last item, passing this to this function again will lead to continual reading.
 */
SyncIt_ServerPersist_MongoDb.prototype.getQueueitems = function(dataset, fromSeqId, done) {
	
	var q = {s: dataset},
		maxId = null;

	if (
		(typeof fromSeqId == 'string') &&
		((fromSeqId.length == 12) || (fromSeqId.length == 24))
	) {
		q._id = {$gt: this._ObjectID.createFromHexString(fromSeqId)};
		maxId = fromSeqId;
	}
	
	this._find( this._dataCollection, q, function(err, items) {
		if (err) { return done(err); }
		done(
			err,
			SyncIt_Constant.Error.OK,
			items.map(function(rec) {
				if ((maxId === null) || (rec._id > maxId)) {
					maxId = rec._id;
				}
				return this._unserialize(rec);
			}.bind(this)),
			maxId === null ? null : new this._ObjectID(maxId).toHexString()
		);
	}.bind(this));
	
};

/**
 * ### SyncIt_ServerPersist_MemoryAsync.getDatasetDatakeyVersion()
 * 
 * #### Parameters
 * 
 * * **@param {String} `dataset`** The *Dataset* you want to download the update for
 * * **@param {String} `datakey`** The *Datakey* you want to download the update for
 * * **@param {Number} `version`** The *Version* of the update you want to get
 * * **@param {Function} `done`** Signature: `done(err, status, queueitems, lastQueueitemIdentifier)`
 *   * **@param {Number} `done.err`** 
 *   * **@param {Number} `done.status`** See SyncIt_Constant.Error
 *   * **@param {Object} `responder.data`** The change
 */
SyncIt_ServerPersist_MongoDb.prototype.getDatasetDatakeyVersion = function(dataset, datakey, version, done) {
	
	var q = {"s": dataset, "k": datakey, "b": parseInt(version,10)-1};
	
	this._find( this._dataCollection, q, function(err, items) {
		if (err) {
			if (err) { return done(err); }
		}
		if ( (items === null) || (items.length === 0) ) {
			return done(err, SyncIt_Constant.Error.NO_DATA_FOUND);
		}
		var i = items[0];
		i.u = JSON.parse(i.u);
		delete i._id;
		delete i.j.m;
		done(
			err,
			SyncIt_Constant.Error.OK,
			items[0]
		);
	}.bind(this));
	
};

SyncIt_ServerPersist_MongoDb.prototype.getLastQueueitem = function(dataset,datakey, done) {
	return this._getLast(dataset, datakey, {}, done);
};

SyncIt_ServerPersist_MongoDb.prototype._getLast = function(dataset, datakey, projection, done) {
	
	this._mongoskinConnection.collection(this._dataCollection).findOne(
		{s: dataset, k: datakey},
		projection,
		{sort:[['_id', -1]]},
		function(err, result) {
			if (err) { return done(err); }
			if (
				(result === null) ||
				(Array.isArray(result) && (result.length === 0))
			) {
				return done(err, SyncIt_Constant.Error.NO_DATA_FOUND, result);
			}
			if (Object.getOwnPropertyNames(projection).length !== 0) {
				return done(err, SyncIt_Constant.Error.OK, result);
			}
			return done(err, SyncIt_Constant.Error.OK, this._unserialize(result));
		}.bind(this)
	);
};

/**
 * ### SyncIt_ServerPersist_MemoryAsync.getValue()
 * 
 * #### Parameters
 * 
 * * **@param {String} `dataset`**
 * * **@param {String} `datakey`**
 * * **@param {Function} `done`** Signature: `function (err, status, jrec)`
 *   * **@param {Number} `done.err`** 
 *   * **@param {Number} `done.status`** See SyncIt_Constant.Error
 *   * **@param {Jrec} `done.jrec`** The result of all the Queueitem.
 */
SyncIt_ServerPersist_MongoDb.prototype.getValue = function(dataset, datakey, done) {
	this._getLast(dataset, datakey, {j: 1}, function(err, status, res) {
		if (err) { return done(err); }
		if (res.hasOwnProperty('j') && res.j.hasOwnProperty('i')) {
			return done(err, status, res.j.i);
		}
		return done(err, status);
	});
};

/**
 * ### SyncIt_ServerPersist_MemoryAsync.push()
 * 
 * #### Parameters
 * 
 * * **@param {Queueitem} `queueitem`**
 * * **@param {Function} `done`** Signature: `function (err, queueitem, jrec, seqId)`
 *   * **@param {Number} `done.err`** 
 *   * **@param {Number} `done.status`** See SyncIt_Constant.Error
 *   * **@param {Queueitem} `done.queueitem`** The Queueitem passed in (successful or not)
 *   * **@param {Jrec} `done.jrec`** If successul, a Jrec, otherwise `undefined`
 *   * **@param {seqId} `done.seqId` The sequence within the dataset.
 */
SyncIt_ServerPersist_MongoDb.prototype.push = function(queueitem, done) {
	
	this._logger("SyncIt: MongoDB: Push:", queueitem);
	
	this._getLast(
		queueitem.s,
		queueitem.k,
		{},
		function(err, status, storedQueueitem) {
			
			if (err) { return done(err); }
			
			this._logger("SyncIt: MongoDB: Existing:", storedQueueitem);
			
			var result = CommonFuncs.getResultingJrecBasedOnOld(
				this._cloneFunc,
				storedQueueitem,
				queueitem
			);
			
			this._logger("SyncIt: MongoDB: Proposed:",result);
			
			if (result.status) {
				return(done(err, result.status, result.resultingJrec));
			}

			var toWrite = {
				s: queueitem.s,
				k: queueitem.k,
				b: queueitem.b,
				m: queueitem.m,
				r: queueitem.r,
				u: JSON.stringify(queueitem.u),
				o: queueitem.o,
				t: queueitem.t,
				j: result.resultingJrec
			};
			
			this._logger("SyncIt: MongoDB: ToWrite:", toWrite);
			
			this._mongoskinConnection.collection(this._dataCollection).insert(
				toWrite,
				{journal: true},
				function(mongoErr, doc) {
					
					this._logger("SyncIt: MongoDB: Insert:", mongoErr);
					
					if (mongoErr) {
						if ( // dupe key means someone else inserted before us...
							mongoErr.hasOwnProperty('code') &&
							mongoErr.code == 11000
						) {
							return done(null, SyncIt_Constant.Error.TRYING_TO_ADD_QUEUEITEM_BASED_ON_OLD_VERSION);
						}
						return done(err);
					}
					
					return done(
						err,
						SyncIt_Constant.Error.OK,
						queueitem,
						result.resultingJrec,
						new this._ObjectID(doc._id).toHexString()
					);
					
				}.bind(this)
			);
			
		}.bind(this)
	);
	
};

return SyncIt_ServerPersist_MongoDb;

})();
