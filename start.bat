@echo off
chcp 65001 >nul
title 任务管家 - 本地服务
cls
echo ==========================================
echo   任务管家 - 本地服务启动器
echo ==========================================
echo.

where python >nul 2>nul
if %errorlevel% == 0 (
    python start.py
) else (
    echo 未检测到 Python，尝试使用 Node.js ...
    where node >nul 2>nul
    if %errorlevel% == 0 (
        node server.js
    ) else (
        echo.
        echo 错误：系统中未找到 Python 或 Node.js。
        echo 请至少安装其中一个运行环境：
        echo   - Python 3：https://www.python.org/downloads/
        echo   - Node.js：https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
)
