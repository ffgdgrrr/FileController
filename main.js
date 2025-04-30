"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
let mainWindow;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
electron_1.ipcMain.handle('select-folder', () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield electron_1.dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    return result.filePaths[0];
}));
// 处理文件操作
electron_1.ipcMain.handle('perform-operation', (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { operation, source, target }) {
    try {
        switch (operation) {
            case 'replace':
                yield fs_extra_1.default.ensureDir(target);
                // 修复后的递归文件遍历方法
                const getAllFiles = (dir) => __awaiter(void 0, void 0, void 0, function* () {
                    const entries = yield fs_extra_1.default.readdir(dir, { withFileTypes: true });
                    const files = yield Promise.all(entries.map(entry => {
                        const fullPath = path_1.default.join(dir, entry.name);
                        return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
                    }));
                    return files.flat();
                });
                const allFiles = yield getAllFiles(source);
                console.log('[DEBUG] 源目录文件列表:', allFiles);
                yield Promise.all(allFiles.map((srcPath) => __awaiter(void 0, void 0, void 0, function* () {
                    const relativePath = path_1.default.relative(source, srcPath);
                    const destPath = path_1.default.join(target, relativePath);
                    console.log(`[DEBUG] 处理文件: ${srcPath} -> ${destPath}`);
                    try {
                        // 增强路径存在性检查
                        const destExists = yield fs_extra_1.default.pathExists(destPath);
                        console.log(`[DEBUG] 目标路径存在: ${destExists}`);
                        if (destExists) {
                            const destStat = yield fs_extra_1.default.stat(destPath);
                            console.log(`[DEBUG] 目标类型: ${destStat.isFile() ? '文件' : '目录'}`);
                            if (destStat.isFile()) {
                                console.log(`[执行覆盖] ${srcPath}`);
                                yield fs_extra_1.default.copy(srcPath, destPath, { overwrite: true });
                            }
                        }
                    }
                    catch (error) {
                        console.error(`[ERROR] 处理文件失败: ${srcPath}`, error);
                    }
                })));
                return `${source} 已更新现有文件到 ${target}`;
            case 'delete':
                yield fs_extra_1.default.remove(target);
                return `${target} 已删除`;
            case 'copy':
                yield fs_extra_1.default.copy(source, target, { overwrite: false });
                return `${source} 新增文件已复制到 ${target}`;
            default:
                console.error('操作失败详情:'); // 输出完整错误堆栈
        }
    }
    catch (error) {
        throw new Error(`操作失败`);
    }
}));
electron_1.app.whenReady().then(createWindow);
