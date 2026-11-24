'use strict';
// node --test test/flowParameters.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeParameterSchema, resolveFlowRunParameters } = require('../flowParameters.js');

const schema = normalizeParameterSchema({
	properties: {
		entity: { type: 'string', enum: ['c3', 'c4'], default: 'c3' },
		start_date: { type: 'string', format: 'date', default: '-7d' },
		batch_size: { type: 'integer', default: 500 }
	},
	required: ['entity']
});

describe('flowParameters (CommonJS copy)', () => {
	it('applies defaults and leaves relative dates as given', () => {
		assert.deepEqual(resolveFlowRunParameters({ schema }), { entity: 'c3', start_date: '-7d', batch_size: 500 });
	});

	it('precedence: default < flow < run; null and empty string are unset', () => {
		const p = resolveFlowRunParameters({
			schema,
			flowParameters: { entity: 'c4', start_date: '-30d' },
			runParameters: { start_date: '', batch_size: '250' }
		});
		assert.deepEqual(p, { entity: 'c4', start_date: '-30d', batch_size: 250 });
	});

	it('rejects unknown names and bad enum values with 422', () => {
		assert.throws(
			() => resolveFlowRunParameters({ schema, runParameters: { entity: 'c5', entitty: 1 } }),
			(err) => err.statusCode === 422 && err.errors.length === 2
		);
	});

	it('rejects unsupported schema keywords', () => {
		assert.throws(() => normalizeParameterSchema({ properties: { a: { type: 'string', pattern: 'x' } } }), /pattern/);
	});

	// Local checkouts only: fail if this copy drifts from the engine9 original.
	const engine9Source = path.join(__dirname, '../../../engine9/server/manager/flowParameters.js');
	it('matches engine9/server/manager/flowParameters.js', { skip: !fs.existsSync(engine9Source) }, () => {
		const original = fs
			.readFileSync(engine9Source, 'utf8')
			.replace(/^export const /gm, 'const ')
			.replace(/^export function /gm, 'function ');
		const copy = fs.readFileSync(path.join(__dirname, '../flowParameters.js'), 'utf8');
		assert.ok(copy.includes(original), 'frakture-utility/flowParameters.js differs from the engine9 original');
	});
});
