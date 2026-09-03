var http = require('http');
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '..');
var types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };
http.createServer(function (req, res) {
  var p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  var f = path.join(root, p);
  if (f.indexOf(root) !== 0) { res.writeHead(403); return res.end(); }
  fs.readFile(f, function (err, buf) {
    if (err) { res.writeHead(404); return res.end('nope'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(8791, function () { console.log('audit server on 8791'); });
