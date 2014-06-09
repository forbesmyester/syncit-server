(function (root, factory) {
	"use strict";
	if (typeof exports === 'object') {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like enviroments that support module.exports,
		// like Node.
		module.exports = factory(
			require('expect.js'),
			require('../ReferenceServer.js'),
			require('../ServerPersist/MemoryAsync.js')
		);
	} else {
		// AMD. Register as an anonymous module.
		define(
			['../ReferenceServer','../ServerPersist/MemoryAsync'],
			factory.bind(this, expect)
		);
	}
})(this, function (expect, ReferenceServer, SyncIt_ServerPersist_MemoryAsync) {
"use strict";
var getModifierFromRequestHackFunc = function(req) {
	return req.body.m;
};

describe('When SyncItTestServ responds to a getDatasetNames request',function() {

	var syncItTestServer = new ReferenceServer(
		getModifierFromRequestHackFunc,
		new SyncIt_ServerPersist_MemoryAsync()
	);

	it('should respond with an empty object, when it is',function(done) {
		syncItTestServer.getDatasetNames({},function(e, status, data) {
			expect(e).to.equal(null);
			expect(status).to.eql('ok');
			expect(data).to.eql({});
			done();
		});
	});
});

describe('When SyncItTestServ responds to a PATCH request',function() {

	var syncItTestServer = new ReferenceServer(
		getModifierFromRequestHackFunc,
		new SyncIt_ServerPersist_MemoryAsync(),
		{send: function() {}}
	);

	var emitCount = 0;
	var lastEmitQueueitem = null;
	var lastEmitJrec = null;
	syncItTestServer.listenForFed(function(seqId, dataset, datakey, queueitem, jrec) {
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
		var test = function(e, status, data) {
			expect(e).to.equal(null);
			expect(data.change).to.equal('/syncit/change/xx/yy/1');
			expect(['created', 'see_other'].indexOf(status)).to.be.greaterThan(-1);
			if (status == 'created') {
				createdCount++;
			}
			syncItTestServer.getValue(
				{ params:{s:'xx',k:'yy'}, body: { m: 'aa' } },
				function(err,status,jrec) {
					expect(err).to.equal(null);
					expect(createdCount).to.equal(1);
					expect(status).to.equal('ok');
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
		var test = function(e, status, data) {
			expect(e).to.equal(null);
			expect(['ok', 'see_other'].indexOf(status)).to.be.greaterThan(-1);
			expect(data.change).to.equal('/syncit/change/xx/yy/2');
			if (status == 'ok') {
				okCount++;
			}
			syncItTestServer.getValue(req,function(e,s,jrec) {
				expect(e).to.equal(null);
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
		var test = function(e, status) {
			expect(e).to.equal(null);
			syncItTestServer.getValue({params:{s:'xx',k:'yy'},body:{m:'bb'}},function(e,s,jrec) {
				expect(e).to.equal(null);
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
		var test = function(e, status /*, data */) {
			expect(e).to.equal(null);
			expect(['ok', 'see_other'].indexOf(status)).to.be.greaterThan(-1);
			if (status == 'ok') {
				okCount++;
			}
			syncItTestServer.getValue(req,function(err,s,jrec) {
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
		var test = function(e, status /*, data */) {
			expect(e).to.equal(null);
			expect(status).to.equal('gone');
			syncItTestServer.getValue(req,function(err,s) {
				expect(s).to.equal('gone');
				if (++testCount == 2) {
					done();
				}
			});
		};
		syncItTestServer.PUT(req,  test );
		syncItTestServer.PUT(req,  test );
	});
	it('will respond with bad_request if using the wrong method',function(done) {
		var testCount = 0;
		var req1 = {
			params:{s:'xx',k:'yy'},
			body:{ b:3, m:'aa', r:false, t:new Date().getTime(), u:{t:'t'}, o:'set' } // the time will be wrong
		};
		var req2 = {
			params:{s:'xx',k:'yy'},
			body:{ b:3, m:'aa', r:false, t:new Date().getTime(), u:{t:'t'}, o:'remove' } // the time will be wrong
		};
		var test = function(e, status /*, data */) {
			expect(e).to.equal(null);
			expect(status).to.equal('bad_request');
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

	it('when there is a point to go from (1)',function(done) {

		var syncItServ = new ReferenceServer(
			getModifierFromRequestHackFunc,
			new SyncIt_ServerPersist_MemoryAsync(),
			{ send: function() {} }
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

		syncItServ.PUT(data1, function(e, status /*, result */) {
			expect(e).to.equal(null);
			expect(status).to.equal('created');
			syncItServ.PATCH(data2, function(e, status /*, result */) {
				expect(e).to.equal(null);
				expect(status).to.equal('ok');
				syncItServ.getQueueitems(
					{
						params: {s: 'usersA'},
						body: {m: 'me'},
						query: { seqId: 'usersA.me@1' }
					},
					function(err, status, data) {
						expect(err).to.equal(null);
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

	it('when there is no point to go from (2)',function(done) {

		var syncItServ = new ReferenceServer(
			getModifierFromRequestHackFunc,
			new SyncIt_ServerPersist_MemoryAsync(),
			{ send: function() {} }
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

		syncItServ.PUT(data1, function(e, status /*, result */) {
			expect(e).to.equal(null);
			expect(status).to.equal('created');
			syncItServ.PATCH(data2, function(e, status /*, result */) {
				expect(e).to.equal(null);
				expect(status).to.equal('ok');
				syncItServ.getQueueitems(
					{ params: {s: 'usersB'}, body: {m: 'me'} },
					function(e, status, data) {
						expect(e).to.equal(null);
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
			new SyncIt_ServerPersist_MemoryAsync(),
			{ send: function() {} }
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

		syncItServ.PUT(data1, function(e, status /*, result */) {
			expect(e).to.equal(null);
			expect(status).to.equal('created');
			syncItServ.PATCH(data2, function(e, status /*, result */) {
				expect(e).to.equal(null);
				expect(status).to.equal('ok');
				syncItServ.getDatasetDatakeyVersion(
					{body: {s: 'usersB', k: 'me', v: 1, m: 'me'}},
					function(e, status, data) {
						expect(e).to.equal(null);
						expect(status).to.equal('ok');
						expect(data.u).to.eql({name: "Jack Smith" });
						done();
					}
				);

			});
		});

	});

	var getMultiTestData = function() {
		return [
			{ body: {
				s: 'usersA',
				k: 'me',
				b: 0,
				m: 'me',
				t: 99,
				o: 'set',
				u: {name: "Jack Smith" },
				_q: 'usersA.me@1'
			} },
			{ body: {
				s: 'usersA',
				k: 'me',
				b: 1,
				m: 'me',
				t: 99,
				o: 'update',
				u: {eyes: "Blue" },
				_q: 'usersA.me@2'
			} },
			{ body: {
				s: 'usersB',
				k: 'other',
				b: 0,
				m: 'me',
				t: 99,
				o: 'set',
				u: {eyes: "Blue" },
				_q: 'usersB.other@1'
			} },
			{ body: {
				s: 'usersA',
				k: 'hair',
				b: 0,
				m: 'me',
				t: 99,
				o: 'update',
				u: {hair: "Brown" },
				_q: 'usersA.hair@1'
			} },
		];
	};

	var getMultiQueueitemsTest = function(input, expected, done) {

		var testData = getMultiTestData();

		var syncItServ = new ReferenceServer(
			getModifierFromRequestHackFunc,
			new SyncIt_ServerPersist_MemoryAsync(),
			{ send: function() {} }
		);

		var doTest = function() {
			syncItServ.getMultiQueueitems(
				{body: { dataset: input} },
				function(e, status, data) {
					expect(e).to.equal(null);
					expect(status).to.equal('ok');
					expect(data).to.eql(expected);
					done();
				}
			);
		};

		syncItServ.PUT(testData[0], function(e, status, result) {
			expect(e).to.equal(null);
			expect(result.sequence.replace(/.*\//,'')).to.equal(getMultiTestData()[0].body._q);
			expect(status).to.equal('created');
			syncItServ.PATCH(testData[1], function(e, status, result) {
				expect(e).to.equal(null);
				expect(result.sequence.replace(/.*\//,'')).to.equal(getMultiTestData()[1].body._q);
				expect(status).to.equal('ok');
				syncItServ.PUT(testData[2], function(e, status, result) {
					expect(e).to.equal(null);
					expect(result.sequence.replace(/.*\//,'')).to.equal(getMultiTestData()[2].body._q);
					expect(status).to.equal('created');
					syncItServ.push(testData[3], function(e, status, result) {
						expect(e).to.equal(null);
						expect(result.sequence.replace(/.*\//,'')).to.equal(getMultiTestData()[3].body._q);
						expect(status).to.equal('created');
						doTest();
					});
				});
			});
		});
	};

	it('getMultiQueueitems will give sensible feedback when given no query', function(done) {
		getMultiQueueitemsTest({}, {}, done);
	});

	it('getMultiQueueitems will give sensible feedback when a non matching query given', function(done) {
		getMultiQueueitemsTest({'xxx': ''}, {xxx: []}, done);
	});

	it('getMultiQueueitems give sensible back when a single dataset query given', function(done) {
		getMultiQueueitemsTest(
			{usersA: ''},
			{
				usersA: [
					injectR(getMultiTestData()[0].body),
					injectR(getMultiTestData()[1].body),
					injectR(getMultiTestData()[3].body)
				]
			},
			done
		);
	});

	it('getMultiQueueitems will give sensible feedback when a multiple matching query given', function(done) {
		getMultiQueueitemsTest(
			{usersA: 'usersA.me@1', usersB: ''},
			{
				usersA: [
					injectR(getMultiTestData()[1].body),
					injectR(getMultiTestData()[3].body)
				],
				usersB: [
					injectR(getMultiTestData()[2].body)
				]
			},
			done
		);
	});


});



});
