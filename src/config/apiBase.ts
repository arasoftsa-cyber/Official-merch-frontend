const API_BASE =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_BASE_PROD
    : import.meta.env.VITE_API_BASE_DEV;

export default API_BASE;
