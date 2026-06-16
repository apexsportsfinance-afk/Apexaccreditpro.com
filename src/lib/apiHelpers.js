const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const pendingRequests = new Map();

const handleResponse = async (promiseFactory, retries = MAX_RETRIES) => {
  const requestKey = typeof promiseFactory === "string" ? promiseFactory : null;

  if (requestKey && pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }

  const execution = (async () => {
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const promise = typeof promiseFactory === "function" ? promiseFactory() : promiseFactory;
        const { data, error } = await promise;

        if (error) {
          console.error(`Supabase Error (attempt ${attempt}/${retries}):`, error);
          lastError = error;

          if (
            error.code === "PGRST116" ||
            error.code === "23505" ||
            error.code === "42501" ||
            error.message?.includes("JWT")
          ) {
            throw error;
          }

          if (attempt < retries) {
            await sleep(RETRY_DELAY * attempt);
            continue;
          }
          throw error;
        }

        return data;
      } catch (err) {
        lastError = err;

        const isNetworkError =
          (err.message === "Failed to fetch" || err.name === "TypeError") &&
          !navigator.onLine;

        if (isNetworkError) {
          console.warn(`APX-101: Network error detected (attempt ${attempt}/${retries})`);
          if (attempt < retries) {
            await sleep(RETRY_DELAY * attempt);
            continue;
          }
          window.dispatchEvent(new CustomEvent("apx-network-error", { detail: err }));
        }

        throw err;
      }
    }

    throw lastError || new Error("Max retries exceeded");
  })();

  if (requestKey) {
    pendingRequests.set(requestKey, execution);
    try {
      return await execution;
    } finally {
      pendingRequests.delete(requestKey);
    }
  }

  return await execution;
};

export { handleResponse, sleep, MAX_RETRIES, RETRY_DELAY };
