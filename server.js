/**
 * 任务管家 - Node.js 本地 HTTP 服务器
 * 当系统中没有 Python 时使用此脚本
 * 运行方式: node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function serve(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  // 安全路径处理
  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (filePath.endsWith(path.sep)) {
    filePath += 'index.html';
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(serve);
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log('==========================================');
  console.log('  任务管家 本地服务已启动');
  console.log('  访问地址:', url);
  console.log('  按 Ctrl+C 停止服务');
  console.log('==========================================');
  try {
    const { exec } = require('child_process');
    exec(`start "" "${url}"`);
  } catch (e) {
    console.log('自动打开浏览器失败，请手动访问:', url);
  }
});
