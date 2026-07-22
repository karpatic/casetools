function getDefaultStorage() {
    return typeof navigator === 'undefined' ? undefined : navigator.storage;
}

function getDefaultLogger() {
    return typeof console === 'undefined' ? undefined : console;
}

function warn(logger, message, error) {
    if (!logger || typeof logger.warn !== 'function') return;
    if (error) {
        logger.warn(message, error);
        return;
    }
    logger.warn(message);
}

async function requestPersistentStorage({
    storage = getDefaultStorage(),
    logger = getDefaultLogger(),
} = {}) {
    if (
        !storage
        || typeof storage.persisted !== 'function'
        || typeof storage.persist !== 'function'
    ) {
        warn(logger, 'Persistent browser storage is not available; stored PDFs may still be evicted by browser storage cleanup.');
        return { status: 'unsupported' };
    }

    try {
        if (await storage.persisted()) {
            return { status: 'already-persistent' };
        }

        if (await storage.persist()) {
            return { status: 'granted' };
        }

        warn(logger, 'Persistent browser storage was denied; stored PDFs may still be evicted by browser storage cleanup.');
        return { status: 'denied' };
    } catch (error) {
        warn(logger, 'Could not request persistent browser storage; stored PDFs may still be evicted by browser storage cleanup.', error);
        return { status: 'error', error };
    }
}

function createPersistentStorageRequester(dependencies = {}) {
    let persistentStorageRequest;
    return () => {
        if (!persistentStorageRequest) {
            persistentStorageRequest = requestPersistentStorage(dependencies);
        }
        return persistentStorageRequest;
    };
}

const requestPersistentStorageOnce = createPersistentStorageRequester();

export {
    createPersistentStorageRequester,
    requestPersistentStorage,
    requestPersistentStorageOnce,
};
