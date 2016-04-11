/* globals describe it */
var http = require('http');
var zlib = require('zlib');
var proxy = require('../index.js');
var tilestrata = require('tilestrata');
var assert = require('chai').assert;

describe('"tilestrata-proxy"', function() {
	it('should set "name"', function() {
		assert.equal(proxy('uri').name, 'proxy');
	});

	before(function(done) {
		http.createServer(function(req, res) {
			if (req.url === '/dummy-3-2-1.txt') {
				res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
				res.end('The content');
			} else if (req.url === '/compressed.gzip') {
				res.writeHead(200, {
					'Content-Type': 'text/plain; charset=utf-8',
					'Content-Encoding': 'gzip',
				});
				var data = new Buffer('The content', 'utf8');
				zlib.gzip(data, function(err, data) {
					if (err) throw err;
					res.end(data);
				});
			} else if (req.url === '/doesnotexist-3-2-1.txt') {
				res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
				res.end('The content');
			} else {
				throw new Error('Unexpected URL "' + req.url + '"');
			}
		}).listen(8889, function(err) {
			if (err) throw err;
			done();
		});
	});

	it('should decompress gzipped content', function(done) {
		this.timeout(5000);

		var server = new tilestrata.TileServer();
		var req = tilestrata.TileRequest.parse('/layer/3/2/1/tile.pbf'); // no accept-encoding header
		server.layer('layer').route('tile.pbf').use(proxy({
			uri: 'http://localhost:8889/compressed.gzip'
		}));

		server.initialize(function(err) {
			if (err) throw err;
			server.serve(req, false, function(status, buffer, headers) {
				assert.equal(status, 200);
				assert.equal(headers['content-type'], 'text/plain; charset=utf-8', 'Content-Type should be set correctly');
				assert.equal(headers['content-encoding'], undefined, 'Content-Encoding should be missing');
				assert.equal(buffer.toString('utf8'), 'The content');
				done();
			});
		});
	});
	it('should not decompress content if decompress: false', function(done) {
		this.timeout(5000);

		var server = new tilestrata.TileServer();
		var req = tilestrata.TileRequest.parse('/layer/3/2/1/tile.pbf');
		server.layer('layer').route('tile.pbf').use(proxy({
			decompress: false,
			uri: 'http://localhost:8889/compressed.gzip'
		}));


		var expectedRawData = new Buffer('The content', 'utf8');
		zlib.gzip(expectedRawData, function(err, expectedGzippedData) {
			if (err) throw err;
			server.initialize(function(err) {
				if (err) throw err;
				server.serve(req, false, function(status, buffer, headers) {
					assert.equal(status, 200);
					assert.equal(headers['content-type'], 'text/plain; charset=utf-8', 'Content-Type should be set correctly');
					assert.equal(headers['content-encoding'], 'gzip', 'Content-Encoding should not be modified');
					assert.equal(buffer.toString('hex'), expectedGzippedData.toString('hex'));
					done();
				});
			});
		});
	});
	it('should return a remote content', function(done) {
		this.timeout(5000);

		var server = new tilestrata.TileServer();
		var req = tilestrata.TileRequest.parse('/layer/3/2/1/tile.pbf');
		server.layer('layer').route('tile.pbf').use(proxy({
			uri: 'http://localhost:8889/dummy-{z}-{x}-{y}.txt'
		}));

		server.initialize(function(err) {
			if (err) throw err;
			server.serve(req, false, function(status, buffer, headers) {
				assert.equal(status, 200);
				assert.equal(headers['content-type'], 'text/plain; charset=utf-8', 'Content-Type should be set correctly');
				assert.equal(buffer.toString('utf8'), 'The content');
				done();
			});
		});
	});
	it('should return proper status code', function(done) {
		this.timeout(5000);

		var server = new tilestrata.TileServer();
		var req = tilestrata.TileRequest.parse('/layer/3/2/1/tile.pbf');
		server.layer('layer').route('tile.pbf').use(proxy({
			uri: 'http://localhost:8889/doesnotexist-{z}-{x}-{y}.txt'
		}));

		server.initialize(function(err) {
			if (err) throw err;
			server.serve(req, false, function(status, buffer, headers) {
				assert.equal(status, 404);
				done();
			});
		});
	});
});
