import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSkills } from '../src/skills.js';

const skills = loadSkills(new URL('../skills/', import.meta.url));

test('lists every skill with its description and files', () => {
    const list = skills.list();
    assert.ok(list.length >= 14);
    const dev = list.find(s => s.name === 'mywebui-development');
    assert.match(dev.description, /^Use when/);
    assert.ok(list.find(s => s.name === 'mywebui-custom-controls').files.includes('example-tank-level.control'));
});

test('reads SKILL.md and reference files, nothing outside', () => {
    assert.match(skills.read('mywebui-bindings'), /^---\r?\nname: mywebui-bindings/);
    assert.match(skills.read('mywebui-bindings', 'reference.md'), /Bindings: reference/);
    assert.equal(skills.read('mywebui-bindings', '../mywebui-theming/SKILL.md'), null);
    assert.equal(skills.read('../x'), null);
    assert.equal(skills.read('nope'), null);
});
