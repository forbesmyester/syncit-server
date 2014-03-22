(function (root, factory) { // UMD adapted from https://github.com/umdjs/umd/blob/master/returnExports.js
	"use strict";
	
	if (typeof exports === 'object') {
		module.exports = factory(
			require('sync-it/Constant.js'),
			require('sync-it/updateResult.js')
		);
	} else {
		define(
			['sync-it/Constant','sync-it/updateResult'],
			factory
		);
	}
})(this, function (SyncIt_Constant,updateResult) {
	"use strict";
	
	var getResultingJrecBasedOnOld = function(cloneFunc, storedQueueitem, queueitem) {
		
		var _getEmptyJrec = function() {
			return {
				i:{},
				v:0,
				r:false,
				t:(new Date()).getTime(),
				m:null
			};
		};
		
		var highestBasedOn = -1;
		
		if (storedQueueitem !== null) {
			highestBasedOn = storedQueueitem.b;
		}
		
		if (queueitem.b <= highestBasedOn) {
			// If we are, it is the last one with the same modifier and 
			// basedonversion then we send something about it being
			// a duplicate.
			if ((storedQueueitem.m == queueitem.m) && (storedQueueitem.b == queueitem.b)) {
				return {
					status: SyncIt_Constant.Error.TRYING_TO_ADD_ALREADY_ADDED_QUEUEITEM,
					resultingJrec: queueitem
				};
			}
			// otherwise send back just a normal version conflict error.
			return {
				status: SyncIt_Constant.Error.TRYING_TO_ADD_QUEUEITEM_BASED_ON_OLD_VERSION,
				resultingJrec: queueitem
			};
		}
		
		// Check we are not adding a future version
		if (queueitem.b > highestBasedOn + 1) {
			return {
				status: SyncIt_Constant.Error.TRYING_TO_ADD_FUTURE_QUEUEITEM,
				resultingJrec: queueitem
			};
		}
		
		// If we have a stored queueitem which had a remove operation, 
		// the item will always stay removed.
		if ((storedQueueitem !== null) && (storedQueueitem.o == 'remove')) {
			return {
				status: SyncIt_Constant.Error.DATA_ALREADY_REMOVED,
				resultingJrec: queueitem
			};
		}
		
		// Calculate the result
		return {
			status: SyncIt_Constant.OK,
			resultingJrec: updateResult(
				(storedQueueitem === null) ? _getEmptyJrec() : storedQueueitem.j,
				queueitem,
				cloneFunc
			)
		};
		
	};
	
	return {
		getResultingJrecBasedOnOld: getResultingJrecBasedOnOld
	};
	
});

