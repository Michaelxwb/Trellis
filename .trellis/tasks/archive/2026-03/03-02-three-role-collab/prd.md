# 三角色协作流水线模块

## Goal

基于设计文档 `docs/Trellis-三角色协作流水线模块设计说明书.md` V1.5，实现 PM/Designer/Frontend 三角色协作的核心基础设施。

## Scope

V1.0 仅支持 Claude Code 平台。

## Task Breakdown

### T1: roles.json 管理函数 (基础层)
- 新增 `scripts/common/roles.py`
- 提供: `load_roles_json()`, `save_roles_json()`, `get_upstream_dirs()`, `resolve_role_constraint()`, `parse_role_from_username()`
- 依赖: `paths.py`

### T2: `trellis init -d` 扩展
- 修改 `src/commands/init.ts`
- 新增 `-d, --dir` 参数
- 协作模式: 解析角色前缀 → 生成/追加 roles.json → 创建产出目录 → 创建 CHANGELOG.md
- 普通模式: 行为不变

### T3: Spec roles 目录模板
- 新增 `src/templates/trellis/spec/roles/{pm,designer,frontend-impl}/index.md`
- 角色规范骨架文件

### T4: enforce-output-dir.py Hook
- 新增 PreToolUse Hook 脚本
- 拦截 Edit/Write，校验文件路径是否在 output_dir 范围内
- 依赖 `resolve_role_constraint()`

### T5: SessionStart 角色注入扩展
- 扩展 `.claude/hooks/session-start.py`
- 注入角色规范 + 上游 HANDOFF/CHANGELOG

### T6: handoff.md 命令
- 新增 `.claude/commands/trellis/handoff.md`
- AI 指令: 识别上下文 → 检查产出 → 生成 HANDOFF.md → 更新 CHANGELOG → 用户 Review

### T7: 模板 Hash 排除 + CHANGELOG 初始化
- 更新 `src/utils/template-hash.ts` 排除 roles.json
- init 流程中自动创建 CHANGELOG.md

## Acceptance Criteria

- [x] `trellis init -u pm-alice -d deliverables/req/` 生成 roles.json 和产出目录
- [x] 第二个开发者 init 后 roles.json 正确追加
- [x] 无 `-d` 参数时行为与当前完全一致
- [x] PreToolUse Hook 正确拦截跨目录写入
- [x] SessionStart 注入角色规范和上游产出物
- [x] `/trellis:handoff` 正确生成 HANDOFF.md 和 CHANGELOG.md

## Implementation Summary

所有 T1-T7 均已实现，实现位置：

| Task | 文件路径 |
|------|----------|
| T1 | `src/templates/trellis/scripts/common/roles.py` |
| T2 | `src/commands/init.ts` (L456-499, L942-1038) |
| T3 | `src/templates/trellis/spec/roles/{pm,designer,frontend-impl}/` |
| T4 | `src/templates/claude/hooks/enforce-output-dir.py` |
| T5 | `src/templates/claude/hooks/session-start.py` → `inject_role_context()` |
| T6 | `src/templates/claude/commands/trellis/handoff.md` |
| T7 | `src/utils/template-hash.ts` (L212-214) |

上游合并（193ef8c）新增 `--registry`/`--template`/subtask/config.yaml 等功能，与三角色代码无冲突。

## Technical Notes

- `.developer` 文件格式不变（仅 name + initialized_at）
- 角色信息全部存储在 roles.json
- 设计文档位置: `docs/Trellis-三角色协作流水线模块设计说明书.md`
