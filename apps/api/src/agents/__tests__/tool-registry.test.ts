import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from '../tool-registry.js';
import { ToolNotAllowedError, ToolNotFoundError, type ToolDefinition, type ToolContext } from '../types.js';

function makeFakeTool(name: 'food.lookup' | 'nutrition.compute'): ToolDefinition<{ x: number }, number> {
  return { name, description: 'fake', execute: vi.fn(async (input: { x: number }) => input.x * 2) };
}

function makeCtx(): ToolContext {
  return {} as ToolContext;
}

describe('ToolRegistry', () => {
  it('lists every registered tool by name', () => {
    const registry = new ToolRegistry([makeFakeTool('food.lookup'), makeFakeTool('nutrition.compute')]);
    expect(registry.list().sort()).toEqual(['food.lookup', 'nutrition.compute']);
  });

  it('call() invokes the real tool and returns its output', async () => {
    const registry = new ToolRegistry([makeFakeTool('food.lookup')]);
    const result = await registry.call<{ x: number }, number>('food.lookup', { x: 5 }, makeCtx());
    expect(result).toBe(10);
  });

  it('call() throws ToolNotFoundError for an unregistered name', async () => {
    const registry = new ToolRegistry([]);
    await expect(registry.call('food.lookup', {}, makeCtx())).rejects.toThrow(ToolNotFoundError);
  });

  it('callAsAgent() succeeds when the tool is in the agent\'s allowlist', async () => {
    const registry = new ToolRegistry([makeFakeTool('food.lookup')]);
    const result = await registry.callAsAgent<{ x: number }, number>(
      'nutrition', 'food.lookup', { x: 3 }, makeCtx(), ['food.lookup', 'nutrition.compute'],
    );
    expect(result).toBe(6);
  });

  it('callAsAgent() throws ToolNotAllowedError when the tool is NOT in the agent\'s allowlist — the core safety contract', async () => {
    const registry = new ToolRegistry([makeFakeTool('food.lookup'), makeFakeTool('nutrition.compute')]);
    await expect(
      registry.callAsAgent('nutrition', 'nutrition.compute', {}, makeCtx(), ['food.lookup']),
    ).rejects.toThrow(ToolNotAllowedError);
  });

  it('ToolNotAllowedError never actually invokes the underlying tool execute function', async () => {
    const tool = makeFakeTool('nutrition.compute');
    const registry = new ToolRegistry([tool]);
    await expect(
      registry.callAsAgent('nutrition', 'nutrition.compute', { x: 1 }, makeCtx(), []),
    ).rejects.toThrow(ToolNotAllowedError);
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('an empty allowlist blocks every tool, including ones the registry actually has', async () => {
    const registry = new ToolRegistry([makeFakeTool('food.lookup')]);
    await expect(
      registry.callAsAgent('nutrition', 'food.lookup', { x: 1 }, makeCtx(), []),
    ).rejects.toThrow(ToolNotAllowedError);
  });

  it('the default constructor wires the real ALL_TOOLS registry (18 real tools)', async () => {
    const { ToolRegistry: RealRegistry } = await import('../tool-registry.js');
    const registry = new RealRegistry();
    expect(registry.list().length).toBe(19);
    expect(registry.has('allergen.check')).toBe(true);
    expect(registry.has('nutrition.compute')).toBe(true);
  });
});
