/**
 * Trellis workflow templates
 *
 * These are GENERIC templates for user projects.
 * Do NOT use Trellis project's own .trellis/ directory (which may be customized).
 *
 * Directory structure:
 *   trellis/
 *   ├── scripts/
 *   │   ├── __init__.py
 *   │   ├── common/           # Shared utilities (Python)
 *   │   ├── multi_agent/      # Multi-agent pipeline scripts (Python)
 *   │   └── *.py              # Main scripts (Python)
 *   ├── scripts-shell-archive/ # Archived shell scripts (for reference)
 *   ├── workflow.md           # Workflow guide
 *   ├── worktree.yaml         # Worktree configuration
 *   └── gitignore.txt         # .gitignore content
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readTemplate(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf-8");
}

// Python scripts - package init
export const scriptsInit = readTemplate("scripts/__init__.py");

// Python scripts - common
export const commonInit = readTemplate("scripts/common/__init__.py");
export const commonPaths = readTemplate("scripts/common/paths.py");
export const commonDeveloper = readTemplate("scripts/common/developer.py");
export const commonGitContext = readTemplate("scripts/common/git_context.py");
export const commonWorktree = readTemplate("scripts/common/worktree.py");
export const commonTaskQueue = readTemplate("scripts/common/task_queue.py");
export const commonTaskUtils = readTemplate("scripts/common/task_utils.py");
export const commonPhase = readTemplate("scripts/common/phase.py");
export const commonRegistry = readTemplate("scripts/common/registry.py");
export const commonCliAdapter = readTemplate("scripts/common/cli_adapter.py");
export const commonRoles = readTemplate("scripts/common/roles.py");

// Python scripts - multi_agent
export const multiAgentInit = readTemplate("scripts/multi_agent/__init__.py");
export const multiAgentStart = readTemplate("scripts/multi_agent/start.py");
export const multiAgentCleanup = readTemplate("scripts/multi_agent/cleanup.py");
export const multiAgentStatus = readTemplate("scripts/multi_agent/status.py");
export const multiAgentCreatePr = readTemplate(
  "scripts/multi_agent/create_pr.py",
);
export const multiAgentPlan = readTemplate("scripts/multi_agent/plan.py");

// Python scripts - main
export const getDeveloperScript = readTemplate("scripts/get_developer.py");
export const initDeveloperScript = readTemplate("scripts/init_developer.py");
export const taskScript = readTemplate("scripts/task.py");
export const getContextScript = readTemplate("scripts/get_context.py");
export const addSessionScript = readTemplate("scripts/add_session.py");
export const createBootstrapScript = readTemplate(
  "scripts/create_bootstrap.py",
);

// Role spec templates - PM
export const specRolesPm = readTemplate("spec/roles/pm/index.md");
export const specRolesPmPrdTemplate = readTemplate(
  "spec/roles/pm/prd-template.md",
);
export const specRolesPmChangelogTemplate = readTemplate(
  "spec/roles/pm/changelog-template.md",
);

// Role spec templates - Designer
export const specRolesDesigner = readTemplate("spec/roles/designer/index.md");
export const specRolesDesignerPrototypeGuidelines = readTemplate(
  "spec/roles/designer/prototype-guidelines.md",
);
export const specRolesDesignerChangelogTemplate = readTemplate(
  "spec/roles/designer/changelog-template.md",
);

// Role spec templates - Frontend
export const specRolesFrontendImpl = readTemplate(
  "spec/roles/frontend-impl/index.md",
);
export const specRolesFrontendImplApiIntegration = readTemplate(
  "spec/roles/frontend-impl/api-integration.md",
);
export const specRolesFrontendImplChangelogTemplate = readTemplate(
  "spec/roles/frontend-impl/changelog-template.md",
);

// Configuration files
export const workflowMdTemplate = readTemplate("workflow.md");
export const worktreeYamlTemplate = readTemplate("worktree.yaml");
export const gitignoreTemplate = readTemplate("gitignore.txt");

/**
 * Get all script templates as a map of relative path to content
 */
export function getAllScripts(): Map<string, string> {
  const scripts = new Map<string, string>();

  // Package init
  scripts.set("__init__.py", scriptsInit);

  // Common
  scripts.set("common/__init__.py", commonInit);
  scripts.set("common/paths.py", commonPaths);
  scripts.set("common/developer.py", commonDeveloper);
  scripts.set("common/git_context.py", commonGitContext);
  scripts.set("common/worktree.py", commonWorktree);
  scripts.set("common/task_queue.py", commonTaskQueue);
  scripts.set("common/task_utils.py", commonTaskUtils);
  scripts.set("common/phase.py", commonPhase);
  scripts.set("common/registry.py", commonRegistry);
  scripts.set("common/cli_adapter.py", commonCliAdapter);
  scripts.set("common/roles.py", commonRoles);

  // Multi-agent
  scripts.set("multi_agent/__init__.py", multiAgentInit);
  scripts.set("multi_agent/start.py", multiAgentStart);
  scripts.set("multi_agent/cleanup.py", multiAgentCleanup);
  scripts.set("multi_agent/status.py", multiAgentStatus);
  scripts.set("multi_agent/create_pr.py", multiAgentCreatePr);
  scripts.set("multi_agent/plan.py", multiAgentPlan);

  // Main
  scripts.set("get_developer.py", getDeveloperScript);
  scripts.set("init_developer.py", initDeveloperScript);
  scripts.set("task.py", taskScript);
  scripts.set("get_context.py", getContextScript);
  scripts.set("add_session.py", addSessionScript);
  scripts.set("create_bootstrap.py", createBootstrapScript);

  return scripts;
}

/**
 * Get all role spec templates as a map of relative path to content.
 * Paths are relative to spec/roles/ (e.g., "pm/index.md").
 */
export function getAllRoleSpecs(): Map<string, string> {
  const specs = new Map<string, string>();

  // PM
  specs.set("pm/index.md", specRolesPm);
  specs.set("pm/prd-template.md", specRolesPmPrdTemplate);
  specs.set("pm/changelog-template.md", specRolesPmChangelogTemplate);

  // Designer
  specs.set("designer/index.md", specRolesDesigner);
  specs.set(
    "designer/prototype-guidelines.md",
    specRolesDesignerPrototypeGuidelines,
  );
  specs.set(
    "designer/changelog-template.md",
    specRolesDesignerChangelogTemplate,
  );

  // Frontend
  specs.set("frontend-impl/index.md", specRolesFrontendImpl);
  specs.set(
    "frontend-impl/api-integration.md",
    specRolesFrontendImplApiIntegration,
  );
  specs.set(
    "frontend-impl/changelog-template.md",
    specRolesFrontendImplChangelogTemplate,
  );

  return specs;
}
