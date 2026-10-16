#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
任务管家 - 本地 HTTP 服务器启动脚本
适用于 Windows 10 / 11，也支持 macOS / Linux
直接双击运行或在终端执行: python start.py
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, fmt, *args_):
        # 简化日志输出
        print(fmt % args_)


def find_port(start=PORT):
    for port in range(start, start + 100):
        try:
            httpd = socketserver.TCPServer(("", port), Handler)
            return port, httpd
        except OSError:
            continue
    return None, None


def main():
    port, httpd = find_port(PORT)
    if not httpd:
        print("错误：无法找到可用端口（已尝试 %d-%d）" % (PORT, PORT + 99))
        input("按回车键退出...")
        sys.exit(1)

    url = "http://localhost:%d/" % port
    print("=" * 50)
    print("任务管家 本地服务已启动")
    print("访问地址: %s" % url)
    print("按 Ctrl+C 停止服务")
    print("=" * 50)

    # 自动打开默认浏览器
    try:
        webbrowser.open(url)
    except Exception as e:
        print("自动打开浏览器失败，请手动访问: %s" % url)
        print(e)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
