/**
 * Simplified Chinese (zh-CN) message catalog for server-emitted, user-visible
 * HTTP `error` strings (TOK-224).
 *
 * Terminology follows the frontend glossary the UI seat established in
 * `ui/src/i18n/locales/zh-CN.json` and 交付/第2步/词表.md — never a second
 * convention beside it. Key decisions:
 *   organization/company → 公司        agent → 智能体
 *   issue/task → 任务                 run → 运行
 *   skill → 技能                       secret → 机密
 *   routine → 例程                    pipeline → 流水线
 *   case → 案例                        document → 文档
 *   chat endpoint → 聊天连接          approval → 审批
 *   workspace → 工作区                 vault → 凭据库
 *
 * Coverage policy (see 交付/TOK-224/后端交付.md): catalog entries are the
 * quality path (precise Chinese). Uncatalogued English prose is rewritten by
 * `localizeServerMessage` into a status-class Chinese sentence so it cannot
 * render as English in the UI; the original is kept on `errorOriginal`.
 * Adding a more specific translation is a pure catalog edit — no code change.
 *
 * NOT translated anywhere (by design): interface names, technical codes,
 * HTTP status codes, permission strings like `tools:manage_connections`,
 * Zod `details[].message` (lib-generated), and any interpolated data — data
 * values pass through templates verbatim.
 */

/**
 * Exact-string entries. Keys are the literal English messages the server
 * emits (after `badRequest(...)`/`notFound(...)`/direct `res.json` writes),
 * matched byte-for-byte before any template runs.
 */
export const ZH_CN_EXACT: Record<string, string> = {
  // --- error pipeline constants (error-handler.ts / errors.ts defaults) ---
  "Unauthorized": "未授权",
  "Forbidden": "禁止访问",
  "Not found": "未找到",
  "Too many requests": "请求过于频繁",
  "Validation error": "校验错误",
  "Invalid JSON body": "请求体不是有效的 JSON",
  "Internal server error": "服务器内部错误",
  "API route not found": "未找到对应的 API 路由",

  // --- authentication / authorization ---
  "Authentication required": "需要身份验证",
  "Agent authentication required": "需要智能体身份验证",
  "Board authentication required": "需要董事会身份验证",
  "Board user context required": "需要董事会用户上下文",
  "Board access required": "需要董事会访问权限",
  "Board user access required": "需要董事会用户访问权限",
  "Instance admin required": "需要实例管理员",
  "Instance admin access required": "需要实例管理员访问权限",
  "Agent key cannot access another company": "智能体密钥不能访问其他公司",
  "User does not have active company access": "用户没有可用的公司访问权限",
  "Permission denied": "没有权限",
  "Viewer access is read-only": "查看者访问权限为只读",

  // --- entity not-found family (top-frequency messages) ---
  "Issue not found": "未找到任务",
  "Issue is blocked by unresolved blockers": "该任务还有未完成的阻塞任务，不能开始执行",
  "Source issue not found": "未找到来源任务",
  "Agent not found": "未找到智能体",
  "Target agent not found": "未找到目标智能体",
  "Built-in agent not found": "未找到内置智能体",
  "Chat endpoint not found": "未找到聊天连接",
  "Chat connection not found": "未找到聊天连接",
  "Skill not found": "未找到技能",
  "Skill file not found": "未找到技能文件",
  "Skill folder not found": "未找到技能文件夹",
  "Skill comment not found": "未找到技能评论",
  "Catalog skill file not found": "未找到目录中的技能文件",
  "Invite not found": "未找到邀请",
  "Join request not found": "未找到加入请求",
  "Routine not found": "未找到例程",
  "Built-in routine not found": "未找到内置例程",
  "Managed routine not found": "未找到托管例程",
  "Routine trigger not found": "未找到例程触发器",
  "Document not found": "未找到文档",
  "Case document not found": "未找到案例文档",
  "Document is locked": "文档已锁定",
  "Secret not found": "未找到机密",
  "Secret proposal not found": "未找到机密提案",
  "User secret value not found": "未找到用户机密值",
  "Secret must belong to same company": "机密必须属于同一家公司",
  "Secret access is not granted for this agent": "未向该智能体授予机密访问权限",
  "Company not found": "未找到公司",
  "Target company not found": "未找到目标公司",
  "Member not found": "未找到成员",
  "Pipeline not found": "未找到流水线",
  "Pipeline case not found": "未找到流水线案例",
  "Pipeline stage not found": "未找到流水线阶段",
  "Pipeline case version conflict": "流水线案例版本冲突",
  "Pipeline case lease is held": "流水线案例正被租用锁定",
  "Annotation thread not found": "未找到批注讨论",
  "Status card not found": "未找到状态卡片",
  "Provider action not found": "未找到提供商操作",
  "Plugin not found": "未找到插件",
  "GitHub bot not found": "未找到 GitHub 机器人",
  "Environment not found": "未找到环境",
  "Environment customImage setup session not found": "未找到环境自定义镜像设置会话",
  "Active environment customImage template not found": "未找到有效的环境自定义镜像模板",
  "Connection grant not found": "未找到连接授权",
  "Tool application not found": "未找到工具应用",
  "Tool connection not found": "未找到工具连接",
  "Tool profile entry not found": "未找到工具配置条目",
  "Tool action request not found": "未找到工具操作请求",
  "Run log not found": "未找到运行日志",
  "Heartbeat run not found": "未找到心跳运行",
  "Test run not found": "未找到测试运行",
  "Smoke run not found": "未找到冒烟运行",
  "Project not found": "未找到项目",
  "Project workspace not found": "未找到项目工作区",
  "Workspace operation log not found": "未找到工作区操作日志",
  "Execution workspace not found": "未找到执行工作区",
  "No workspace is available for this issue": "该任务没有可用的工作区",
  "No local-readable workspace is available for this issue": "该任务没有本地可读的工作区",
  "Folder not found": "未找到文件夹",
  "Email inbox not found": "未找到电子邮箱收件箱",
  "Email delivery not found": "未找到电子邮件投递",
  "Decision not found": "未找到决策",
  "Decision queue not found": "未找到决策队列",
  "Interaction not found": "未找到互动",
  "Approval not found": "未找到审批",
  "App not found": "未找到应用",
  "Attention source not found": "未找到关注来源",
  "Invalid attention source identity": "关注来源标识无效",
  "Summary target not found": "未找到摘要目标",
  "Feedback target not found": "未找到反馈目标",
  "External object not found": "未找到外部对象",
  "CLI auth challenge not found": "未找到 CLI 身份验证质询",
  "Board claim challenge not found": "未找到董事会认领质询",
  "Board API key not found": "未找到董事会 API 密钥",
  "Paperclip Cloud enrollment not found": "未找到 Paperclip Cloud 注册",
  "Work product not found": "未找到工作产物",
  "Revision not found": "未找到修订版本",
  "Issue tree hold not found": "未找到任务树保留",
  "Annotation anchor requires the current document revision": "批注锚点需要当前的文档修订版本",
  "Annotation anchor does not match the current document revision": "批注锚点与当前的文档修订版本不匹配",

  // --- common validation / state ---
  "Invalid document key": "文档键无效",
  "Invalid announcement ID": "公告 ID 无效",
  "Invalid agent action audit query": "智能体操作审计查询无效",
  "Invalid provider vault config": "提供商凭据库配置无效",
  "Secret key is required": "机密键为必填项",
  "Routine trigger is not active": "例程触发器未激活",
  "Routine is archived": "例程已归档",
  "Reserved skill folders are system-managed": "保留技能文件夹由系统管理",
  "Bundled folders are read-only": "内置文件夹为只读",
  "Import transfer expired — re-create it": "导入传输已过期——请重新创建",
  "Import transfer has already been applied": "导入传输已被应用",
  "Import transfer apply is in progress; retry after it settles": "导入传输正在应用中，请稍后重试",
  "Plugin bridge is not enabled": "插件桥接未启用",
  "Tool gateway service is not configured": "工具网关服务未配置",
  "Selected revision is already the latest revision": "所选修订版本已是最新版本",
  "Cannot remove the last active owner": "不能移除最后一个活跃的所有者",
  "Agent Chat is disabled": "智能体对话已禁用",
  "Agent shortname lookup requires companyId query parameter": "按短名查找智能体需要 companyId 查询参数",
  "A local environment already exists for this instance.": "此实例已存在 local 类型的环境。",
  "Only ready or warning provider vaults can be default": "只有 ready 或 warning 状态的提供商凭据库才能设为默认",
  "Local folder symlink escape is not allowed": "不允许本地文件夹符号链接逃逸",
};

/**
 * Frame templates for messages that embed request data (names, keys, ids).
 * The data captured by each pattern passes through verbatim — only the
 * surrounding sentence frame is translated. Patterns are anchored and
 * entity-specific by design: a broad `(.*) not found` would smuggle English
 * entity words into the Chinese frame.
 */
export interface MessageTemplate {
  pattern: RegExp;
  translate: (match: RegExpExecArray) => string;
}

export const ZH_CN_TEMPLATES: readonly MessageTemplate[] = [
  {
    pattern: /^Plugin not found: (.+)$/,
    translate: (m) => `未找到插件：${m[1]}`,
  },
  {
    pattern: /^Plugin already installed: (.+)$/,
    translate: (m) => `插件已安装：${m[1]}`,
  },
  {
    pattern: /^Missing permission: (.+)$/,
    translate: (m) => `缺少权限：${m[1]}`,
  },
  {
    pattern: /^Unknown adapter type: (.+)$/,
    translate: (m) => `未知的适配器类型：${m[1]}`,
  },
  {
    pattern: /^(.+) is required$/,
    translate: (m) => `${m[1]}为必填项`,
  },
  {
    pattern: /^Secret key already exists: (.+)$/,
    translate: (m) => `机密键已存在：${m[1]}`,
  },
  {
    pattern: /^Secret already exists: (.+)$/,
    translate: (m) => `机密已存在：${m[1]}`,
  },
  {
    pattern: /^User secret definition already exists: (.+)$/,
    translate: (m) => `用户机密定义已存在：${m[1]}`,
  },
  {
    pattern: /^An environment named "(.+)" already exists for this instance\.$/,
    translate: (m) => `此实例已存在名为「${m[1]}」的环境。`,
  },
  {
    pattern: /^Invalid environment variable name: (.+)$/,
    translate: (m) => `环境变量名称无效：${m[1]}`,
  },
  {
    pattern: /^Invalid environment binding for key: (.+)$/,
    translate: (m) => `该键的环境绑定无效：${m[1]}`,
  },
  {
    pattern: /^Invalid (\w+) query value$/,
    translate: (m) => `「${m[1]}」查询参数值无效`,
  },
];
