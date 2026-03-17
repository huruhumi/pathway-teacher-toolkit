import { spawn } from 'child_process';
import path from 'path';

/**
 * 这是一个 Node.js POC 脚本，演示如何在基于 Node.js/Next.js 的后端系统中
 * 触发 NotebookLM 的自动检索大纲工作流。
 */
export async function runNotebookLMWorkflow(topic: string, grade: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'test-notebooklm-flow.py');
        console.log(`[Node.js 编排器] 正在启动 Python 进程，主题: ${topic}, 年级: ${grade}`);

        // 使用系统的 python 运行
        const process = spawn('python', [scriptPath, topic, grade]);

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            // 实时打印 Python 脚本吐出的进度，可以通过 SSE 或 WebSockets 流式推给前端
            // 也就是用户看到的“正在检索资料...” “正在生成大纲...” 的进度条
            process.stdout.write(text);
        });

        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        process.on('close', (code) => {
            if (code !== 0) {
                console.error(`\n[Node.js 编排器] 失败，退出码: ${code}`);
                console.error(errorOutput);
                reject(new Error(errorOutput));
            } else {
                console.log(`\n[Node.js 编排器] NotebookLM 任务圆满完成！`);
                resolve(output);
            }
        });
    });
}

// 模拟本地执行测试
if (require.main === module) {
    // 如果直接用 ts-node 运行本脚本
    runNotebookLMWorkflow('武汉的历史', '10-12').catch(console.error);
}
