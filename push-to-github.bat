@echo off
chcp 65001 >nul
echo ==========================================
echo   任务管家 - 发布到 GitHub
echo ==========================================
echo.
echo 本脚本会：
echo  1. 在你的 GitHub 账户创建 task-manager-h5 公开仓库
echo  2. 推送本地代码到 main 分支
echo.

set /p GH_USER=请输入 GitHub 用户名: 
set /p GH_TOKEN=请输入 GitHub Personal Access Token: 

if "%GH_USER%"=="" (
  echo 用户名不能为空
  pause
  exit /b 1
)
if "%GH_TOKEN%"=="" (
  echo Token 不能为空
  pause
  exit /b 1
)

echo.
echo 正在创建 GitHub 仓库...

powershell -Command "$headers=@{'Authorization'='token %GH_TOKEN%';'Accept'='application/vnd.github+json'}; $body='{\"name\":\"task-manager-h5\",\"private\":false,\"auto_init\":false}' | ConvertTo-Json; try { Invoke-RestMethod -Uri https://api.github.com/user/repos -Method Post -Headers $headers -Body $body -ContentType 'application/json'; Write-Host '仓库创建成功' } catch { Write-Host '仓库创建结果（可能已存在）:' $_.Exception.Message }"

echo.
echo 正在配置远程仓库并推送...
git remote remove origin 2>nul
git remote add origin https://%GH_USER%:%GH_TOKEN%@github.com/%GH_USER%/task-manager-h5.git
git branch -M main
git push -u origin main

if %errorlevel% == 0 (
  echo.
  echo 推送成功！
  echo 仓库地址: https://github.com/%GH_USER%/task-manager-h5
) else (
  echo.
  echo 推送失败，请检查用户名和 Token 是否正确
)

pause
