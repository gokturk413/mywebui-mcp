// The MCP server: tools that forward to mywebui.0's MCP commands (through web.0's gateway),
// and the mywebui skills as a guide tool and as resources.
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const kind = z.enum(['screen', 'control', 'report']).describe('screen, control or report');
const name = z.string().describe('path below the screens / controls / reports folder, without extension, e.g. pumps/station');
const project = z.string().describe('project name, e.g. default');
const scope = z.enum(['project', 'global']).describe('global: the controls shared by every project (read-only)');

const ok = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const err = (e) => ({ isError: true, content: [{ type: 'text', text: `${e?.code ?? 'failed'}: ${e?.message ?? e}` }] });
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function createServer({ client, skills, version }) {
    const server = new McpServer({ name: 'mywebui', version });
    const forward = (command, map = (a) => a) => async (args) => {
        try { return ok(await client.call(command, clean(map(args ?? {})))); } catch (e) { return err(e); }
    };

    server.registerTool('mywebui_info', {
        title: 'mywebui: projects and rights',
        description: 'The mywebui version, every project and whether this agent may write it (only dev projects are writable), the document kinds, and whether projects may be created. Call this first.',
        inputSchema: {},
    }, forward('mcpInfo'));
    server.registerTool('mywebui_list', {
        title: 'mywebui: list documents',
        description: 'Names of the screens, custom controls or reports of a project (or the global controls with scope global).',
        inputSchema: { kind, project: project.optional(), scope: scope.optional() },
    }, forward('mcpList', (a) => ({ ...a, project: a.project ?? 'default' })));
    server.registerTool('mywebui_read', {
        title: 'mywebui: read a document',
        description: 'The JSON of a screen, control or report and its sha256. Pass that sha256 as baseSha256 when writing it back.',
        inputSchema: { kind, name, project: project.optional(), scope: scope.optional() },
    }, forward('mcpRead', (a) => ({ ...a, project: a.project ?? 'default' })));
    server.registerTool('mywebui_validate', {
        title: 'mywebui: check a document',
        description: 'Checks a screen / control / report JSON the way the designer would store it, and scans its code (eval, network, cookies, state writes …). Writes nothing. For an update of a report give project and name: it is compared with the stored file.',
        inputSchema: { kind, content: z.string().describe('the document as JSON text'), project: project.optional(), name: name.optional() },
    }, forward('mcpValidate'));
    server.registerTool('mywebui_write', {
        title: 'mywebui: write a document',
        description: 'Creates or replaces a screen, control or report in a dev project. The old file is kept as a backup; open runtime pages refresh; an open designer tab does not. State writes in its code come back as findings. The output, schedule and trigger of a report can only be set in the designer. Read the mywebui-custom-controls / mywebui-screens skill first (mywebui_guide).',
        inputSchema: { project, kind, name, content: z.string().describe('the document as JSON text'), baseSha256: z.string().optional().describe('the sha256 mywebui_read returned; refused with conflict if the file changed since') },
    }, forward('mcpWrite'));
    server.registerTool('mywebui_create_project', {
        title: 'mywebui: create a project',
        description: 'Creates an empty project (a-z, 0-9, -, _), when the administrator allows it. The new project is writable for agents.',
        inputSchema: { name: z.string() },
    }, forward('mcpCreateProject'));
    server.registerTool('mywebui_search_states', {
        title: 'ioBroker: find states to bind',
        description: 'ioBroker states matching a pattern with *, beginning with an adapter and instance (e.g. modbus.0.holdingRegisters.*): id, name, type, role, unit, writable. Read-only.',
        inputSchema: { pattern: z.string(), limit: z.number().int().min(1).max(500).optional() },
    }, forward('mcpStates'));
    server.registerTool('mywebui_guide', {
        title: 'mywebui: development guide',
        description: 'The mywebui skills: without arguments the list (start with mywebui-development); with skill its SKILL.md; with skill and file one of its reference files.',
        inputSchema: { skill: z.string().optional(), file: z.string().optional() },
    }, async ({ skill, file } = {}) => {
        if (!skill) return ok(skills.list().map(({ name, description, files }) => ({ name, description, files })));
        const t = skills.read(skill, file);
        return t == null ? err({ code: 'not-found', message: `no skill "${skill}"${file ? ' file "' + file + '"' : ''}` }) : { content: [{ type: 'text', text: t }] };
    });

    server.registerResource('mywebui-skill', new ResourceTemplate('mywebui-skill://{skill}/{file}', {
        list: async () => ({ resources: skills.list().flatMap(s => s.files.map(f => ({ uri: `mywebui-skill://${s.name}/${f}`, name: `${s.name}/${f}`, mimeType: f.endsWith('.md') ? 'text/markdown' : 'application/json' }))) }),
    }), { title: 'mywebui skills', description: 'How to build for mywebui' }, async (uri, { skill, file }) => {
        const t = skills.read(String(skill), String(file));
        if (t == null) throw new Error('not found: ' + uri.href);
        return { contents: [{ uri: uri.href, text: t }] };
    });
    return server;
}
