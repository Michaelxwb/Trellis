import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import chalk from "chalk";
import figlet from "figlet";
import inquirer from "inquirer";
import { createWorkflowStructure } from "../configurators/workflow.js";
import {
  getInitToolChoices,
  resolveCliFlag,
  configurePlatform,
  getPlatformsWithPythonHooks,
} from "../configurators/index.js";
import { AI_TOOLS, type CliFlag } from "../types/ai-tools.js";
import { DIR_NAMES, FILE_NAMES, PATHS } from "../constants/paths.js";
import { VERSION } from "../constants/version.js";
import { agentsMdContent } from "../templates/markdown/index.js";
import {
  setWriteMode,
  writeFile,
  type WriteMode,
} from "../utils/file-writer.js";
import {
  detectProjectType,
  type ProjectType,
} from "../utils/project-detector.js";
import { initializeHashes } from "../utils/template-hash.js";
import {
  fetchTemplateIndex,
  downloadTemplateById,
  type TemplateStrategy,
} from "../utils/template-fetcher.js";

/**
 * Detect available Python command (python3 or python)
 */
function getPythonCommand(): string {
  // Try python3 first (preferred on macOS/Linux)
  try {
    execSync("python3 --version", { stdio: "pipe" });
    return "python3";
  } catch {
    // Fall back to python (common on Windows)
    try {
      execSync("python --version", { stdio: "pipe" });
      return "python";
    } catch {
      // Default to python3, let it fail with a clear error
      return "python3";
    }
  }
}

// =============================================================================
// Role Parsing (collaboration mode)
// =============================================================================

const KNOWN_ROLES = new Set(["pm", "designer", "frontend"]);

function parseRoleFromUsername(username: string): {
  role: string | null;
  name: string;
} {
  const dashIdx = username.indexOf("-");
  if (dashIdx > 0) {
    const prefix = username.substring(0, dashIdx);
    if (KNOWN_ROLES.has(prefix)) {
      return { role: prefix, name: username };
    }
  }
  return { role: null, name: username };
}

// =============================================================================
// Bootstrap Task Creation
// =============================================================================

const BOOTSTRAP_TASK_NAME = "00-bootstrap-guidelines";

function getBootstrapPrdContent(projectType: ProjectType): string {
  const header = `# Bootstrap: Fill Project Development Guidelines

## Purpose

Welcome to Trellis! This is your first task.

AI agents use \`.trellis/spec/\` to understand YOUR project's coding conventions.
**Empty templates = AI writes generic code that doesn't match your project style.**

Filling these guidelines is a one-time setup that pays off for every future AI session.

---

## Your Task

Fill in the guideline files based on your **existing codebase**.
`;

  const backendSection = `

### Backend Guidelines

| File | What to Document |
|------|------------------|
| \`.trellis/spec/backend/directory-structure.md\` | Where different file types go (routes, services, utils) |
| \`.trellis/spec/backend/database-guidelines.md\` | ORM, migrations, query patterns, naming conventions |
| \`.trellis/spec/backend/error-handling.md\` | How errors are caught, logged, and returned |
| \`.trellis/spec/backend/logging-guidelines.md\` | Log levels, format, what to log |
| \`.trellis/spec/backend/quality-guidelines.md\` | Code review standards, testing requirements |
`;

  const frontendSection = `

### Frontend Guidelines

| File | What to Document |
|------|------------------|
| \`.trellis/spec/frontend/directory-structure.md\` | Component/page/hook organization |
| \`.trellis/spec/frontend/component-guidelines.md\` | Component patterns, props conventions |
| \`.trellis/spec/frontend/hook-guidelines.md\` | Custom hook naming, patterns |
| \`.trellis/spec/frontend/state-management.md\` | State library, patterns, what goes where |
| \`.trellis/spec/frontend/type-safety.md\` | TypeScript conventions, type organization |
| \`.trellis/spec/frontend/quality-guidelines.md\` | Linting, testing, accessibility |
`;

  const footer = `

### Thinking Guides (Optional)

The \`.trellis/spec/guides/\` directory contains thinking guides that are already
filled with general best practices. You can customize them for your project if needed.

---

## How to Fill Guidelines

### Step 0: Import from Existing Specs (Recommended)

Many projects already have coding conventions documented. **Check these first** before writing from scratch:

| File / Directory | Tool |
|------|------|
| \`CLAUDE.md\` / \`CLAUDE.local.md\` | Claude Code |
| \`AGENTS.md\` | Claude Code |
| \`.cursorrules\` | Cursor |
| \`.cursor/rules/*.mdc\` | Cursor (rules directory) |
| \`.windsurfrules\` | Windsurf |
| \`.clinerules\` | Cline |
| \`.roomodes\` | Roo Code |
| \`.github/copilot-instructions.md\` | GitHub Copilot |
| \`.vscode/settings.json\` → \`github.copilot.chat.codeGeneration.instructions\` | VS Code Copilot |
| \`CONVENTIONS.md\` / \`.aider.conf.yml\` | aider |
| \`CONTRIBUTING.md\` | General project conventions |
| \`.editorconfig\` | Editor formatting rules |

If any of these exist, read them first and extract the relevant coding conventions into the corresponding \`.trellis/spec/\` files. This saves significant effort compared to writing everything from scratch.

### Step 1: Analyze the Codebase

Ask AI to help discover patterns from actual code:

- "Read all existing config files (CLAUDE.md, .cursorrules, etc.) and extract coding conventions into .trellis/spec/"
- "Analyze my codebase and document the patterns you see"
- "Find error handling / component / API patterns and document them"

### Step 2: Document Reality, Not Ideals

Write what your codebase **actually does**, not what you wish it did.
AI needs to match existing patterns, not introduce new ones.

- **Look at existing code** - Find 2-3 examples of each pattern
- **Include file paths** - Reference real files as examples
- **List anti-patterns** - What does your team avoid?

---

## Completion Checklist

- [ ] Guidelines filled for your project type
- [ ] At least 2-3 real code examples in each guideline
- [ ] Anti-patterns documented

When done:

\`\`\`bash
python3 ./.trellis/scripts/task.py finish
python3 ./.trellis/scripts/task.py archive 00-bootstrap-guidelines
\`\`\`

---

## Why This Matters

After completing this task:

1. AI will write code that matches your project style
2. Relevant \`/trellis:before-*-dev\` commands will inject real context
3. \`/trellis:check-*\` commands will validate against your actual standards
4. Future developers (human or AI) will onboard faster
`;

  let content = header;
  if (projectType === "frontend") {
    content += frontendSection;
  } else if (projectType === "backend") {
    content += backendSection;
  } else {
    // fullstack
    content += backendSection;
    content += frontendSection;
  }
  content += footer;

  return content;
}

interface TaskJson {
  id: string;
  name: string;
  description: string;
  status: string;
  dev_type: string;
  priority: string;
  creator: string;
  assignee: string;
  createdAt: string;
  completedAt: null;
  commit: null;
  subtasks: { name: string; status: string }[];
  relatedFiles: string[];
  notes: string;
  role?: string;
  output_dir?: string;
}

function getBootstrapTaskJson(
  developer: string,
  projectType: ProjectType,
  role?: string | null,
  outputDir?: string | null,
): TaskJson {
  const today = new Date().toISOString().split("T")[0];

  let subtasks: { name: string; status: string }[];
  let relatedFiles: string[];

  if (projectType === "frontend") {
    subtasks = [
      { name: "Fill frontend guidelines", status: "pending" },
      { name: "Add code examples", status: "pending" },
    ];
    relatedFiles = [".trellis/spec/frontend/"];
  } else if (projectType === "backend") {
    subtasks = [
      { name: "Fill backend guidelines", status: "pending" },
      { name: "Add code examples", status: "pending" },
    ];
    relatedFiles = [".trellis/spec/backend/"];
  } else {
    // fullstack
    subtasks = [
      { name: "Fill backend guidelines", status: "pending" },
      { name: "Fill frontend guidelines", status: "pending" },
      { name: "Add code examples", status: "pending" },
    ];
    relatedFiles = [".trellis/spec/backend/", ".trellis/spec/frontend/"];
  }

  const taskJson: TaskJson = {
    id: BOOTSTRAP_TASK_NAME,
    name: "Bootstrap Guidelines",
    description: "Fill in project development guidelines for AI agents",
    status: "in_progress",
    dev_type: "docs",
    priority: "P1",
    creator: developer,
    assignee: developer,
    createdAt: today,
    completedAt: null,
    commit: null,
    subtasks,
    relatedFiles,
    notes: `First-time setup task created by trellis init (${projectType} project)`,
  };
  if (role) taskJson.role = role;
  if (outputDir) taskJson.output_dir = outputDir;
  return taskJson;
}

/**
 * Create bootstrap task for first-time setup
 */
function createBootstrapTask(
  cwd: string,
  developer: string,
  projectType: ProjectType,
  role?: string | null,
  outputDir?: string | null,
): boolean {
  const taskDir = path.join(cwd, PATHS.TASKS, BOOTSTRAP_TASK_NAME);
  const taskRelativePath = `${PATHS.TASKS}/${BOOTSTRAP_TASK_NAME}`;

  // Check if already exists
  if (fs.existsSync(taskDir)) {
    return true; // Already exists, not an error
  }

  try {
    // Create task directory
    fs.mkdirSync(taskDir, { recursive: true });

    // Write task.json
    const taskJson = getBootstrapTaskJson(
      developer,
      projectType,
      role,
      outputDir,
    );
    fs.writeFileSync(
      path.join(taskDir, FILE_NAMES.TASK_JSON),
      JSON.stringify(taskJson, null, 2),
      "utf-8",
    );

    // Write prd.md
    const prdContent = getBootstrapPrdContent(projectType);
    fs.writeFileSync(path.join(taskDir, FILE_NAMES.PRD), prdContent, "utf-8");

    // Set as current task
    const currentTaskFile = path.join(cwd, PATHS.CURRENT_TASK_FILE);
    fs.writeFileSync(currentTaskFile, taskRelativePath, "utf-8");

    return true;
  } catch {
    return false;
  }
}

interface InitOptions {
  cursor?: boolean;
  claude?: boolean;
  iflow?: boolean;
  opencode?: boolean;
  codex?: boolean;
  kilo?: boolean;
  kiro?: boolean;
  gemini?: boolean;
  antigravity?: boolean;
  yes?: boolean;
  user?: string;
  dir?: string;
  force?: boolean;
  skipExisting?: boolean;
  template?: string;
  overwrite?: boolean;
  append?: boolean;
}

// Compile-time check: every CliFlag must be a key of InitOptions.
// If a new platform is added to CliFlag but not to InitOptions, this line errors.
// Uses [X] extends [Y] to prevent distributive conditional behavior.
type _AssertCliFlagsInOptions = [CliFlag] extends [keyof InitOptions]
  ? true
  : "ERROR: CliFlag has values not present in InitOptions";
const _cliFlagCheck: _AssertCliFlagsInOptions = true;

interface InitAnswers {
  tools: string[];
  template?: string;
  existingDirAction?: TemplateStrategy;
}

export async function init(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

  // Generate ASCII art banner dynamically using FIGlet "Rebel" font
  const banner = figlet.textSync("Trellis", { font: "Rebel" });
  console.log(chalk.cyan(`\n${banner.trimEnd()}`));
  console.log(
    chalk.gray(
      "\n   All-in-one AI framework & toolkit for Claude Code & Cursor\n",
    ),
  );

  // Set write mode based on options
  let writeMode: WriteMode = "ask";
  if (options.force) {
    writeMode = "force";
    console.log(chalk.gray("Mode: Force overwrite existing files\n"));
  } else if (options.skipExisting) {
    writeMode = "skip";
    console.log(chalk.gray("Mode: Skip existing files\n"));
  }
  setWriteMode(writeMode);

  // Detect developer name from git config or options
  let developerName = options.user;
  if (!developerName) {
    // Only detect from git if current directory is a git repo
    const isGitRepo = fs.existsSync(path.join(cwd, ".git"));
    if (isGitRepo) {
      try {
        developerName = execSync("git config user.name", {
          cwd,
          encoding: "utf-8",
        }).trim();
      } catch {
        // Git not available or no user.name configured
      }
    }
  }

  if (developerName) {
    console.log(chalk.blue("👤 Developer:"), chalk.gray(developerName));
  } else if (!options.yes) {
    // Ask for developer name if not detected and not in yes mode
    console.log(
      chalk.gray(
        "\nTrellis supports team collaboration - each developer has their own\n" +
          `workspace directory (${PATHS.WORKSPACE}/{name}/) to track AI sessions.\n` +
          "Tip: Usually this is your git username (git config user.name).\n",
      ),
    );
    developerName = await askInput("Your name: ");
    while (!developerName) {
      console.log(chalk.yellow("Name is required"));
      developerName = await askInput("Your name: ");
    }
    console.log(chalk.blue("👤 Developer:"), chalk.gray(developerName));
  }

  // Collaboration mode validation
  let collabRole: string | null = null;
  let collabOutputDir: string | null = null;

  if (options.dir) {
    if (!options.user) {
      console.log(
        chalk.red(
          "Error: -d requires -u with a role prefix (e.g., -u pm-alice)",
        ),
      );
      return;
    }
    if (!developerName) {
      console.log(chalk.red("Error: developer name is required for -d"));
      return;
    }
    const parsed = parseRoleFromUsername(developerName);
    if (!parsed.role) {
      console.log(
        chalk.red(
          `Error: username '${developerName}' has no known role prefix. Use: pm-<name>, designer-<name>, or frontend-<name>`,
        ),
      );
      return;
    }
    collabRole = parsed.role;
    collabOutputDir = options.dir;

    // Reject path traversal (e.g., ../../../etc)
    const resolved = path.resolve(cwd, collabOutputDir);
    if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
      console.log(
        chalk.red(
          "Error: -d path must be inside the project root (path traversal detected)",
        ),
      );
      return;
    }

    // Ensure trailing slash for directory consistency
    if (!collabOutputDir.endsWith("/")) {
      collabOutputDir += "/";
    }
  }

  // Detect project type (silent - no output)
  const detectedType = detectProjectType(cwd);

  // Tool definitions derived from platform registry
  const TOOLS = getInitToolChoices();

  // Build tools from explicit flags
  const explicitTools = TOOLS.filter(
    (t) => options[t.key as keyof InitOptions],
  ).map((t) => t.key);

  let tools: string[];

  if (explicitTools.length > 0) {
    // Explicit flags take precedence (works with or without -y)
    tools = explicitTools;
  } else if (options.yes) {
    // No explicit tools + -y: default to Cursor and Claude
    tools = TOOLS.filter((t) => t.defaultChecked).map((t) => t.key);
  } else {
    // Interactive mode
    const answers = await inquirer.prompt<InitAnswers>([
      {
        type: "checkbox",
        name: "tools",
        message: "Select AI tools to configure:",
        choices: TOOLS.map((t) => ({
          name: t.name,
          value: t.key,
          checked: t.defaultChecked,
        })),
      },
    ]);
    tools = answers.tools;
  }

  // Treat unknown project type as fullstack
  const projectType: ProjectType =
    detectedType === "unknown" ? "fullstack" : detectedType;

  if (tools.length === 0) {
    console.log(
      chalk.yellow("No tools selected. At least one tool is required."),
    );
    return;
  }

  // ==========================================================================
  // Template Selection
  // ==========================================================================

  let selectedTemplate: string | null = null;
  let templateStrategy: TemplateStrategy = "skip";

  // Determine template strategy from flags
  if (options.overwrite) {
    templateStrategy = "overwrite";
  } else if (options.append) {
    templateStrategy = "append";
  }

  if (options.template) {
    // Template specified via --template flag
    selectedTemplate = options.template;
  } else if (!options.yes) {
    // Interactive mode: show template selection
    const templates = await fetchTemplateIndex();

    if (templates.length > 0) {
      // Build template choices with "blank" as first (default)
      const templateChoices = [
        {
          name: "blank (default - empty templates)",
          value: "blank",
        },
        ...templates
          .filter((t) => t.type === "spec") // MVP: only spec templates
          .map((t) => ({
            name: `${t.id} (${t.name})`,
            value: t.id,
          })),
      ];

      const templateAnswer = await inquirer.prompt<{ template: string }>([
        {
          type: "list",
          name: "template",
          message: "Select a spec template:",
          choices: templateChoices,
          default: "blank",
        },
      ]);

      if (templateAnswer.template !== "blank") {
        selectedTemplate = templateAnswer.template;

        // Check if spec directory already exists and ask what to do
        const specDir = path.join(cwd, PATHS.SPEC);
        if (fs.existsSync(specDir) && !options.overwrite && !options.append) {
          const actionAnswer = await inquirer.prompt<{
            action: TemplateStrategy;
          }>([
            {
              type: "list",
              name: "action",
              message: `Directory ${PATHS.SPEC} already exists. What do you want to do?`,
              choices: [
                { name: "Skip (keep existing)", value: "skip" },
                { name: "Overwrite (replace all)", value: "overwrite" },
                { name: "Append (add missing files only)", value: "append" },
              ],
              default: "skip",
            },
          ]);
          templateStrategy = actionAnswer.action;
        }
      }
    }
  }
  // If -y flag: selectedTemplate stays null, use blank templates

  // ==========================================================================
  // Download Remote Template (if selected)
  // ==========================================================================

  let useRemoteTemplate = false;

  if (selectedTemplate) {
    console.log(chalk.blue(`📦 Downloading template "${selectedTemplate}"...`));
    const result = await downloadTemplateById(
      cwd,
      selectedTemplate,
      templateStrategy,
    );

    if (result.success) {
      if (result.skipped) {
        console.log(chalk.gray(`   ${result.message}`));
      } else {
        console.log(chalk.green(`   ${result.message}`));
        useRemoteTemplate = true;
      }
    } else {
      console.log(chalk.yellow(`   ${result.message}`));
      console.log(chalk.gray("   Falling back to blank templates..."));
    }
  }

  // ==========================================================================
  // Create Workflow Structure
  // ==========================================================================

  // Create workflow structure with project type
  // Multi-agent is enabled by default
  console.log(chalk.blue("📁 Creating workflow structure..."));
  await createWorkflowStructure(cwd, {
    projectType,
    multiAgent: true,
    skipSpecTemplates: useRemoteTemplate,
  });

  // Collaboration mode: create output directory and CHANGELOG
  if (collabOutputDir) {
    const outputPath = path.join(cwd, collabOutputDir);
    fs.mkdirSync(outputPath, { recursive: true });

    // Create initial CHANGELOG.md (do not overwrite if exists)
    const changelogPath = path.join(outputPath, "CHANGELOG.md");
    if (!fs.existsSync(changelogPath)) {
      const dirName = path.basename(collabOutputDir.replace(/\/$/, ""));
      const changelogContent = `# CHANGELOG - ${dirName}\n\n> 变更记录表，由 AI 自动维护（/trellis:handoff 时追加）。\n\n| 日期 | 作者 | 类型 | 摘要 | 关联文件 |\n|------|------|------|------|----------|\n`;
      fs.writeFileSync(changelogPath, changelogContent, "utf-8");
    }
  }

  // Write version file for update tracking
  const versionPath = path.join(cwd, DIR_NAMES.WORKFLOW, ".version");
  fs.writeFileSync(versionPath, VERSION);

  // Configure selected tools by copying entire directories (dogfooding)
  for (const tool of tools) {
    const platformId = resolveCliFlag(tool);
    if (platformId) {
      console.log(chalk.blue(`📝 Configuring ${AI_TOOLS[platformId].name}...`));
      await configurePlatform(platformId, cwd);
    }
  }

  // Show Windows platform detection notice
  if (process.platform === "win32") {
    const pythonPlatforms = getPlatformsWithPythonHooks();
    const hasSelectedPythonPlatform = pythonPlatforms.some((id) =>
      tools.includes(AI_TOOLS[id].cliFlag),
    );
    if (hasSelectedPythonPlatform) {
      console.log(
        chalk.yellow('📌 Windows detected: Using "python" for hooks'),
      );
    }
  }

  // Create root files (skip if exists)
  await createRootFiles(cwd);

  // Initialize template hashes for modification tracking
  const hashedCount = initializeHashes(cwd);
  if (hashedCount > 0) {
    console.log(
      chalk.gray(`📋 Tracking ${hashedCount} template files for updates`),
    );
  }

  // Initialize developer identity (silent - no output)
  if (developerName) {
    try {
      const pythonCmd = getPythonCommand();
      const scriptPath = path.join(cwd, PATHS.SCRIPTS, "init_developer.py");
      execSync(`${pythonCmd} "${scriptPath}" "${developerName}"`, {
        cwd,
        stdio: "pipe", // Silent
      });

      // Collaboration mode: update roles.json
      if (collabRole && collabOutputDir) {
        try {
          // Use JSON.stringify for all interpolated values to prevent
          // Python string injection via crafted developer names or paths
          const pyScriptsDir = JSON.stringify(
            path.join(cwd, ".trellis", "scripts"),
          );
          const pyCwd = JSON.stringify(cwd);
          const pyName = JSON.stringify(developerName);
          const pyRole = JSON.stringify(collabRole);
          const pyDir = JSON.stringify(collabOutputDir);
          const rolesScript = `
import sys
sys.path.insert(0, ${pyScriptsDir})
from common.roles import upsert_developer_role
from pathlib import Path
success = upsert_developer_role(${pyName}, ${pyRole}, ${pyDir}, Path(${pyCwd}))
sys.exit(0 if success else 1)
`;
          execSync(`${pythonCmd} -c ${JSON.stringify(rolesScript)}`, {
            cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          console.log(
            chalk.blue(`  Role binding: ${collabRole} → ${collabOutputDir}`),
          );
        } catch (error: unknown) {
          const stderr =
            error instanceof Error && "stderr" in error
              ? String((error as { stderr: unknown }).stderr)
              : "";
          console.log(chalk.red(`  Failed to update roles.json: ${stderr}`));
        }
      }

      // Create bootstrap task to guide user through filling guidelines
      createBootstrapTask(
        cwd,
        developerName,
        projectType,
        collabRole,
        collabOutputDir,
      );
    } catch {
      // Silent failure - user can run init_developer.py manually
    }
  }

  // Print "What We Solve" section
  printWhatWeSolve();
}

/**
 * Simple readline-based input (no flickering like inquirer)
 */
function askInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createRootFiles(cwd: string): Promise<void> {
  const agentsPath = path.join(cwd, "AGENTS.md");

  // Write AGENTS.md from template
  const agentsWritten = await writeFile(agentsPath, agentsMdContent);
  if (agentsWritten) {
    console.log(chalk.blue("📄 Created AGENTS.md"));
  }
}

/**
 * Print "What We Solve" section showing Trellis value proposition
 * Styled like a meme/rant to resonate with developer pain points
 */
function printWhatWeSolve(): void {
  console.log(
    chalk.gray("\nSound familiar? ") +
      chalk.bold("You'll never say these again!!\n"),
  );

  // Pain point 1: Bug loop → Thinking Guides + Ralph Loop
  console.log(chalk.gray("✗ ") + '"Fix A → break B → fix B → break A..."');
  console.log(
    chalk.green("  ✓ ") +
      chalk.white("Thinking Guides + Ralph Loop: Think first, verify after"),
  );
  // Pain point 2: Instructions ignored/forgotten → Sub-agents + per-agent spec injection
  console.log(
    chalk.gray("✗ ") +
      '"Wrote CLAUDE.md, AI ignored it. Reminded AI, it forgot 5 turns later."',
  );
  console.log(
    chalk.green("  ✓ ") +
      chalk.white("Spec Injection: Rules enforced per task, not per chat"),
  );
  // Pain point 3: Missing connections → Cross-Layer Guide
  console.log(chalk.gray("✗ ") + '"Code works but nothing connects..."');
  console.log(
    chalk.green("  ✓ ") +
      chalk.white("Cross-Layer Guide: Map data flow before coding"),
  );
  // Pain point 4: Code explosion → Plan Agent
  console.log(chalk.gray("✗ ") + '"Asked for a button, got 9000 lines"');
  console.log(
    chalk.green("  ✓ ") +
      chalk.white("Plan Agent: Rejects and splits oversized tasks"),
  );

  console.log("");
}
