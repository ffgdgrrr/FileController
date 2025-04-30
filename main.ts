import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs-extra';
import path from 'path';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
}

// 处理文件夹选择
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

// 处理文件操作
ipcMain.handle('perform-operation', async (_, { operation, source, target }) => {
    try {
        switch (operation) {
            case 'replace':
                await fs.ensureDir(target);
                
                // 修复后的递归文件遍历方法
                const getAllFiles = async (dir) => {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    const files = await Promise.all(entries.map(entry => {
                        const fullPath = path.join(dir, entry.name);
                        return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
                    }));
                    return files.flat();
                };

                const allFiles = await getAllFiles(source);
                console.log('[DEBUG] 源目录文件列表:', allFiles);

                await Promise.all(allFiles.map(async (srcPath) => {
                    const relativePath = path.relative(source, srcPath);
                    const destPath = path.join(target, relativePath);
                    console.log(`[DEBUG] 处理文件: ${srcPath} -> ${destPath}`);

                    try {
                        // 增强路径存在性检查
                        const destExists = await fs.pathExists(destPath);
                        console.log(`[DEBUG] 目标路径存在: ${destExists}`);
                        
                        if (destExists) {
                            const destStat = await fs.stat(destPath);
                            console.log(`[DEBUG] 目标类型: ${destStat.isFile() ? '文件' : '目录'}`);
                            
                            if (destStat.isFile()) {
                                console.log(`[执行覆盖] ${srcPath}`);
                                await fs.copy(srcPath, destPath, { overwrite: true });
                            }
                        }
                    } catch (error) {
                        console.error(`[ERROR] 处理文件失败: ${srcPath}`, error);
                    }
                }));
                return `${source} 已更新现有文件到 ${target}`;
            case 'delete':
                await fs.remove(target);
                return `${target} 已删除`;
            case 'copy':
                await fs.copy(source, target, { overwrite: false });
                return `${source} 新增文件已复制到 ${target}`;
            default:
                console.error('操作失败详情:'); // 输出完整错误堆栈
        }
    } catch (error) {
        throw new Error(`操作失败`);
    }
});

app.whenReady().then(createWindow);