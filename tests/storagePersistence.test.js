import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createPersistentStorageRequester,
    requestPersistentStorage,
} from '../docs/utils/storagePersistence.js';

test('persistent storage request exits quietly when storage is already persistent', async () => {
    let persistCalls = 0;
    const warnings = [];
    const result = await requestPersistentStorage({
        storage: {
            persisted: async () => true,
            persist: async () => {
                persistCalls += 1;
                return true;
            },
        },
        logger: {
            warn: (message) => warnings.push(message),
        },
    });

    assert.equal(result.status, 'already-persistent');
    assert.equal(persistCalls, 0);
    assert.deepEqual(warnings, []);
});

test('persistent storage request warns without throwing when the browser denies it', async () => {
    const warnings = [];
    const result = await requestPersistentStorage({
        storage: {
            persisted: async () => false,
            persist: async () => false,
        },
        logger: {
            warn: (message) => warnings.push(message),
        },
    });

    assert.equal(result.status, 'denied');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /persistent browser storage/i);
    assert.match(warnings[0], /may still be evicted/i);
});

test('persistent storage request warns without throwing when unsupported', async () => {
    const warnings = [];
    const result = await requestPersistentStorage({
        storage: undefined,
        logger: {
            warn: (message) => warnings.push(message),
        },
    });

    assert.equal(result.status, 'unsupported');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /not available/i);
});

test('persistent storage request catches API failures', async () => {
    const warnings = [];
    const result = await requestPersistentStorage({
        storage: {
            persisted: async () => {
                throw new Error('permission check failed');
            },
            persist: async () => true,
        },
        logger: {
            warn: (message) => warnings.push(message),
        },
    });

    assert.equal(result.status, 'error');
    assert.equal(result.error.message, 'permission check failed');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Could not request persistent browser storage/i);
});

test('persistent storage once helper only starts one request', async () => {
    let persistedCalls = 0;
    const requestPersistentStorageOnce = createPersistentStorageRequester({
        storage: {
            persisted: async () => {
                persistedCalls += 1;
                return true;
            },
            persist: async () => true,
        },
        logger: {
            warn: () => {},
        },
    });

    const [first, second] = await Promise.all([
        requestPersistentStorageOnce(),
        requestPersistentStorageOnce(),
    ]);

    assert.equal(persistedCalls, 1);
    assert.equal(first, second);
    assert.equal(first.status, 'already-persistent');
});
