"use strict";
const test = require('node:test');
const assert = require('node:assert');

const ManagedTimeouts = require('../lib/ManagedTimeouts.js');

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

const sleep = (ms) => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

test("ManagedTimeouts", async () => {
	let threshold = 10;
	let elapsed = -1;
	let startTimeMs = -1;
	let elapsedIntervalTimeMs = -1;
	let startIntervalTimeMs = -1;

	const startTimer = () => {
		startTimeMs = Date.now();
	};

	const endTimer = () => {
		elapsed = Date.now() - startTimeMs;
	};

	let managedTimeouts = new ManagedTimeouts();

	startTimer();
	managedTimeouts.setTimeout(endTimer);
	await sleep(threshold);
	assert.ok(elapsed < threshold,
		`Timeout without delay set should default delay to 0.`);

	startTimer();
	managedTimeouts.setTimeout(endTimer, 's');
	await sleep(threshold);
	assert.ok(elapsed < threshold,
		`Timeout with invalid delay type set should default delay to 0.`);

	const delayToTest = 200;
	startTimer();
	managedTimeouts.setTimeout(endTimer, delayToTest);
	await sleep(delayToTest + threshold);
	const isWithinThreshold =
		(elapsed > (delayToTest - threshold) &&
			elapsed < (delayToTest + threshold));
	assert.ok(isWithinThreshold,
		`Timeout should call function after given delay.`);

	const id = managedTimeouts.setTimeout(() => { }, delayToTest);
	const timeoutWithIdExists =
		managedTimeouts.timeouts.hasOwnProperty(id);
	assert.ok(timeoutWithIdExists,
		`Timeout should return id of created timeout`);

	managedTimeouts.clearTimeout(id);
	const timeoutWithIdErased =
		managedTimeouts.timeouts.hasOwnProperty(id) === false;
	assert.ok(timeoutWithIdErased,
		`Clearing timeout should remove timeout from record.`);

	managedTimeouts.setTimeout(() => { }, delayToTest);
	managedTimeouts.setTimeout(() => { }, delayToTest);
	managedTimeouts.setTimeout(() => { }, delayToTest);
	managedTimeouts.setTimeout(() => { }, delayToTest);
	managedTimeouts.clearAll();
	const isEmpty = Object.keys(managedTimeouts.timeouts).length === 0;
	assert.ok(isEmpty,
		'Clearing all timeouts should remove all timeouts from record.');

	managedTimeouts.destroy();
	const idAfterDestroy = managedTimeouts.setTimeout(() => { }, 1);
	const returnValueIsNull = idAfterDestroy === null;
	assert.ok(returnValueIsNull,
		'Attempting to set timeout after destroy has been called ' +
		'should return null id.');


});