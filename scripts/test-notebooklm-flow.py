import sys
import time
from notebooklm_py import NotebookLMClient

# 初始化 NotebookLM 客户端
# 注意：你需要确保本地已经通过 notebooklm-mcp-auth 等工具完成了登录和 Cookies 缓存
client = NotebookLMClient()

def run_workflow(topic, grade):
    print(f"=== 开始自动化备课流: {grade}年级 - {topic} ===")
    
    # 第 1 步：创建专属知识库
    print("1. 正在创建专属 Notebook...")
    notebook = client.create_notebook(title=f"{grade}年级 - {topic} 课件库")
    notebook_id = notebook.id
    print(f"   -> 创建成功! Notebook ID: {notebook_id}")

    # 第 2 步：触发 Deep Research 捞取权威资料
    print(f"2. 开始针对【{topic}】进行 Deep Research (Fast Mode)...")
    research_query = f"适合{grade}岁儿童阅读的关于{topic}的资料，包含核心事实、事件细节和文化特色。"
    
    research_task = client.start_research(
        query=research_query,
        mode="fast", # 快速版，约 30 秒
        notebook_id=notebook_id
    )
    
    # 第 3 步：轮询等待 Research 完成
    print("   -> 正在检索资料，请稍候...")
    while True:
        status = client.get_research_status(notebook_id, research_task.id)
        if status.status == "completed":
            print(f"   -> 检索完成！找到了 {len(status.sources)} 篇相关资料。")
            break
        print("   -> 仍在中寻找，等待 10 秒后重试...")
        time.sleep(10)
        
    # 第 4 步：导入资料到 Notebook
    print("3. 将查找到的资料导入到当前笔记本...")
    client.import_research(notebook_id, research_task.id)
    print("   -> 资料打底完成。")

    # 第 5 步：根据已下载的严肃资料，规避幻觉生成大纲
    print("4. 开始生成防幻觉课程大纲...")
    outline_prompt = f"""
    你是专业的教研专家。请基于当前 Notebook 中刚刚找回的资料，为 {grade}岁 的儿童设计一堂关于【{topic}】的45分钟课程大纲。
    要求：
    1. 必须严格遵循 sources 中的科学事实，不要自己编造（防幻觉）。如果资料中没有提到某个关键点，请直接利用现有的资料。
    2. 包含：引入（5分钟）、核心讲解（20分钟）、互动探索（15分钟）、总结（5分钟）。
    3. 输出形式请保持清晰的 Markdown 层级结构，并且每个知识点必须在句末引用对应资料来源的编号！
    """
    
    response = client.notebook_query(notebook_id=notebook_id, query=outline_prompt)
    
    print("\n=== 生成的大纲如下 ===")
    print(response.text)
    print("======================\n")
    print("工作流执行完毕！")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test-notebooklm-flow.py <topic> <grade>")
        print("Example: python test-notebooklm-flow.py \"武汉的历史\" \"10-12\"")
        sys.exit(1)
        
    topic = sys.argv[1]
    grade = sys.argv[2]
    run_workflow(topic, grade)
