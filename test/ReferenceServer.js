(function (root, factory) {
	"use strict";
	if (typeof exports === 'object') {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like enviroments that support module.exports,
		// like Node.
		module.exports = factory(
			require('expect.js'),
			require('../ReferenceServer.js'),
			require('../ServerImplementation.js'),
			require('../ServerPersist/MemoryAsync.js')
		);
	} else {
		// AMD. Register as an anonymous module.
		define(
			['../ReferenceServer','../ServerImplementation.js','../ServerPersist/MemoryAsync'],
			factory.bind(this, expect)
		);
	}
})(this, function (expect, ReferenceServer, ServerImplementation, SyncIt_ServerPersist_MemoryAsync) {
"use strict";
var getModifierFromRequestHackFunc = function(req) {
	return req.body.m;
};

describe('When SyncItTestServ responds to a getDatasetNames request',function() {
	
	var syncItTestServer = new ReferenceServer(
		getModifierFromRequestHackFunc,
		new ServerImplementation(
			new SyncIt_ServerPersist_MemoryAsync()
		)
	);
	
	it('should respond with an empty object, when it is',function(done) {
		syncItTestServer.getDatasetNames({},function(status,data) {
			expect(status).to.eql('ok');
			expect(data).to.eql({});
			done();
		});
	});
});

describe('When SyncItTestServ responds to a PATCH request',function() {
	
	var syncItTestServer = new ReferenceServer(
		getModifierFromRequestHackFunc,
		new ServerImplementation(
			new SyncIt_ServerPersist_MemoryAsync()
		)
	);
	
	var emitCount = 0;
	var lastEmitQueueitem = null;
	var lastEmitJrec = null;
	syncItTestServer.listenForFed(function(req, seqId, dataset, datakey, queueitem, jrec) {
		expect(dataset).to.equal('xx');
		expect(datakey).to.equal('yy');
		emitCount = emitCount + 1;
		lastEmitJrec = jrec;
		lastEmitQueueitem = queueitem;
	});
	
	it('will respond with created when creating data',function(done) {
		var testCount = 0;
		var createdCount = 0;
		var req = {
			body:{ s:'xx', k:'yy', b:0, m:'aa', r:false, t:new Date().getTime(), u:{b:'c'}, o:'set' }
		};
		var test = function(status, data) {
			expect(data.queueitem.m).to.equal('aa');
			expect(['created', 'see_other'].indexOf(status)).to.be.greaterThan(-1);
			if (status == 'created') {
				createdCount++;
			}
			syncItTestServer.getValue(
				{ params:{s:'xx',k:'yy'}, body: { m: 'aa' } },
				function(err,jrec) {
					expect(createdCount).to.equal(1);
					expect(err).to.equal('ok');
					expect(jrec.i).to.eql({b:'c'});
					expect(jrec.m).to.equal('aa');
					if (++testCount == 2) {
						expect(emitCount).to.equal(1);
						expect(lastEmitJrec.v).to.equal(1);
						expect(lastEmitJrec.m).to.equal('aa');
						expect(lastEmitQueueitem.u.b).to.equal('c');
						expect(lastEmitQueueitem.b).to.equal(0);
						expect(lastEmitQueueitem.m).to.equal('aa');
						done();
					}
				}
			);
		};
		syncItTestServer.PUT(req,  test );
		syncItTestServer.PUT(req,  test );
	});
	it('will respond with ok when updating data',function(done) {
		var testCount = 0;
		var okCount = 0;
		var req = {
			params:{s:'xx',k:'yy'},
			body:{ s:'xx', k:'yy', b:1, m:'aa', r:false, t:new Date().getTime(), u:{c:'d'}, o:'set' }
		};
		var test = function(status, data) {
			expect(['ok', 'see_other'].indexOf(status)).to.be.greaterThan(-1);
			expect(data.queueitem.s).to.equal('xx');
			expect(data.queueitem.k).to.equal('yy');
			expect(data.queueitem.m).to.equal('aa');
			if (status == 'ok') {
				okCount++;
			}
			syncItTestServer.getValue(req,function(err,jrec) {
				expect(jrec.m).to.equal('aa');
				expect(jrec.i).to.eql({c:'d'});
				if (++testCount == 2) {
					expect(okCount).to.equal(1);
					done();
				}
			});
		};
		syncItTestServer.PUT(req,  test );
		syncItTestServer.PUT(req,  test );
	});
	it('will respond with conflict when trying to update with out of date patch',function(done) {
		var testCount = 0;
		var req = {
			body:{ s:'xx', k:'yy', b:1, m:'bb', r:false, t:new Date().getTime(), u:{c:'d'},o:'set' } // the time will be wrong
		};
		var test = function(status) {
			syncItTestServer.getValue({params:{s:'xx',k:'yy'},body:{m:'bb'}},function(err,jrec) {
				expect(status).to.equal('conflict');
				expect(jrec.m).to.equal('aa');
				expect(jrec.i).to.eql({c:'d'});
				if (++testCount == 2) {
					done();
				}
			});
		};
		syncItTestServer.PUT(req,  test );
		syncItTestServer.PUT(req,  test );
	});
	it('will respond when deleting',function(done) {
		var testCount = 0;
		var okCount = 0;
		var req = {
			params:{s:'xx',k:'yy'},
			body:{ s:'xx', k:'yy', b:2, m:'aa', r:false, t:new Date().getTime(), u:{t:'t'}, o:'remove' } // the time will be wrong
		};
		var test = function(status /*, data */) {
			expect(['ok', 'see_other'].indexOf(status)).to.be.greaterThan(-1);
			if (status == 'ok') {
				okCount++;
			}
			syncItTestServer.getValue(req,function(err,jrec) {
				expect(okCount).to.equal(1);
				expect(jrec.m).to.equal('aa');
				expect(jrec.r).to.equal(true);
				expect(jrec.i).to.eql({c:'d'});
				if (++testCount == 2) {
					done();
				}
			});
		};
		syncItTestServer.DELETE(req, test );
		syncItTestServer.DELETE(req, test );
	});
	it('will respond with gone, if already deleted',function(done) {
		var testCount = 0;
		var req = {
			params:{s:'xx',k:'yy'},
			body:{ s:'xx', k:'yy', b:3, m:'aa', r:false, t:new Date().getTime(), u:{t:'t'}, o:'set' } // the time will be wrong
		};
		var test = function(status /*, data */) {
			expect(status).to.equal('gone');
			syncItTestServer.getValue(req,function(err) {
				expect(err).to.equal('gone');
				if (++testCount == 2) {
					done();
				}
			});
		};
		syncItTestServer.PUT(req,  test );
		syncItTestServer.PUT(req,  test );
	});
	it('will respond with validation error if using the wrong method',function(done) {
		var testCount = 0;
		var req1 = {
			params:{s:'xx',k:'yy'},
			body:{ b:3, m:'aa', r:false, t:new Date().getTime(), u:{t:'t'}, o:'set' } // the time will be wrong
		};
		var req2 = {
			params:{s:'xx',k:'yy'},
			body:{ b:3, m:'aa', r:false, t:new Date().getTime(), u:{t:'t'}, o:'remove' } // the time will be wrong
		};
		var test = function(status /*, data */) {
			expect(status).to.equal('validation_error');
			if (++testCount == 2) {
				done();
			}
		};
		syncItTestServer.DELETE(req1,  test );
		syncItTestServer.PUT(req2,	test );
	});
});

describe('SyncItTestServ can respond to data requests',function() {
	
	var injectR = function(ob) {
		var r = JSON.parse(JSON.stringify(ob));
		r.r = false;
		return r;
	};
	
	it('when there is a point to go from',function(done) {
		
		var syncItServ = new ReferenceServer(
			getModifierFromRequestHackFunc,
			new ServerImplementation(
				new SyncIt_ServerPersist_MemoryAsync()
			)
		);
		
		var data1 = { body: {
			s: 'usersA',
			k: 'me',
			b: 0,
			m: 'me',
			t: new Date().getTime(),
			o: 'set',
			u: {name: "Jack Smith" }
		} };
		
		var data2 = { body: {
			s: 'usersA',
			k: 'me',
			b: 1,
			m: 'me',
			t: new Date().getTime(),
			o: 'update',
			u: {eyes: "Blue" }
		} };
		
		syncItServ.PUT(data1, function(status /*, result */) {
			expect(status).to.equal('created');
			syncItServ.PATCH(data2, function(status /*, result */) {	
				expect(status).to.equal('ok');
				syncItServ.getQueueitems(
					{
						params: {s: 'usersA'},
						body: {m: 'me'},
						query: { seqId: 'usersA.me@1' }
					},
					function(status, data) {
						expect(status).to.equal('ok');
						expect(data).to.eql({		   
							queueitems: [ injectR(data2.body) ],
							seqId: "usersA.me@2"
						});
						done();
					}
				);
			});
		});
	});
	
	it('when there is no point to go from',function(done) {
		
		var syncItServ = new ReferenceServer(
			getModifierFromRequestHackFunc,
			new ServerImplementation(
				new SyncIt_ServerPersist_MemoryAsync()
			)
		);
		
		var data1 = { body: {
			s: 'usersB',
			k: 'me',
			b: 0,
			m: 'me',
			t: new Date().getTime(),
			o: 'set',
			u: {name: "Jack Smith" }
		} };
		
		var data2 = { body: {
			s: 'usersB',
			k: 'me',
			b: 1,
			m: 'me',
			t: new Date().getTime(),
			o: 'update',
			u: {eyes: "Blue" }
		} };
		
		syncItServ.PUT(data1, function(status /*, result */) {
			expect(status).to.equal('created');
			syncItServ.PATCH(data2, function(status /*, result */) {	
				expect(status).to.equal('ok');				  
				syncItServ.getQueueitems(
					{ params: {s: 'usersB'}, body: {m: 'me'} },
					function(status, data) {
						expect(status).to.equal('ok');
						expect(data).to.eql({		   
							queueitems: [
								injectR(data1.body),
								injectR(data2.body)
							],
							seqId: "usersB.me@2"
						});
						done();
					}
				);
			});
		});
		
	});
	
	it('for items at a specific version',function(done) {
	
		var syncItServ = new ReferenceServer(
			getModifierFromRequestHackFunc,
			new ServerImplementation(
				new SyncIt_ServerPersist_MemoryAsync()
			)
		);
		
		var data1 = { body: {
			s: 'usersB',
			k: 'me',
			b: 0,
			m: 'me',
			t: new Date().getTime(),
			o: 'set',
			u: {name: "Jack Smith" }
		} };
		
		var data2 = { body: {
			s: 'usersB',
			k: 'me',
			b: 1,
			m: 'me',
			t: new Date().getTime(),
			o: 'update',
			u: {eyes: "Blue" }
		} };
		
		syncItServ.PUT(data1, function(status /*, result */) {
			expect(status).to.equal('created');
			syncItServ.PATCH(data2, function(status /*, result */) {	
				expect(status).to.equal('ok');
				
				syncItServ.getDatasetDatakeyVersion(
					{body: {s: 'usersB', k: 'me', v: 1, m: 'me'}},
					function(status, data) {
						expect(status).to.equal('ok');
						expect(data.u).to.eql({name: "Jack Smith" });
						done();
					}
				);
				
			});
		});
	
	});
	
	
});



});
