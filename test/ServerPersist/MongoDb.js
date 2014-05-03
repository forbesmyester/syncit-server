(function (root, factory) {
	"use strict";
	if (typeof exports === 'object') {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like enviroments that support module.exports,
		// like Node.
		module.exports = factory(
			require('expect.js'),
			require('sync-it/Constant.js'),
			require('../../ServerPersist/Mongodb.js')
		);
	} else {
		// AMD. Register as an anonymous module.
		define(
			[
				'sync-it/Constant',
				'../../ServerPersist/Mongodb'
			],
			factory.bind(this, expect)
		);
	}
})(this, function (
	expect,
	SyncIt_Constant,
	SyncIt_ServerPersist_Mongodb
) {

	"use strict";

	var DB_HOST = '192.168.24.11',
		DB_PORT = 27017,
		DB_NAME = 'ssm_test',
		mongoskin = require('mongoskin'),
		mongoskinConnection = mongoskin.db(
			'mongodb://' + DB_HOST + ':' + DB_PORT + '/' + DB_NAME,
			{w:true}
		);
	
	var getMongoDbPersistance = function() {
		var collectionName = 'dat_' + new Date().getTime();
		return new SyncIt_ServerPersist_Mongodb(
			function(v) { return JSON.parse(JSON.stringify(v)); },
			mongoskinConnection,
			mongoskin.ObjectID,
			collectionName,
			function() {}
		);
	};

	var doBasicInserts = function(mongoDbPersistance, done) {
		mongoDbPersistance.push({
			s: 'cars',
			k: 'ford',
			o: 'set',
			u: {
				price:'affordable',
				size:'mixed',
				speed: 'medium',
				drive: 'usually front'
			},
			m: 'ben',
			b: 0,
			t: new Date().getTime() - 1000
		}, function(err) {
			expect(err).to.equal(null);

			mongoDbPersistance.push({
				s: 'cars',
				k: 'vauxhall',
				o: 'set',
				u: {
					price:'affordable',
					size:'mixed',
					speed: 'medium',
					drive: 'usually front'
				},
				m: 'ben',
				b: 0,
				t: new Date().getTime() - 1000
			}, function(err) {
				expect(err).to.equal(null);

				mongoDbPersistance.push({
					s: 'boats',
					k: 'life raft',
					o: 'set',
					u: {
						price:'affordable',
						size:'mixed',
						speed: 'medium',
						drive: 'usually front'
					},
					m: 'ben',
					b: 0,
					t: new Date().getTime() - 1000
				}, function(err) {
					expect(err).to.equal(null);
				
					mongoDbPersistance.push({
						s: 'cars',
						k: 'mazda',
						o: 'set',
						u: {
							price:'high',
							size:'mixed',
							speed: 'medium',
							drive: 'usually front'
						},
						m: 'ben',
						b: 0,
						t: new Date().getTime() - 1000
					}, function(e) {
						expect(e).to.equal(null);

						mongoDbPersistance.push({
							s: 'cars',
							k: 'mazda',
							o: 'set',
							u: {
								price:'high',
								size:'mixed',
								speed: 'medium/fast',
								drive: 'usually front'
							},
							m: 'ben',
							b: 1,
							t: new Date().getTime() - 1000
						}, function(e) {
							expect(e).to.equal(null);
							done();
						});
					});
				});
			});
		});
	};
		
	describe ("SyncIt_ServerPersist_Mongodb",function() {

		it('will list no datasets when there are none', function(done) {
			var mongoDbPersistance = getMongoDbPersistance();
			mongoDbPersistance.getDatasetNames(function(e, names) {
				expect(e).to.equal(null);
				expect(names.length).to.equal(0);
				done();
			});
		});

		it('will list a distinct set of datasets', function(done) {
			var mongoDbPersistance = getMongoDbPersistance();
			doBasicInserts(mongoDbPersistance, function() {
				mongoDbPersistance.getDatasetNames(function(e, names) {
					expect(e).to.equal(null);
					expect(names.length).to.equal(2);
					expect(names.indexOf('cars')).to.be.greaterThan(-1);
					expect(names.indexOf('boats')).to.be.greaterThan(-1);
					done();
				});
			});

		});

		it('will reject out of date pushes', function(done) {
			var mongoDbPersistance = getMongoDbPersistance();
			doBasicInserts(mongoDbPersistance, function() {
				mongoDbPersistance.push({
					s: 'cars',
					k: 'ford',
					o: 'set',
					u: {
						price:'high',
						size:'mixed',
						speed: 'medium',
						drive: 'usually front'
					},
					m: 'ben',
					b: 1,
					t: new Date().getTime() - 1000
				}, function(e, status) {
					expect(e).to.equal(null);
					expect(status).to.equal(SyncIt_Constant.Error.OK);
					mongoDbPersistance.push({
						s: 'cars',
						k: 'ford',
						o: 'set',
						u: {
							price:'high',
							size:'mixed',
							speed: 'all',
							drive: 'usually front'
						},
						m: 'benx',
						b: 1,
						t: new Date().getTime() - 1000
					}, function(err, status) {
						expect(e).to.equal(null);
						expect(status).to.equal(SyncIt_Constant.Error.TRYING_TO_ADD_QUEUEITEM_BASED_ON_OLD_VERSION );
						done();
					});
				});
			});
			
		});
		it('can get values', function(done) {
			var mongoDbPersistance = getMongoDbPersistance();
			doBasicInserts(mongoDbPersistance, function() {
				mongoDbPersistance.getValue('cars', 'ford', function(e, status, res) {
					expect(e).to.equal(null);
					expect(status).to.equal(SyncIt_Constant.Error.OK);
					expect(res.size).to.equal('mixed');
					done();
				});
			});

		});

		it('will list queueitems in a dataset', function(done) {
			var mongoDbPersistance = getMongoDbPersistance();
			doBasicInserts(mongoDbPersistance, function() {
				mongoDbPersistance.getQueueitems('cars', null, function(e, status, queueitems, maxId) {
					expect(e).to.equal(null);
					expect(status).to.equal(SyncIt_Constant.Error.OK);
					expect(queueitems.length).to.equal(4);
					expect(maxId.length).to.be.greaterThan(5);
					mongoDbPersistance.push({
						s: 'cars',
						k: 'vauxhall',
						o: 'set',
						u: {
							price:'high',
							size:'mixed',
							speed: 'medium',
							drive: 'usually front'
						},
						m: 'ben',
						b: 1,
						t: new Date().getTime() - 1000
					}, function(e) {
						expect(e).to.equal(null);
						mongoDbPersistance.getQueueitems('cars', maxId, function(e, status, queueitems, maxId) {
							expect(e).to.equal(null);
							expect(status).to.equal(SyncIt_Constant.Error.OK);
							expect(queueitems.length).to.equal(1);
							expect(maxId.length).to.be.greaterThan(5);
							expect(queueitems[0].u.price).to.equal('high');
							done();
						});
					});
				});
			});
			
		});

		it('can get last Queueitem for a Dataset / Datakey', function(done) {
			var mongoDbPersistance = getMongoDbPersistance();
			doBasicInserts(mongoDbPersistance, function() {
				var toDoCount = 2;
				mongoDbPersistance.getLastQueueitem('cars', 'mazda', function(err, status, queueitem) {
					expect(err).to.equal(null);
					expect(status).to.equal(SyncIt_Constant.Error.OK);
					expect(queueitem.b).to.equal(1);
					expect(queueitem.k).to.equal('mazda');
					if (--toDoCount === 0) {
						done();
					}
				});
				mongoDbPersistance.getLastQueueitem('cars', 'ford', function(err, status, queueitem) {
					expect(err).to.equal(null);
					expect(status).to.equal(SyncIt_Constant.Error.OK);
					expect(queueitem.b).to.equal(0);
					expect(queueitem.k).to.equal('ford');
					if (--toDoCount === 0) {
						done();
					}
				});
			});
		});

		it('getDatasetDatakeyVersion will error with not found if not', function(done) {
			var mongoDbPersistance = getMongoDbPersistance();
			doBasicInserts(mongoDbPersistance, function() {
				mongoDbPersistance.getDatasetDatakeyVersion('cars', 'golf_buggy', 1, function(err, status, data) {
					expect(err).to.equal(null);
					expect(status).to.equal(SyncIt_Constant.Error.NO_DATA_FOUND);
					done();
				});
			});
		});

		it('can get any change', function(done) {
			var mongoDbPersistance = getMongoDbPersistance();
			doBasicInserts(mongoDbPersistance, function() {
				mongoDbPersistance.getDatasetDatakeyVersion('cars', 'mazda', 1, function(err, status, data) {
					expect(err).to.equal(null);
					expect(status).to.equal(SyncIt_Constant.Error.OK);
					expect(data.k).to.equal('mazda');
					expect(data.b).to.equal(0);
					expect(data.u.speed).to.equal('medium');
					done();
					mongoDbPersistance.getDatasetDatakeyVersion('cars', 'mazda', 1, function(err, status, data) {
						expect(err).to.equal(null);
						expect(status).to.equal(SyncIt_Constant.Error.OK);
						expect(data.k).to.equal('mazda');
						expect(data.b).to.equal(1);
						expect(data.u.speed).to.equal('medium/fast');
						done();
					});
				});
			});
		});

	});
	
});
