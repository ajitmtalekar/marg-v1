// web/src/lib/apiServerClient.jsx

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function buildUrl(path, params) {
  const url = new URL(path, API_BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
}

async function fetchApi(path, options = {}) {
  const { params, headers, ...rest } = options;

  const url = buildUrl(path, params);

  return fetch(url, {
    credentials: 'include', // safe default
    headers: {
      Accept: 'application/json',
      ...headers,
    },
    ...rest,
  });
}

const apiServerClient = {
  fetch: fetchApi,
};

export default apiServerClient;
